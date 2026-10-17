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
import { instrumentForTrace } from '../utils/codeTracer.js';
import { MAZE_STEP_SECONDS } from '../game/sim/maze.js';
import { buildCustomCourse, isValidCustomMiddle, describeFailure, CUSTOM_COURSE_ID } from '../game/sim/parkour.js';
import {
  translateError,
  formatTranslatedError,
  extractStudentLine,
  findFullWidthIssue
} from '../utils/errorTranslator.js';

/** 手動按「播放」時每一步停留的時間（毫秒） */
export const TRACE_MANUAL_STEP_MS = 550;

/** 3D 動畫裡「一個 API 呼叫 = 一個動作」的關卡，每個動作花多久（毫秒） */
const ACTION_MS_BY_LEVEL = { 4: MAZE_STEP_SECONDS * 1000 };

/**
 * 執行時自動跟跑：每一步的間隔。步數少就放慢（看得清楚），步數多就加快（跟上 3D 動畫）。
 * @param {number} totalMs 3D 動畫長度
 * @param {number} stepCount 追蹤步數
 */
export function autoTraceInterval(totalMs, stepCount) {
  if (stepCount <= 0) return 0;
  const min = stepCount <= 12 ? 350 : 140;
  return Math.max(min, Math.min(600, Math.round(totalMs / stepCount)));
}

/**
 * 算出每一步要在第幾毫秒亮起。
 * - 有 actionMs（3D 一個動作對應一個 API 呼叫）：「發出第 k 個呼叫的那一步」剛好在 3D 開始第 k 個動作時亮起，
 *   同一段裡前面的步驟（例如迴圈判斷）平均排在前一個動作的最後 30%。
 * - 沒有：每步固定間隔 intervalMs。
 * @param {{ calls: number }[]} steps
 * @returns {number[]} 每一步距離開始播放的毫秒數（遞增）
 */
export function buildTraceSchedule(steps, { actionMs = 0, intervalMs = TRACE_MANUAL_STEP_MS } = {}) {
  const totalCalls = steps.length > 0 ? steps[steps.length - 1].calls : 0;
  if (!actionMs || totalCalls < 2) {
    return steps.map((_, i) => i * intervalMs);
  }
  const times = [];
  let i = 0;
  while (i < steps.length) {
    const c = steps[i].calls;
    let j = i;
    while (j < steps.length && steps[j].calls === c) j++;
    const count = j - i;
    if (c >= totalCalls) {
      // 最後一個動作之後的程式：接在動畫後面，照固定間隔
      const base = totalCalls * actionMs;
      for (let k = 0; k < count; k++) times.push(base + k * intervalMs);
    } else {
      // 這一段最後一步（發出第 c 個呼叫）在 c * actionMs 亮起；
      // 第 0 段沒有「前一個動作」可以借時間，就擠在第一個動作的前 30%
      const end = c === 0 ? (count === 1 ? 0 : actionMs * 0.3) : c * actionMs;
      const start = c === 0 ? 0 : end - actionMs * 0.3;
      for (let k = 0; k < count; k++) {
        times.push(count === 1 ? end : start + ((end - start) * k) / (count - 1));
      }
    }
    i = j;
  }
  return times;
}

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
    // 跑酷創作模式：自製賽道最近一次的結果 { finished, message, steps }
    customCourseResult: null,
    // 本關失敗次數（換關歸零），用來漸進解鎖提示
    failCount: 0,
    // 最近一次執行的頂層變數快照（變數盒子）
    lastVariables: [],
    // 逐行追蹤：每一步 { line, calls, vars }；traceIndex 為 null 代表沒有在看某一步
    traceSteps: [],
    traceTruncated: false,
    traceIndex: null,
    isTracePlaying: false,
    traceTimer: null,
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
      this.clearTrace();
    },

    // ---- 逐行追蹤播放 ----
    setTrace(trace) {
      this.clearTrace();
      this.traceSteps = trace?.steps || [];
      this.traceTruncated = !!trace?.truncated;
    },

    clearTrace() {
      this.pauseTrace();
      this.traceSteps = [];
      this.traceTruncated = false;
      this.traceIndex = null;
    },

    pauseTrace() {
      if (this.traceTimer) {
        clearTimeout(this.traceTimer);
        this.traceTimer = null;
      }
      this.isTracePlaying = false;
    },

    /** 跳到第 index 步（0 起算）；null 代表離開逐步模式 */
    seekTrace(index) {
      if (index === null || this.traceSteps.length === 0) {
        this.traceIndex = null;
        return;
      }
      this.traceIndex = Math.max(0, Math.min(this.traceSteps.length - 1, index));
    },

    stepTrace(delta) {
      this.pauseTrace();
      const from = this.traceIndex === null ? (delta > 0 ? -1 : this.traceSteps.length) : this.traceIndex;
      this.seekTrace(from + delta);
    },

    /**
     * 從頭（或目前位置）開始播放。
     * @param {{ schedule?: number[], intervalMs?: number, maxMs?: number, fromStart?: boolean, exitAtEnd?: boolean }} options
     *   schedule：每一步距離開始的毫秒數（執行時跟 3D 對齊用）；沒給就每步固定 intervalMs
     *   exitAtEnd：播完自動離開逐步模式（執行時的自動跟跑用）
     */
    playTrace({ schedule = null, intervalMs = TRACE_MANUAL_STEP_MS, maxMs = Infinity, fromStart = false, exitAtEnd = false } = {}) {
      if (this.traceSteps.length === 0) return;
      this.pauseTrace();
      const atEnd = this.traceIndex === null || this.traceIndex >= this.traceSteps.length - 1;
      if (fromStart || atEnd) this.traceIndex = 0;
      const first = this.traceIndex;
      // 時間表以「目前這一步」為 0
      const times = schedule
        ? schedule.map((t) => t - schedule[first])
        : this.traceSteps.map((_, i) => (i - first) * intervalMs);
      this.isTracePlaying = true;
      const startedAt = Date.now();
      const finish = () => {
        this.pauseTrace();
        if (exitAtEnd) this.traceIndex = null;
      };
      const scheduleNext = () => {
        const next = this.traceIndex + 1;
        if (next >= this.traceSteps.length || times[next] > maxMs) {
          // 最後一步多停留一下再結束
          this.traceTimer = setTimeout(finish, Math.min(intervalMs, 600));
          return;
        }
        this.traceTimer = setTimeout(() => {
          this.traceIndex = next;
          scheduleNext();
        }, Math.max(0, times[next] - (Date.now() - startedAt)));
      };
      scheduleNext();
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
      this.customCourseResult = null;
    },

    /**
     * 跑酷創作模式：用學生目前的 decide 跑自己設計的賽道。
     * 不算通關、不給星，只看規則是不是夠通用。
     * @param {{ code: string, middle: string[] }} options middle：起點與終點之間的格子
     */
    async runCustomCourse({ code, middle }) {
      if (this.isExecuting || !isValidCustomMiddle(middle)) return null;
      const tiles = buildCustomCourse(middle);
      this.isExecuting = true;
      this.clearLogs();
      this.customCourseResult = null;
      try {
        soundManager.playLaunch();
      } catch (e) {}

      const precheck = precheckCode(code);
      if (precheck) {
        this.reportFailure(precheck, { delay: 0 });
        this.isExecuting = false;
        return precheck;
      }

      const traced = instrumentForTrace(code);
      const runRes = await sandboxRuntime.execute({
        code: traced ? traced.code : code,
        levelId: 9,
        initialData: { customCourse: tiles },
        onLog: (log) => {
          this.appendLog({ type: log.type === 'error' ? 'error' : 'info', message: `console.${log.type}: ${log.args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}` });
        },
        onApiCall: () => {}
      });
      if (!runRes.success) {
        this.setTrace(runRes.trace);
        this.reportFailure(buildRuntimeError(runRes, code), { delay: 0 });
        this.isExecuting = false;
        return this.lastRunResult;
      }
      this.lastVariables = runRes.variables || [];
      this.setTrace(runRes.trace);

      const call = (runRes.apiCalls || []).find((c) => c.api === 'runner.setAutoRun');
      const run = call?.runs?.find((r) => r.courseId === CUSTOM_COURSE_ID);
      if (!run) {
        this.customCourseResult = { finished: false, message: '沒有偵測到 runner.setAutoRun(decide)，記得在最後註冊你的函式。' };
        this.isExecuting = false;
        return this.customCourseResult;
      }

      if (this.sceneActionTrigger) {
        this.sceneActionTrigger('SET_COURSE', { tiles, courseId: CUSTOM_COURSE_ID });
        this.sceneActionTrigger('EXECUTE_START', { levelId: 9, payload: { apiCalls: runRes.apiCalls } });
      }
      const animDuration = Math.max(1200, run.frames.length * 450 + 250);
      if (this.traceSteps.length > 0) {
        const intervalMs = autoTraceInterval(animDuration, this.traceSteps.length);
        this.playTrace({ intervalMs, maxMs: animDuration + 1000, fromStart: true, exitAtEnd: true });
      }
      await new Promise((resolve) => setTimeout(resolve, animDuration));

      this.customCourseResult = run.finished
        ? { finished: true, message: `完賽！你的規則跑完了整條 ${tiles.length} 格的自製賽道。` }
        : { finished: false, message: describeFailure(run.fail, run.error) };
      try {
        if (run.finished) soundManager.playSuccess();
        else soundManager.playError();
      } catch (e) {}
      this.isExecuting = false;
      return this.customCourseResult;
    },

    /** 按下執行（各控制面板共用的入口） */
    requestRun(payload) {
      return this.executeLevel(payload);
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
        // 插樁後送進沙箱，才能逐行追蹤；插樁失敗就照原樣執行（行號不受影響）
        const traced = instrumentForTrace(payload.code);
        const runRes = await sandboxRuntime.execute({
          code: traced ? traced.code : payload.code,
          levelId: currentLevel.id,
          initialData: payload.initialData || {},
          onLog: (log) => {
            this.appendLog({ type: log.type === 'error' ? 'error' : 'info', message: `console.${log.type}: ${log.args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}` });
          },
          onApiCall: () => {}
        });

        if (!runRes.success) {
          // 出錯前跑過的步驟也留著，學生可以一步步看程式是怎麼走到出錯那一行的
          this.setTrace(runRes.trace);
          this.reportFailure(buildRuntimeError(runRes, payload.code));
          this.isExecuting = false;
          return this.lastRunResult;
        }
        this.lastVariables = runRes.variables || [];
        this.setTrace(runRes.trace);

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
        // 跑酷關：剛玩過創作模式的話，先換回訓練場 A
        if (currentLevel.id === 9) this.sceneActionTrigger('SET_COURSE', {});
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

      // 編輯器跟著 3D 動畫逐行亮起；步數太多時只播到動畫結束後一下就停
      if (this.traceSteps.length > 0) {
        const intervalMs = autoTraceInterval(animDuration, this.traceSteps.length);
        const actionMs = ACTION_MS_BY_LEVEL[currentLevel.id] || 0;
        this.playTrace({
          schedule: buildTraceSchedule(this.traceSteps, { actionMs, intervalMs }),
          intervalMs,
          maxMs: actionMs ? Infinity : Math.max(animDuration + 1000, 4000),
          fromStart: true,
          exitAtEnd: true
        });
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

