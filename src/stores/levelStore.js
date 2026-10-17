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
import { STUDENT_CODE_LINE_OFFSET } from '../sandbox/gameApi.js';
import {
  translateError,
  formatTranslatedError,
  extractStudentLine,
  findFullWidthIssue
} from '../utils/errorTranslator.js';

/** 第 i 則提示（0 起算）需要失敗幾次才解鎖：0、2、3、4… */
export function hintUnlockFails(i) {
  return i === 0 ? 0 : i + 1;
}

/** 沙箱執行失敗 → 翻成學生看得懂的錯誤結果 */
function buildRuntimeError(runRes, code) {
  const totalLines = String(code || '').split('\n').length;
  const info = translateError({
    message: runRes.error,
    name: runRes.name,
    line: extractStudentLine(runRes.stack, STUDENT_CODE_LINE_OFFSET, totalLines),
    code
  });
  return {
    pass: false,
    error: formatTranslatedError(info),
    errorInfo: info,
    details: { stack: runRes.stack, logs: runRes.logs }
  };
}

/** 執行前檢查：還有 ___ 沒填、或混進全形符號 */
function precheckCode(code) {
  const blank = findUnfilledBlank(code);
  if (blank) {
    const info = {
      type: 'blank',
      line: blank.line,
      title: '還有空格「___」沒填',
      explain: '把 ___ 換成真正的值或指令，再按執行。',
      raw: ''
    };
    return { pass: false, error: formatTranslatedError(info), errorInfo: info };
  }
  const fw = findFullWidthIssue(code);
  if (fw) {
    const info = {
      type: 'fullwidth',
      line: fw.line,
      title: `出現全形符號「${fw.char}」`,
      explain: `中文輸入法打出的「${fw.char}」電腦看不懂，要改成半形的「${fw.replacement}」。${fw.count > 1 ? `程式裡一共有 ${fw.count} 個全形符號，` : ''}可以按「一鍵修正全形符號」。`,
      fixable: true,
      raw: ''
    };
    return { pass: false, error: formatTranslatedError(info), errorInfo: info };
  }
  return null;
}

/** 關卡驗證沒過（程式能跑、但結果不符）→ 統一補上 errorInfo */
function withLogicInfo(evaluation) {
  if (evaluation.pass || evaluation.errorInfo) return evaluation;
  return {
    ...evaluation,
    errorInfo: {
      type: 'logic',
      line: null,
      title: evaluation.error || '結果和任務要求不一樣',
      explain: '',
      reqIndex: typeof evaluation.reqIndex === 'number' ? evaluation.reqIndex : null,
      raw: ''
    }
  };
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
    // 窄螢幕時任務簡報抽屜是否打開
    isMissionDrawerOpen: false,
    // 本關失敗次數（換關歸零），用來漸進解鎖提示
    failCount: 0,
    // 最近一次執行的頂層變數快照（變數盒子）
    lastVariables: [],
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
    },
    /** 已解鎖的提示數：第 1 則一開始就能看，之後依失敗次數逐步開放（教師模式全開） */
    unlockedHintCount(state) {
      const total = this.currentLevel.hints?.length || 0;
      if (useProgressStore().isDeveloperMode) return total;
      let count = 0;
      for (let i = 0; i < total; i++) {
        if (state.failCount >= hintUnlockFails(i)) count++;
      }
      return count;
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
      this.lastVariables = [];
    },

    /** 進入（或切換到）某一關：清掉上一關殘留的結果、彈窗與提示進度 */
    enterLevel() {
      this.clearLogs();
      this.failCount = 0;
      this.isHintModalOpen = false;
      this.isExecuting = false;
      this.l6CodeApproved = false;
      this.l6ApprovedEval = null;
      this.l6ApprovedCode = '';
    },

    /** 統一處理失敗：記錄、3D 失敗動畫、錯誤圖鑑、延遲顯示失敗提示 */
    reportFailure(result, { delay = 750 } = {}) {
      const progressStore = useProgressStore();
      this.lastRunResult = result;
      this.failCount++;
      if (result.errorInfo?.type) progressStore.recordError(result.errorInfo.type);
      this.appendLog({ type: 'error', message: `⚠️ [未通過] ${result.error}` });
      if (this.sceneActionTrigger) {
        this.sceneActionTrigger('LEVEL_FAIL', { levelId: this.currentLevel.id, evaluation: result });
      }
      if (this.failModalTimer) clearTimeout(this.failModalTimer);
      if (delay > 0) {
        this.failModalTimer = setTimeout(() => { this.isFailModalOpen = true; }, delay);
      } else {
        this.isFailModalOpen = true;
      }
      return result;
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
      progressStore.markLevelCompleted(6, stars);
      this.appendLog({
        type: 'success',
        message: `🌟 [任務通關] ${evaluation.feedback}`
      });
      if (this.failModalTimer) clearTimeout(this.failModalTimer);
      this.isFailModalOpen = false;
      // 開門動畫跑完 (1.2 秒) + 再等 1 秒，才跳出成功彈窗 (合計 2200 毫秒)
      if (this.successModalTimer) clearTimeout(this.successModalTimer);
      this.successModalTimer = setTimeout(() => {
        try {
          soundManager.playSuccess();
        } catch (e) {}
        this.isSuccessModalOpen = true;
      }, 2200);
      return evaluation;
    },

    async executeLevel(payload) {
      const progressStore = useProgressStore();
      const currentLevel = this.currentLevel;
      // 快捷鍵可能在執行中再按一次，避免重複執行
      if (this.isExecuting) return { pass: false, busy: true, error: null };

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
        const l6Precheck = precheckCode(payload.code);
        if (l6Precheck) {
          this.reportFailure(l6Precheck, { delay: 0 });
          this.isExecuting = false;
          return l6Precheck;
        }
        this.appendLog({ type: 'info', message: '🖥️ 沙箱檢查學生程式碼（只驗接線，不自動開門）…' });
        const domRes = await sandboxRuntime.runDomLevel(payload.code, {
          onLog: (log) => {
            this.appendLog({ type: log.type === 'error' ? 'error' : 'info', message: `console.${log.type}: ${log.args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}` });
          },
          onApiCall: () => {}
        });

        if (!domRes.success) {
          // L6 無 3D 動畫要等，直接顯示
          this.reportFailure(buildRuntimeError(domRes, payload.code), { delay: 0 });
          this.isExecuting = false;
          return this.lastRunResult;
        }
        this.lastVariables = domRes.variables || [];

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
        const codeEval = withLogicInfo(currentLevel.validate(tracePayload));
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
          // L6 無 3D 動畫要等，直接顯示
          this.reportFailure(codeEval, { delay: 0 });
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
        const precheck = precheckCode(payload.code);
        if (precheck) {
          this.reportFailure(precheck);
          this.isExecuting = false;
          return precheck;
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
          this.reportFailure(buildRuntimeError(runRes, payload.code));
          this.isExecuting = false;
          return this.lastRunResult;
        }
        this.lastVariables = runRes.variables || [];

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
        const evaluation = withLogicInfo(currentLevel.validate(tracePayload));

        if (evaluation.pass) {
          this.lastRunResult = evaluation;
          // Notify 3D scene of success
          if (this.sceneActionTrigger) {
            this.sceneActionTrigger('LEVEL_SUCCESS', { levelId: currentLevel.id, evaluation });
          }

          progressStore.markLevelCompleted(currentLevel.id, evaluation.data?.stars);
          if (currentLevel.id === 1 && evaluation.data?.roverName) {
            progressStore.setRoverName(evaluation.data.roverName);
          }
          this.appendLog({
            type: 'success',
            message: `🌟 [任務通關] ${evaluation.feedback}`
          });

          if (this.failModalTimer) clearTimeout(this.failModalTimer);
          this.isFailModalOpen = false;

          // 先讓學生看完 3D 通關動畫，再跳出成功卡片
          if (this.successModalTimer) clearTimeout(this.successModalTimer);
          this.successModalTimer = setTimeout(() => {
            try {
              soundManager.playSuccess();
            } catch (e) {}
            this.isSuccessModalOpen = true;
          }, 1800);
        } else {
          try {
            soundManager.playError();
          } catch (e) {}
          // 先讓學生看到 3D 失敗狀態（車停住、摔倒），再顯示提示
          this.reportFailure(evaluation);
        }

        return evaluation;
      } catch (err) {
        try {
          soundManager.playError();
        } catch (e) {}
        const info = translateError({ message: err.message || String(err), name: err.name, code: payload.code });
        return this.reportFailure({ pass: false, error: formatTranslatedError(info), errorInfo: info });
      } finally {
        this.isExecuting = false;
      }
    }
  }
});

