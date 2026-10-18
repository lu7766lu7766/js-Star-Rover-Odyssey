/**
 * Star Rover Odyssey - Sandbox Game API Registry
 *
 * 學生程式碼在 Worker 內能呼叫的「遊戲 API」都在這裡宣告。
 * 以前每個 API 都在 worker.js 手寫一遍 `recordedAPICalls.push + postMessage`，
 * 現在簡單的 API 用一張宣告表（命名空間 → 方法名 → 參數個數）統一處理，
 * 有額外行為的 API（setAutoPilot / scanner.pulse / fetchStation / runner.setAutoRun）才特別寫。
 *
 * 這個模組不依賴 Worker 全域（self / postMessage），所以 vitest 可以直接測試。
 */

import { BENCHMARK_STATION_DATA } from '../services/weatherService.js';
import { PARKOUR_COURSES, runCourse, isValidCustomCourse, CUSTOM_COURSE_ID } from '../game/sim/parkour.js';
import { stripCommentsAndStrings } from '../utils/codeAnalysis.js';
import { VISIBLE_PLANETS, HIDDEN_SYSTEMS, evaluatePulse, buildReport, toPlanetObject } from '../game/sim/scanner.js';

/** 轉成可以 postMessage 的純資料（函式之類的值無法複製） */
function toPlain(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return String(value);
  }
}

/** 記錄 scanner.pulse 的參數：range 保留 NaN（JSON 會變 null），另外記下屬性名稱方便抓拼錯 */
function snapshotPulseParams(params) {
  if (!params || typeof params !== 'object') return { value: toPlain(params), keys: [] };
  return {
    target: toPlain(params.target),
    range: typeof params.range === 'number' ? params.range : toPlain(params.range),
    mode: toPlain(params.mode),
    keys: Object.keys(params)
  };
}

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
 * @param {object} [ctx.hooks] 呼叫端用的內部掛鉤（不給學生程式碼），例如 L5 的 runHiddenScanSurvey
 * @returns {object} 可直接展開成學生程式碼全域的 API 物件
 */
export function createGameApi({ calls, emit = () => {}, initialData = {}, hooks = {} }) {
  /**
   * @param {string} api API 名稱，例如 'rover.moveForward'
   * @param {Array} args 記錄的參數
   * @param {{ extra?: object, payload?: object }} [opts] extra: 附加到 trace 的欄位；payload: 通知主執行緒的內容
   */
  // L5 隱藏星系考驗進行中時，脈衝改記在這裡；其他 API 呼叫一律不記（不能洩漏隱藏星系、也不能驅動 3D）
  let hiddenSink = null;

  const record = (api, args = [], { extra = {}, payload = { api, args } } = {}) => {
    if (hiddenSink) return;
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

  // L5：深空掃描雷達。學生的 scanPlanet 跑完後，worker 會呼叫 hooks.runHiddenScanSurvey
  // 拿同一個函式去掃隱藏星系（那時的脈衝只記在 hiddenSink，不進 apiCalls、不驅動 3D）
  let scanPlanets = VISIBLE_PLANETS;
  const scanner = {
    pulse: (params) => {
      const evaluation = evaluatePulse(params, scanPlanets);
      const snapshot = snapshotPulseParams(params);
      const distance = evaluation.planet?.distance;
      if (hiddenSink) {
        hiddenSink.push({ status: evaluation.status, params: snapshot, distance });
      } else {
        record('scanner.pulse', [snapshot], {
          extra: { status: evaluation.status, distance },
          payload: { api: 'scanner.pulse', args: [snapshot], status: evaluation.status }
        });
      }
      return buildReport(params, evaluation);
    }
  };

  rover.flyTo = (coords) => {
    record('rover.flyTo', [toPlain(coords)]);
  };

  hooks.runHiddenScanSurvey = (scanFn) => {
    const systems = [];
    try {
      for (const system of HIDDEN_SYSTEMS) {
        scanPlanets = system.planets;
        const planets = system.planets.map((planet) => {
          hiddenSink = [];
          let error = null;
          try {
            scanFn(toPlanetObject(planet));
          } catch (e) {
            error = e instanceof Error ? e.message : String(e);
          }
          const pulses = hiddenSink;
          const ok = !error && pulses.some((p) => p.status === 'OK' && p.params.target === planet.name);
          return { name: planet.name, distance: planet.distance, ok, error, pulses };
        });
        systems.push({ id: system.id, planets });
      }
    } finally {
      scanPlanets = VISIBLE_PLANETS;
      hiddenSink = null;
    }
    record('scanner.hiddenSurvey', [], {
      extra: { systems },
      payload: { api: 'scanner.hiddenSurvey' }
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

  // L9：太空站跑酷 — 在所有賽道（含隱藏賽道）上真跑學生的 decide 函式；
  // 創作模式傳入 initialData.customCourse 時，只跑學生自己設計的那一條
  const courses = isValidCustomCourse(initialData.customCourse)
    ? [{ id: CUSTOM_COURSE_ID, name: '自製賽道', visible: true, tiles: initialData.customCourse }]
    : PARKOUR_COURSES;
  const runner = {
    setAutoRun: (decideFn) => {
      const isFunction = typeof decideFn === 'function';
      let runs = null;
      if (isFunction) {
        runs = courses.map((course) => ({
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

  return { rover, drill, drones, droneFleet, fetchStation, drone, runner, scanner };
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
export function runStudentCode(code, globals, { onVariables, probe } = {}) {
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
  // 變數盒子：程式跑到最後時，把頂層 let / const / var 的值拍照回傳（加在程式碼後面，不影響行號）
  let body = code;
  if (typeof onVariables === 'function') {
    const decls = findTopLevelDeclarations(code);
    if (decls.length > 0) {
      names.push(CAPTURE_FN_NAME);
      values.push((snapshot) => onVariables(decls.map((d) => ({ ...d, ...describeValue(snapshot[d.name]) }))));
      const fields = decls.map((d) => `${d.name}: ${d.name}`).join(', ');
      body = `${code}\n;try { ${CAPTURE_FN_NAME}({ ${fields} }); } catch (__srErr) {}`;
    }
  }
  // 程式跑到最後時，把指定名稱的頂層函式交給呼叫端（例如 L5 拿 scanPlanet 去掃隱藏星系）
  if (probe && Array.isArray(probe.names) && typeof probe.callback === 'function') {
    names.push(PROBE_FN_NAME);
    values.push(probe.callback);
    const fields = probe.names
      .map((n) => `${n}: typeof ${n} === 'function' ? ${n} : undefined`)
      .join(', ');
    body = `${body}\n;try { ${PROBE_FN_NAME}({ ${fields} }); } catch (__srErr) {}`;
  }
  // eslint-disable-next-line no-new-func
  const executeFn = new Function(...names, `"use strict";\n${body}`);
  return executeFn(...values);
}

/**
 * new Function 會在學生程式碼前面多出幾行：
 * `function anonymous(參數\n) {\n` 兩行，加上我們的 `"use strict";` 一行。
 * 錯誤堆疊裡的行號要扣掉這個數字，才是學生在編輯器看到的行號。
 */
export const STUDENT_CODE_LINE_OFFSET = 3;

const CAPTURE_FN_NAME = '__srCaptureVars';
const PROBE_FN_NAME = '__srProbeFns';

/**
 * 找出最外層（不在任何 { } 或 ( ) 裡）用 let / const / var 宣告的變數名稱。
 * @returns {{ name: string, kind: 'let'|'const'|'var' }[]}
 */
export function findTopLevelDeclarations(code) {
  const stripped = stripCommentsAndStrings(code);
  const found = [];
  const seen = new Set();
  let depth = 0;
  const declRe = /^(let|const|var)\s+([A-Za-z_$][\w$]*)/;
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0 && (i === 0 || /[^\w$.]/.test(stripped[i - 1]))) {
      const m = stripped.slice(i, i + 80).match(declRe);
      if (m && !seen.has(m[2]) && m[2] !== CAPTURE_FN_NAME) {
        seen.add(m[2]);
        found.push({ name: m[2], kind: m[1] });
      }
    }
  }
  return found;
}

/** 逐行追蹤最多記幾步（太多步重播也看不完，還會拖慢執行） */
export const TRACE_STEP_LIMIT = 600;

const NOT_IN_SCOPE = Symbol('not-in-scope');

/**
 * 建立逐行追蹤的記錄器，搭配 utils/codeTracer.js 插樁後的程式碼使用。
 * @param {{ calls?: any[], hiddenValues?: any[], limit?: number }} options
 *   calls：遊戲 API 呼叫紀錄（記下每一步發生時已經呼叫了幾次 API）
 *   hiddenValues：不顯示在變數盒子的值（例如注入的 rover、drone 等 API 物件）
 */
export function createTraceRecorder({ calls = [], hiddenValues = [], limit = TRACE_STEP_LIMIT } = {}) {
  const steps = [];
  const hidden = new Set(hiddenValues);
  let truncated = false;
  let paused = false;

  // 取不到（不在作用域、還沒宣告）就當作看不到
  const safeGet = (getter) => {
    try {
      return getter();
    } catch (e) {
      return NOT_IN_SCOPE;
    }
  };

  const hook = (line, getVars) => {
    if (paused) return;
    if (steps.length >= limit) {
      truncated = true;
      return;
    }
    const vars = [];
    if (typeof getVars === 'function') {
      try {
        for (const [name, value] of Object.entries(getVars())) {
          if (value === NOT_IN_SCOPE || typeof value === 'function' || hidden.has(value)) continue;
          vars.push({ name, ...describeValue(value) });
        }
      } catch (e) {}
    }
    const last = steps[steps.length - 1];
    // 同一行連續記到兩次（例如迴圈第一圈）就合併，只更新變數
    if (last && last.line === line && last.calls === calls.length) {
      last.vars = vars;
      return;
    }
    steps.push({ line, calls: calls.length, vars });
  };

  return {
    hook,
    safeGet,
    steps,
    /** 暫停／恢復記錄（例如 L5 隱藏星系考驗時，不把那些步驟放進逐行重播） */
    setPaused(value) {
      paused = Boolean(value);
    },
    get truncated() {
      return truncated;
    }
  };
}

/** 把任意值描述成「型態 + 顯示文字」，給變數盒子顯示 */
export function describeValue(value) {
  let type = typeof value;
  if (value === null) type = 'null';
  else if (Array.isArray(value)) type = 'array';
  let display;
  try {
    if (type === 'string') display = JSON.stringify(value);
    else if (type === 'function') display = 'ƒ 函式';
    // 物件的鍵名去掉引號：{"battery":85} → {battery:85}，盒子裡能多放幾個欄位
    else if (type === 'object' || type === 'array') display = JSON.stringify(value).replace(/"([A-Za-z_$][\w$]*)":/g, '$1:');
    else display = String(value);
  } catch (e) {
    display = String(value);
  }
  if (display && display.length > 80) display = `${display.slice(0, 77)}...`;
  return { type, display };
}
