/**
 * Star Rover Odyssey - Worker Sandbox Runtime Manager
 * Handles Worker lifecycle, message passing, timeouts, and error handling
 */

import { MSG_TYPE } from './protocol.js';
import { validateCodeInput, CODE_LIMITS } from '../utils/validation.js';

export class SandboxRuntime {
  constructor() {
    this.worker = null;
    this.isRunning = false;
    this.timeoutTimer = null;
    this.activeCallbacks = null;
  }

  initWorker() {
    if (this.worker) {
      this.terminateWorker();
    }
    this.worker = new Worker(new URL('./worker.js', import.meta.url), {
      type: 'module'
    });
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.worker.onerror = this.handleWorkerError.bind(this);
  }

  terminateWorker() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isRunning = false;
  }

  handleWorkerMessage(e) {
    const { type, payload } = e.data || {};
    const callbacks = this.activeCallbacks;

    switch (type) {
      case MSG_TYPE.CONSOLE_LOG:
        if (callbacks?.onLog) callbacks.onLog(payload);
        break;

      case MSG_TYPE.DOM_MUTATION:
        if (callbacks?.onDomMutation) callbacks.onDomMutation(payload);
        if (this._mutationWaiter) this._mutationWaiter.resolve(payload);
        break;

      case MSG_TYPE.DOM_SNAPSHOT:
        if (this._snapshotWaiter) this._snapshotWaiter.resolve(payload);
        break;

      case MSG_TYPE.GAME_API_CALL:
        if (callbacks?.onApiCall) callbacks.onApiCall(payload);
        break;

      case MSG_TYPE.EXECUTION_SUCCESS:
        this.clearExecutionTimer();
        this.isRunning = false;
        if (callbacks?.resolve) {
          callbacks.resolve({
            success: true,
            logs: payload.logs,
            apiCalls: payload.apiCalls,
            variables: payload.variables || [],
            domState: payload.domState,
            result: payload.result
          });
        }
        break;

      case MSG_TYPE.EXECUTION_ERROR:
        this.clearExecutionTimer();
        this.isRunning = false;
        if (callbacks?.resolve) {
          callbacks.resolve({
            success: false,
            error: payload.error,
            name: payload.name,
            stack: payload.stack,
            logs: payload.logs,
            apiCalls: payload.apiCalls
          });
        }
        break;
    }
  }

  handleWorkerError(err) {
    this.clearExecutionTimer();
    this.isRunning = false;
    if (this.activeCallbacks?.resolve) {
      this.activeCallbacks.resolve({
        success: false,
        error: `Worker 執行期異常: ${err.message || String(err)}`
      });
    }
  }

  clearExecutionTimer() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  /**
   * Executes student code in the sandboxed worker
   */
  execute(params) {
    const { code, levelId, initialData, onLog, onApiCall, onDomMutation } = params;

    // Validate code length
    const valResult = validateCodeInput(code);
    if (!valResult.valid) {
      return Promise.resolve({
        success: false,
        error: valResult.error
      });
    }

    if (this.isRunning) {
      return Promise.resolve({
        success: false,
        error: '程式正在執行中，請稍候...'
      });
    }

    this.isRunning = true;
    this.initWorker();

    return new Promise((resolve) => {
      this.activeCallbacks = {
        resolve,
        onLog,
        onApiCall,
        onDomMutation
      };

      // Set timeout guard
      this.timeoutTimer = setTimeout(() => {
        this.terminateWorker();
        resolve({
          success: false,
          error: `程式執行超時（超過 ${CODE_LIMITS.TIMEOUT_MS}ms）！可能包含無窮迴圈 while / for，已強制終止保護電腦。`
        });
      }, CODE_LIMITS.TIMEOUT_MS);

      // Post execution request to worker
      this.worker.postMessage({
        type: MSG_TYPE.EXECUTE,
        payload: {
          code,
          levelId,
          initialData
        }
      });
    });
  }

  /**
   * Triggers a synthetic event in Mock DOM
   */
  triggerEvent(targetId, eventType = 'click') {
    if (!this.worker) return;
    this.worker.postMessage({
      type: MSG_TYPE.TRIGGER_EVENT,
      payload: { targetId, eventType }
    });
  }

  /**
   * Triggers an event and waits for the resulting DOM mutation.
   * Resolves with the mutation snapshot, or null on timeout
   * (e.g. handler does nothing — caller should then getSnapshot()).
   */
  triggerEventAndWait(targetId, eventType = 'click', timeoutMs = 800) {
    if (!this.worker) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._mutationWaiter = null;
        resolve(null);
      }, timeoutMs);
      this._mutationWaiter = {
        resolve: (snap) => {
          clearTimeout(timer);
          this._mutationWaiter = null;
          resolve(snap);
        }
      };
      this.worker.postMessage({
        type: MSG_TYPE.TRIGGER_EVENT,
        payload: { targetId, eventType }
      });
    });
  }

  /**
   * Asks the worker for an authoritative DOM snapshot.
   */
  getSnapshot(timeoutMs = 800) {
    if (!this.worker) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._snapshotWaiter = null;
        resolve(null);
      }, timeoutMs);
      this._snapshotWaiter = {
        resolve: (snap) => {
          clearTimeout(timer);
          this._snapshotWaiter = null;
          resolve(snap);
        }
      };
      this.worker.postMessage({ type: MSG_TYPE.GET_SNAPSHOT, payload: {} });
    });
  }

  /**
   * L6 太空艙專用：跑學生程式碼，接著模擬「正確順序」
   * （先解除警報再開門）與「錯誤順序」（警報中直接開門）兩路點擊，
   * 回傳接線快照與兩路結果供 validate 純函式判定。
   */
  async runDomLevel(code, { onLog, onApiCall } = {}) {
    const first = await this.execute({ code, levelId: 6, onLog, onApiCall });
    if (!first.success) {
      return { success: false, error: first.error, name: first.name, stack: first.stack, logs: first.logs };
    }
    await this.triggerEventAndWait('disarm-btn', 'click');
    const afterDisarm = await this.getSnapshot();
    await this.triggerEventAndWait('airlock-btn', 'click');
    const afterCorrect = await this.getSnapshot();

    // 錯誤順序：全新狀態下警報未解除就開門，門必須保持關閉
    const second = await this.execute({ code, levelId: 6 });
    if (!second.success) {
      return { success: false, error: second.error, name: second.name, stack: second.stack, logs: first.logs };
    }
    await this.triggerEventAndWait('airlock-btn', 'click');
    const afterWrongOrder = await this.getSnapshot();

    return {
      success: true,
      apiCalls: first.apiCalls || [],
      logs: first.logs || [],
      variables: first.variables || [],
      wiring: first.domState || {},
      afterDisarm,
      afterCorrect,
      afterWrongOrder
    };
  }
}

export const sandboxRuntime = new SandboxRuntime();
