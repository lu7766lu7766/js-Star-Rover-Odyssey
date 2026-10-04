/**
 * Star Rover Odyssey - Web Worker Sandbox
 * Runs student code in an isolated environment with restricted APIs
 *
 * 遊戲 API 的宣告與記錄在 ./gameApi.js（可在 Node / vitest 直接測試），
 * 這個檔案只負責 Worker 訊息收發、console 攔截與 L6 的 Mock DOM。
 */

import { MockDocument, MockElement } from './mockDOM.js';
import { MSG_TYPE } from './protocol.js';
import { createGameApi, runStudentCode } from './gameApi.js';

const workerSelf = self;

// Global state within worker instance
let currentMockDoc = null;
let recordedAPICalls = [];
let capturedLogs = [];

function postLog(type, args) {
  if (capturedLogs.length >= 100) return;
  const serialized = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.parse(JSON.stringify(arg));
      } catch {
        return String(arg);
      }
    }
    return arg;
  });
  capturedLogs.push({ type, args: serialized, time: Date.now() });
  workerSelf.postMessage({
    type: MSG_TYPE.CONSOLE_LOG,
    payload: { type, args: serialized }
  });
}

// Sandboxed console
const sandboxedConsole = {
  log: (...args) => postLog('log', args),
  warn: (...args) => postLog('warn', args),
  error: (...args) => postLog('error', args),
  info: (...args) => postLog('log', args)
};

// Safe assert function
function sandboxedAssert(condition, message = '斷言失敗') {
  if (!condition) {
    throw new Error(`[AssertionError] ${message}`);
  }
}

// L6 太空艙儀表板：預埋兩顆按鈕＋狀態燈＋氣閘門
function seedLevel6Dom(doc) {
  const seed = (id, tag, text, color) => {
    doc.elements[id] = new MockElement(id, tag, text, color, doc._onMutation);
  };
  seed('disarm-btn', 'button', '解除警報', '#00f2fe');
  seed('airlock-btn', 'button', '開啟氣閘', '#00f2fe');
  seed('status-indicator', 'div', '警報中 (ALARM)', 'red');
  seed('airlock-door', 'div', '氣閘關閉 (LOCKED)', 'gray');
}

workerSelf.onmessage = function (e) {
  const { type, payload } = e.data || {};

  if (type === MSG_TYPE.TRIGGER_EVENT) {
    const { targetId, eventType } = payload || {};
    if (currentMockDoc && currentMockDoc.elements[targetId]) {
      currentMockDoc.elements[targetId].dispatchEvent(eventType);
      workerSelf.postMessage({
        type: MSG_TYPE.DOM_MUTATION,
        payload: currentMockDoc.getSnapshot()
      });
    }
    return;
  }

  if (type === MSG_TYPE.GET_SNAPSHOT) {
    workerSelf.postMessage({
      type: MSG_TYPE.DOM_SNAPSHOT,
      payload: currentMockDoc ? currentMockDoc.getSnapshot() : null
    });
    return;
  }

  if (type === MSG_TYPE.EXECUTE) {
    const { code, levelId, initialData } = payload;
    recordedAPICalls = [];
    capturedLogs = [];

    currentMockDoc = new MockDocument((mutation) => {
      workerSelf.postMessage({
        type: MSG_TYPE.DOM_MUTATION,
        payload: currentMockDoc.getSnapshot()
      });
    });

    if (levelId === 6) {
      seedLevel6Dom(currentMockDoc);
    }

    // Game APIs exposed to student code（宣告表驅動，見 gameApi.js）
    const gameApi = createGameApi({
      calls: recordedAPICalls,
      emit: (apiPayload) => {
        workerSelf.postMessage({
          type: MSG_TYPE.GAME_API_CALL,
          payload: apiPayload
        });
      },
      initialData
    });

    try {
      // Execute student code in a restricted scope
      const result = runStudentCode(code, {
        console: sandboxedConsole,
        assert: sandboxedAssert,
        document: currentMockDoc,
        ...gameApi
      });

      // Execute student code, then flush async continuations (L8 async/await):
      // floating promises (e.g. evaluateAndLaunch()) resolve as microtasks,
      // so wait a macrotask beat before snapshotting apiCalls/logs.
      Promise.resolve(result)
        .catch(() => {})
        .then(() => new Promise((res) => setTimeout(res, 400)))
        .then(() => {
          workerSelf.postMessage({
            type: MSG_TYPE.EXECUTION_SUCCESS,
            payload: {
              result: null,
              logs: capturedLogs,
              apiCalls: recordedAPICalls,
              domState: currentMockDoc.getSnapshot()
            }
          });
        });
    } catch (err) {
      workerSelf.postMessage({
        type: MSG_TYPE.EXECUTION_ERROR,
        payload: {
          error: err.message || String(err),
          stack: err.stack,
          logs: capturedLogs,
          apiCalls: recordedAPICalls
        }
      });
    }
  }
};
