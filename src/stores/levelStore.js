/**
 * Star Rover Odyssey 2.0 - Level Store (Pinia)
 * Manages active level execution, evaluation, feedback, and 3D event triggers
 */

import { defineStore } from 'pinia';
import { getLevelById } from '../levels/index.js';
import { useProgressStore } from './progressStore.js';
import { useDomLabStore } from './domLabStore.js';
import { soundManager } from '../game/core/SoundManager.js';
import { sandboxRuntime } from '../sandbox/runtime.js';
import { findUnfilledBlank } from '../utils/codeAnalysis.js';

function extractLine(stack) {
  if (!stack || typeof stack !== 'string') return '?';
  const m = stack.match(/<anonymous>:(\d+):\d+/) || stack.match(/:(\d+):\d+/);
  return m ? m[1] : '?';
}

export const useLevelStore = defineStore('level', {
  state: () => ({
    isExecuting: false,
    executionLogs: [],
    lastRunResult: null,
    sceneActionTrigger: null, // Callback to trigger scene 3D animations
    isSuccessModalOpen: false,
    successModalTimer: null,
    isFailModalOpen: false,
    failModalTimer: null,
    isHintModalOpen: false,
    resetNonce: 0,
    // L6 送審制：程式通過後才放行手動操作，通過前 2D 不自動開門
    l6CodeApproved: false,
    l6ApprovedEval: null,
    l6ApprovedCode: ''
  }),

  getters: {
    currentLevel(state) {
      const progress = useProgressStore();
      return getLevelById(progress.currentLevelId);
    }
  },

  actions: {
    clearLogs() {
      if (this.successModalTimer) {
        clearTimeout(this.successModalTimer);
        this.successModalTimer = null;
      }
      if (this.failModalTimer) {
        clearTimeout(this.failModalTimer);
        this.failModalTimer = null;
      }
      this.isSuccessModalOpen = false;
      this.isFailModalOpen = false;
      this.executionLogs = [];
      this.lastRunResult = null;
    },

    closeSuccessModal() {
      this.isSuccessModalOpen = false;
      if (this.successModalTimer) {
        clearTimeout(this.successModalTimer);
        this.successModalTimer = null;
      }
    },

    closeFailModal() {
      this.isFailModalOpen = false;
      if (this.failModalTimer) {
        clearTimeout(this.failModalTimer);
        this.failModalTimer = null;
      }
    },

    restoreScene() {
      try {
        soundManager.playClick();
      } catch (e) {}
      this.isFailModalOpen = false;
      if (this.sceneActionTrigger) {
        this.sceneActionTrigger('RESET_SCENE', { levelId: this.currentLevel.id });
        this.sceneActionTrigger('RESET_POSITION', { levelId: this.currentLevel.id });
      }
      this.appendLog({
        type: 'info',
        message: '3D 場景實體與機器已還原至初始整備點。'
      });
    },

    restoreVehiclePosition() {
      this.restoreScene();
    },

    appendLog(logEntry) {
      if (this.executionLogs.length < 50) {
        this.executionLogs.push({
          id: Date.now() + Math.random(),
          type: logEntry.type || 'info',
          message: logEntry.message || '',
          time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
      }
    },

    setSceneActionTrigger(triggerFn) {
      this.sceneActionTrigger = triggerFn;
    },

    toggleHintModal(open = null) {
      this.isHintModalOpen = open !== null ? open : !this.isHintModalOpen;
      soundManager.playClick();
    },

    resetCurrentLevel() {
      const progressStore = useProgressStore();
      soundManager.playClick();
      this.clearLogs();
      progressStore.clearSavedOperation(this.currentLevel.id);
      // L6 是 2D 模式：3D RESET 觸發是空函式，這裡要順手把 2D 儀表板打回鎖定
      if (this.currentLevel.id === 6) {
        try {
          useDomLabStore().resetDefaults();
        } catch (e) {}
        this.l6CodeApproved = false;
        this.l6ApprovedEval = null;
        this.l6ApprovedCode = '';
      }
      this.resetNonce++;
      if (this.sceneActionTrigger) {
        this.sceneActionTrigger('RESET', { levelId: this.currentLevel.id });
      }
      this.appendLog({
        type: 'info',
        message: '關卡場景與參數已重置為初始狀態。'
      });
    },

    // L6 手動過關：送審通過後，學生在 2D 親手點亮 disarmed + airlockOpen 才算通關
    checkL6ManualCompletion() {
      if (this.currentLevel?.id !== 6) return null;
      if (!this.l6CodeApproved) return null;
      let domLab = null;
      try {
        domLab = useDomLabStore();
      } catch (e) {
        return null;
      }
      if (!domLab.disarmed || !domLab.airlockOpen) return null;
      // 防重複觸發：先關放行旗
      this.l6CodeApproved = false;
      const progressStore = useProgressStore();
      const stars = this.l6ApprovedEval?.data?.stars ?? 3;
      const evaluation = {
        pass: true,
        data: { disarmed: true, airlockOpen: true, stars, fromCode: true, manual: true },
        feedback: `2D 網頁修復成功！程式接線正確＋親手點擊完成，警報解除、氣閘滑開！（${stars}星）`
      };
      this.lastRunResult = evaluation;
      if (this.sceneActionTrigger) {
        this.sceneActionTrigger('LEVEL_SUCCESS', { levelId: 6, evaluation });
      }
      progressStore.markLevelCompleted(6);
      this.appendLog({
        type: 'success',
        message: `🌟 [任務通關] ${evaluation.feedback}`
      });
      if (this.failModalTimer) clearTimeout(this.failModalTimer);
      this.isFailModalOpen = false;
      // L6 無 3D 勝利動畫要等，直接彈窗
      if (this.successModalTimer) clearTimeout(this.successModalTimer);
      try {
        soundManager.playSuccess();
      } catch (e) {}
      this.isSuccessModalOpen = true;
      return evaluation;
    },

    async executeLevel(payload) {
      const progressStore = useProgressStore();
      const currentLevel = this.currentLevel;

      this.isExecuting = true;
      this.clearLogs();
      try {
        soundManager.playLaunch();
      } catch (e) {
        console.warn('[Sound] Audio playback ignored:', e);
      }

      this.appendLog({
        type: 'info',
        message: `開始執行【${currentLevel.title}】任務程序...`
      });

      // Save operation in progress store
      progressStore.saveOperation(currentLevel.id, payload);

      // 新鏈路：payload.code 代表學生手寫 JS，先丟 Worker 真跑
      let tracePayload = payload;
      if (typeof payload.code === 'string' && currentLevel.id === 6) {
        // L6 送審制：只驗程式接線是否正確，不自動開門。
        // 失敗 → 直接失敗彈窗；成功 → 2D 回到鎖定態並同步接線徽章，等學生親手點擊完成。
        this.l6CodeApproved = false;
        this.l6ApprovedEval = null;
        this.appendLog({ type: 'info', message: '🖥️ 沙箱檢查學生程式碼（只驗接線，不自動開門）…' });
        const domRes = await sandboxRuntime.runDomLevel(payload.code, {
          onLog: (log) => {
            this.appendLog({ type: log.type === 'error' ? 'error' : 'info', message: `console.${log.type}: ${log.args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}` });
          },
          onApiCall: () => {}
        });

        if (!domRes.success) {
          const errResult = {
            pass: false,
            error: `程式執行失敗：第 ${extractLine(domRes.stack)} 行附近 → ${domRes.error}`,
            details: { stack: domRes.stack, logs: domRes.logs }
          };
          this.lastRunResult = errResult;
          this.appendLog({ type: 'error', message: `⚠️ [未通過] ${errResult.error}` });
          if (this.sceneActionTrigger) {
            this.sceneActionTrigger('LEVEL_FAIL', { levelId: currentLevel.id, evaluation: errResult });
          }
          // L6 無 3D 動畫要等，直接彈窗
          if (this.failModalTimer) clearTimeout(this.failModalTimer);
          this.isFailModalOpen = true;
          this.isExecuting = false;
          return errResult;
        }

        for (const l of domRes.logs || []) {
          this.appendLog({ type: l.type === 'error' ? 'error' : 'info', message: `console.${l.type}: ${l.args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}` });
        }

        tracePayload = {
          ...payload,
          apiCalls: domRes.apiCalls || [],
          domWiring: domRes.wiring || {},
          domCorrect: domRes.afterCorrect,
          domWrong: domRes.afterWrongOrder
        };

        const pickEvent = (wiringSnap, id, fallback) => {
          const types = wiringSnap?.[id]?.listenerTypes || [];
          if (types.includes('click')) return 'click';
          if (types.length > 0) return types[0];
          return fallback;
        };

        // 背景已跑完正確/錯誤兩路點擊，直接用 validate 判定程式對錯（不碰 2D 開門）
        const codeEval = currentLevel.validate(tracePayload);
        if (!codeEval.pass) {
          try {
            const domLab = useDomLabStore();
            const wiringSnap = domRes.wiring || {};
            domLab.disarmEvent = pickEvent(wiringSnap, 'disarm-btn', domLab.disarmEvent);
            domLab.airlockEvent = pickEvent(wiringSnap, 'airlock-btn', domLab.airlockEvent);
            domLab.disarmed = false;
            domLab.airlockOpen = false;
            domLab.setNotice(`【送審未通過】${codeEval.error}`, 'danger');
            domLab.pushLog('error', `❌ 送審未通過：${codeEval.error}`);
          } catch (e) {}
          this.lastRunResult = codeEval;
          this.appendLog({ type: 'error', message: `⚠️ [未通過] ${codeEval.error}` });
          if (this.sceneActionTrigger) {
            this.sceneActionTrigger('LEVEL_FAIL', { levelId: currentLevel.id, evaluation: codeEval });
          }
          // L6 無 3D 動畫要等，直接彈窗
          if (this.failModalTimer) clearTimeout(this.failModalTimer);
          this.isFailModalOpen = true;
          this.isExecuting = false;
          return codeEval;
        }

        // 送審通過：2D 照程式同步接線徽章並回到鎖定態，等學生親手操作（此時不彈成功窗、不算通關）
        try {
          const domLab = useDomLabStore();
          const wiringSnap = domRes.wiring || {};
          domLab.disarmEvent = pickEvent(wiringSnap, 'disarm-btn', 'click');
          domLab.airlockEvent = pickEvent(wiringSnap, 'airlock-btn', 'click');
          domLab.disarmAction = 'DISARM_ALARM';
          domLab.airlockAction = 'OPEN_AIRLOCK';
          domLab.disarmed = false;
          domLab.airlockOpen = false;
          domLab.setNotice('【送審通過】接線正確！請親手點擊「解除警報」→「開啟氣閘門」完成任務。', 'success');
          domLab.pushLog('system', `✅ 送審通過：#disarm-btn@${domLab.disarmEvent} / #airlock-btn@${domLab.airlockEvent}，等待手動操作`);
        } catch (e) {}
        this.l6CodeApproved = true;
        this.l6ApprovedEval = codeEval;
        this.l6ApprovedCode = payload.code;
        this.lastRunResult = null;
        this.appendLog({ type: 'success', message: '✅ 程式送審通過！請到上方 2D 網頁親手解除警報＋開啟氣閘，完成後自動過關。' });
        this.isExecuting = false;
        return { pass: false, pendingManual: true, error: null };
      } else if (typeof payload.code === 'string') {
        const blank = findUnfilledBlank(payload.code);
        if (blank) {
          const errResult = {
            pass: false,
            error: `程式碼中尚有待填空的底線「___」（第 ${blank.line} 行：${blank.text}），請填入對應的數值或指令後再執行！`
          };
          this.lastRunResult = errResult;
          this.appendLog({ type: 'error', message: `⚠️ [未通過] ${errResult.error}` });
          if (this.sceneActionTrigger) {
            this.sceneActionTrigger('LEVEL_FAIL', { levelId: currentLevel.id, evaluation: errResult });
          }
          if (this.failModalTimer) clearTimeout(this.failModalTimer);
          this.failModalTimer = setTimeout(() => { this.isFailModalOpen = true; }, 750);
          this.isExecuting = false;
          return errResult;
        }

        this.appendLog({ type: 'info', message: '🖥️ 沙箱執行學生程式碼中...' });
        const runRes = await sandboxRuntime.execute({
          code: payload.code,
          levelId: currentLevel.id,
          initialData: payload.initialData || {},
          onLog: (log) => {
            this.appendLog({ type: log.type === 'error' ? 'error' : 'info', message: `console.${log.type}: ${log.args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}` });
          },
          onApiCall: () => {}
        });

        if (!runRes.success) {
          const errResult = {
            pass: false,
            error: `程式執行失敗：第 ${extractLine(runRes.stack)} 行附近 → ${runRes.error}`,
            details: { stack: runRes.stack, logs: runRes.logs }
          };
          this.lastRunResult = errResult;
          this.appendLog({ type: 'error', message: `⚠️ [未通過] ${errResult.error}` });
          if (this.sceneActionTrigger) {
            this.sceneActionTrigger('LEVEL_FAIL', { levelId: currentLevel.id, evaluation: errResult });
          }
          if (this.failModalTimer) clearTimeout(this.failModalTimer);
          this.failModalTimer = setTimeout(() => { this.isFailModalOpen = true; }, 750);
          this.isExecuting = false;
          return errResult;
        }

        // Worker 跑出來的 logs 轉進遙測 console
        for (const l of runRes.logs || []) {
          this.appendLog({ type: l.type === 'error' ? 'error' : 'info', message: `console.${l.type}: ${l.args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}` });
        }

        tracePayload = {
          ...payload,
          apiCalls: runRes.apiCalls || [],
          domState: runRes.domState || undefined,
          workerResult: runRes.result
        };
      }

      // Notify 3D scene that execution has started
      if (this.sceneActionTrigger) {
        this.sceneActionTrigger('EXECUTE_START', { levelId: currentLevel.id, payload: tracePayload });
      }

      // Calculate realistic animation duration for each level
      let animDuration = 600;
      if (currentLevel.id === 1 && payload.sequence) {
        animDuration = Math.max(800, payload.sequence.length * 520);
      } else if (currentLevel.id === 2) {
        animDuration = 1600;
      } else if (currentLevel.id === 3) {
        animDuration = 2000;
      } else if (currentLevel.id === 4) {
        if (tracePayload.apiCalls) {
          animDuration = Math.max(1200, Math.min(tracePayload.apiCalls.length * 420, 5000));
        } else {
          const blocks = payload.loopConfig?.blocks || [];
          let totalSteps = 0;
          for (const b of blocks) {
            totalSteps += (b.type === 'LOOP' ? (b.count || 2) : 1);
          }
          animDuration = Math.max(1200, Math.min(totalSteps * 420, 5000));
        }
      } else if (currentLevel.id === 5) {
        animDuration = 1500;
      } else if (currentLevel.id === 7) {
        animDuration = 1800;
      } else if (currentLevel.id === 8) {
        animDuration = 2000;
      } else if (currentLevel.id === 9) {
        const call = tracePayload.apiCalls?.find((c) => c.api === 'runner.setAutoRun');
        const frames = call?.runs?.find((r) => r.courseId === 'A')?.frames || [];
        animDuration = Math.max(1200, Math.min(frames.length * 450 + 250, 7000));
      }

      // Allow 3D animation to play out
      await new Promise(resolve => setTimeout(resolve, animDuration));

      try {
        const evaluation = currentLevel.validate(tracePayload);
        this.lastRunResult = evaluation;

        if (evaluation.pass) {
          // Notify 3D scene of success
          if (this.sceneActionTrigger) {
            this.sceneActionTrigger('LEVEL_SUCCESS', { levelId: currentLevel.id, evaluation });
          }

          progressStore.markLevelCompleted(currentLevel.id);
          this.appendLog({
            type: 'success',
            message: `🌟 [任務通關] ${evaluation.feedback}`
          });

          if (this.failModalTimer) clearTimeout(this.failModalTimer);
          this.isFailModalOpen = false;

          // Delay success modal to let user enjoy the final victory animation
          if (this.successModalTimer) clearTimeout(this.successModalTimer);
          this.successModalTimer = setTimeout(() => {
            try {
              soundManager.playSuccess();
            } catch (e) {}
            this.isSuccessModalOpen = true;
          }, 800);
        } else {
          try {
            soundManager.playError();
          } catch (e) {}
          this.appendLog({
            type: 'error',
            message: `⚠️ [未通過] ${evaluation.error}`
          });

          if (this.sceneActionTrigger) {
            this.sceneActionTrigger('LEVEL_FAIL', { levelId: currentLevel.id, evaluation });
          }

          // Delay fail modal to let user see 3D fail state / car stop
          if (this.failModalTimer) clearTimeout(this.failModalTimer);
          this.failModalTimer = setTimeout(() => {
            this.isFailModalOpen = true;
          }, 750);
        }

        return evaluation;
      } catch (err) {
        try {
          soundManager.playError();
        } catch (e) {}
        const errResult = {
          pass: false,
          error: `執行期異常: ${err.message || String(err)}`
        };
        this.lastRunResult = errResult;
        this.appendLog({
          type: 'error',
          message: errResult.error
        });

        if (this.failModalTimer) clearTimeout(this.failModalTimer);
        this.failModalTimer = setTimeout(() => {
          this.isFailModalOpen = true;
        }, 750);

        return errResult;
      } finally {
        this.isExecuting = false;
      }
    }
  }
});

