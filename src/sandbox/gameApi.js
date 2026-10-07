/**
 * Star Rover Odyssey - Sandbox Game API Registry
 *
 * 學生程式碼在 Worker 內能呼叫的「遊戲 API」都在這裡宣告。
 * 以前每個 API 都在 worker.js 手寫一遍 `recordedAPICalls.push + postMessage`，
 * 現在簡單的 API 用一張宣告表（命名空間 → 方法名 → 參數個數）統一處理，
 * 有額外行為的 API（setAutoPilot / installModule / fetchStation / runner.setAutoRun）才特別寫。
 *
 * 這個模組不依賴 Worker 全域（self / postMessage），所以 vitest 可以直接測試。
 */

import { BENCHMARK_STATION_DATA } from '../services/weatherService.js';
import { PARKOUR_COURSES, runCourse } from '../game/sim/parkour.js';

/** 簡單 API：僅記錄呼叫（命名空間 → { 方法名: 參數個數 }） */
export const SIMPLE_API_TABLE = Object.freeze({
  rover: {
    setup: 3,
    moveForward: 0,
    moveBackward: 0,
    turnLeft: 0,
    turnRight: 0,
    launch: 1,
    approachStation: 1
  },
  drill: { dig: 1 },
  droneFleet: { deploy: 1 },
  drone: { launch: 1, abortMission: 0 }
});

/** 學生程式碼不能碰的全域（以 undefined 遮蔽；嚴格模式不允許遮蔽 eval / arguments） */
export const BLOCKED_GLOBALS = Object.freeze([
  'window',
  'self',
  'globalThis',
  'fetch',
  'XMLHttpRequest',
  'importScripts',
  'Function',
  'postMessage', // 擋掉偽造 EXECUTION_SUCCESS 之類的 Worker 訊息
  'onmessage',
  'close',
  'WebSocket',
  'EventSource',
  'BroadcastChannel',
  'Worker',
  'indexedDB',
  'caches'
]);

const DEFAULT_DRONES = [
  { id: 'DRONE-01', name: '游隼號', battery: 85, model: 'Recon-X' },
  { id: 'DRONE-02', name: '夜梟號', battery: 15, model: 'Stealth-V' },
  { id: 'DRONE-03', name: '海鵰號', battery: 92, model: 'Heavy-T' },
  { id: 'DRONE-04', name: '雀鷹號', battery: 12, model: 'Scout-M' }
];

/**
 * 建立學生可用的全域 API。
 *
 * @param {object} ctx
 * @param {Array} ctx.calls 記錄所有 API 呼叫的陣列（apiCalls trace，由呼叫端持有）
 * @param {(payload: object) => void} [ctx.emit] 每次 API 呼叫時通知主執行緒（Worker 用 postMessage）
 * @param {object} [ctx.initialData] 關卡初始資料（例如 L7 的 drones）
 * @returns {object} 可直接展開成學生程式碼全域的 API 物件
 */
export function createGameApi({ calls, emit = () => {}, initialData = {} }) {
  /**
   * @param {string} api API 名稱，例如 'rover.moveForward'
   * @param {Array} args 記錄的參數
   * @param {{ extra?: object, payload?: object }} [opts] extra: 附加到 trace 的欄位；payload: 通知主執行緒的內容
   */
  const record = (api, args = [], { extra = {}, payload = { api, args } } = {}) => {
    calls.push({ api, args, ...extra });
    emit(payload);
  };

  const namespaces = {};
  for (const [ns, methods] of Object.entries(SIMPLE_API_TABLE)) {
    namespaces[ns] = {};
    for (const [name, arity] of Object.entries(methods)) {
      namespaces[ns][name] = (...given) => {
        record(`${ns}.${name}`, Array.from({ length: arity }, (_, i) => given[i]));
      };
    }
  }

  const { rover, drill, droneFleet, drone } = namespaces;

  // L3：自動導航函式，用可見情境 + 隱藏邊界真跑（驗 < / <= 觀念）
  rover.setAutoPilot = (pilotFn) => {
    const isFunction = typeof pilotFn === 'function';
    let testResults = null;
    let fnError = null;
    if (isFunction) {
      try {
        testResults = {
          3: pilotFn(3),
          5: pilotFn(5),
          7: pilotFn(7),
          10: pilotFn(10),
          15: pilotFn(15),
          20: pilotFn(20),
          30: pilotFn(30)
        };
      } catch (e) {
        fnError = e.message;
      }
    }
    record('rover.setAutoPilot', [isFunction ? '[Function]' : pilotFn], {
      extra: { testResults, fnError, isFunction },
      payload: { api: 'rover.setAutoPilot', testResults, isFunction }
    });
  };

  // L5：安裝模組物件並真的呼叫 activate()
  rover.installModule = (moduleObj) => {
    let activateResult = null;
    let activateError = null;
    const hasActivate = typeof moduleObj?.activate === 'function';
    if (hasActivate) {
      try {
        activateResult = moduleObj.activate();
      } catch (e) {
        activateError = e.message;
      }
    }
    const summary = {
      name: moduleObj?.name,
      range: moduleObj?.range,
      mode: moduleObj?.mode,
      activateResult,
      hasActivate
    };
    record('rover.installModule', [{ ...summary, activateError }], {
      payload: { api: 'rover.installModule', args: [summary] }
    });
  };

  // L7：無人機初始資料集
  const drones = initialData?.drones || DEFAULT_DRONES.map((d) => ({ ...d }));

  // L8：模擬氣象 API（離線教學 async/await + JSON 路徑）
  const fetchStation = async (stationId) => {
    record('fetchStation', [stationId]);
    const bench = BENCHMARK_STATION_DATA[stationId];
    if (!bench) {
      throw new Error(`未知觀測站 "${stationId}"！可用：station-tpe / station-tyo / station-lon / station-dxb / station-rkv`);
    }
    return JSON.parse(JSON.stringify(bench));
  };

  // L9：太空站跑酷 — 在所有賽道（含隱藏賽道）上真跑學生的 decide 函式
  const runner = {
    setAutoRun: (decideFn) => {
      const isFunction = typeof decideFn === 'function';
      let runs = null;
      if (isFunction) {
        runs = PARKOUR_COURSES.map((course) => ({
          courseId: course.id,
          visible: course.visible,
          ...runCourse(course.tiles, decideFn)
        }));
      }
      record('runner.setAutoRun', [isFunction ? '[Function]' : decideFn], {
        extra: { isFunction, runs },
        payload: { api: 'runner.setAutoRun', isFunction }
      });
    }
  };

  return { rover, drill, drones, droneFleet, fetchStation, drone, runner };
}

/**
 * 在受限的全域下執行學生程式碼。
 * 注意：這是「防呆」不是「防駭」——`(() => {}).constructor` 之類的逃逸手法仍可能存在，
 * 真正的隔離來自 Worker（沒有 DOM / cookie / 主執行緒狀態）。
 *
 * @param {string} code 學生程式碼
 * @param {Record<string, any>} globals 要注入的全域（console / assert / document / 遊戲 API …）
 * @returns {any} 學生程式碼的回傳值（可能是 Promise）
 */
export function runStudentCode(code, globals) {
  // 若學生程式碼在頂層自行宣告了同名變數（如 const drones = [...]），
  // 該名稱不應作為 Function 參數傳入，否則會觸發 JS SyntaxError: Identifier '...' has already been declared
  const declaredInCode = new Set(
    (code.match(/\b(?:const|let|var|function\*?|class)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/g) || [])
      .map((m) => m.replace(/^(?:const|let|var|function\*?|class)\s+/, '').trim())
  );
  const injected = Object.keys(globals).filter((name) => !declaredInCode.has(name));
  const blocked = BLOCKED_GLOBALS.filter((name) => !(name in globals) && !declaredInCode.has(name));
  const names = [...injected, ...blocked];
  const values = names.map((name) => globals[name]); // blocked 的值為 undefined
  // eslint-disable-next-line no-new-func
  const executeFn = new Function(...names, `"use strict";\n${code}`);
  return executeFn(...values);
}
