/**
 * Level 5 深空掃描模擬（純函式，Worker / 驗證 / 3D 場景共用）
 *
 * 規則：
 * - 掃描半徑 range 至少要等於星體距離（掃得到），最多只能多 RANGE_MARGIN（再大會過熱）
 * - 距離超過 HIGH_RES_DISTANCE 的星體要用 "HIGH"；近距離用 "HIGH" 會過曝，要用 "NORMAL"
 *
 * 因為三顆星的距離都不一樣，寫死一個 range 一定有某顆星失敗；
 * 隱藏星系再換一組距離，確認學生的函式真的是用 planet.distance 算出來的。
 */

/** range 最多可以比星體距離多幾單位 */
export const RANGE_MARGIN = 3;

/** 距離超過這個值要切 "HIGH" 解析度 */
export const HIGH_RES_DISTANCE = 15;

/** 3D 動畫：每一發脈衝的秒數、飛行秒數 */
export const PULSE_SECONDS = 1.0;
export const FLY_SECONDS = 1.8;
/** 動畫最長秒數：呼叫太多次時整段加速播放，3D 與逐行重播才不會脫節 */
export const MAX_ANIMATION_SECONDS = 12;

/**
 * 依 API 呼叫算出 3D 播放計畫（場景與 store 共用，兩邊才會同步）。
 * @param {{ api: string }[]} calls
 * @returns {{ speed: number, totalMs: number, startsMs: number[] }}
 *   speed：播放倍速；startsMs[k]：3D 開始第 k 個呼叫的毫秒數（最後一項是全部播完的時間）
 */
export function scanAnimationPlan(calls = []) {
  const seconds = calls.map((c) => (c.api === 'scanner.pulse' ? PULSE_SECONDS : c.api === 'rover.flyTo' ? FLY_SECONDS : 0));
  const total = seconds.reduce((a, b) => a + b, 0);
  const speed = total > MAX_ANIMATION_SECONDS ? total / MAX_ANIMATION_SECONDS : 1;
  const startsMs = [0];
  for (const sec of seconds) startsMs.push(startsMs[startsMs.length - 1] + (sec / speed) * 1000);
  return { speed, totalMs: (total / speed) * 1000, startsMs };
}

/** 訓練星系：學生程式碼裡宣告的三顆星（coords 是 3D 場景座標，與探測船的距離 = distance） */
export const VISIBLE_PLANETS = [
  { name: 'Kepler-A', distance: 8, coords: { x: -4.6, z: -6.55 } },
  { name: 'Kepler-B', distance: 14, coords: { x: 5.9, z: -12.7 } },
  { name: 'Kepler-C', distance: 21, coords: { x: -5.45, z: -20.28 } }
];

/** 隱藏星系：只在驗證時把學生的 scanPlanet 拿來跑，不公開 */
export const HIDDEN_SYSTEMS = [
  {
    id: 'H1',
    planets: [
      { name: 'Gliese-1', distance: 5, coords: { x: 3, z: -4 } },
      { name: 'Gliese-2', distance: 17, coords: { x: -8, z: -15 } },
      { name: 'Gliese-3', distance: 12, coords: { x: 7.2, z: -9.6 } }
    ]
  },
  {
    id: 'H2',
    planets: [
      { name: 'Vega-1', distance: 24, coords: { x: 14.4, z: -19.2 } },
      { name: 'Vega-2', distance: 10, coords: { x: -6, z: -8 } }
    ]
  }
];

/** 學生拿到的星體物件只有 name 與 distance（座標要掃到才知道） */
export function toPlanetObject(planet) {
  return { name: planet.name, distance: planet.distance };
}

/**
 * 判斷一發脈衝的結果。
 * @param {{ target?: any, range?: any, mode?: any } | any} params 學生傳進 scanner.pulse 的參數物件
 * @param {typeof VISIBLE_PLANETS} planets 這個星系的星體
 * @returns {{ status: string, planet: object|null }}
 *   status：OK / BAD_PARAMS / NO_TARGET / BAD_RANGE / TOO_SHORT / OVERHEAT / BAD_MODE / LOW_RES / OVEREXPOSED
 */
export function evaluatePulse(params, planets) {
  if (!params || typeof params !== 'object') return { status: 'BAD_PARAMS', planet: null };
  const planet = planets.find((p) => p.name === params.target) || null;
  if (!planet) return { status: 'NO_TARGET', planet: null };
  const { range, mode } = params;
  if (typeof range !== 'number' || Number.isNaN(range)) return { status: 'BAD_RANGE', planet };
  if (range < planet.distance) return { status: 'TOO_SHORT', planet };
  if (range > planet.distance + RANGE_MARGIN) return { status: 'OVERHEAT', planet };
  if (mode !== 'HIGH' && mode !== 'NORMAL') return { status: 'BAD_MODE', planet };
  const needHigh = planet.distance > HIGH_RES_DISTANCE;
  if (needHigh && mode !== 'HIGH') return { status: 'LOW_RES', planet };
  if (!needHigh && mode === 'HIGH') return { status: 'OVEREXPOSED', planet };
  return { status: 'OK', planet };
}

/** 回傳給學生程式的掃描報告 */
export function buildReport(params, { status, planet }) {
  const found = status === 'OK';
  return {
    target: params && typeof params === 'object' ? params.target : undefined,
    found,
    coords: found ? { ...planet.coords } : null
  };
}

/**
 * 把一次脈衝的失敗原因翻成學生看得懂的話。
 * @param {{ status: string, params: object, distance?: number }} pulse scanner.pulse 的紀錄
 */
export function describePulseFailure({ status, params = {}, distance }) {
  const { target, range, mode, keys = [] } = params;
  switch (status) {
    case 'BAD_PARAMS':
      return 'scanner.pulse(...) 括號裡要放一個參數物件，例如 { target: ..., range: ..., mode: ... }。';
    case 'NO_TARGET':
      return `雷達找不到名叫 ${JSON.stringify(target)} 的星體。target 要寫 planet.name，讓每次呼叫自動帶入那顆星的名字。`;
    case 'BAD_RANGE': {
      if (!keys.includes('range')) {
        return `${target} 的參數物件裡沒有 range 屬性（目前的屬性：${keys.join('、') || '無'}）。檢查屬性名稱有沒有拼錯。`;
      }
      if (typeof range === 'number') {
        return `${target} 的 range 算出來是 NaN（不是數字）。通常是讀了不存在的屬性，例如把 planet.distance 拼錯，讀到 undefined 再 + 2。`;
      }
      return `${target} 的 range 是 ${JSON.stringify(range)}，但半徑必須是數字。用 planet.distance（不加引號）讀出距離。`;
    }
    case 'TOO_SHORT':
      return `${target} 在 ${distance} 單位外，但 range 只有 ${range}，脈衝碰不到它！range 是不是寫死了？要從 planet.distance 算出來。`;
    case 'OVERHEAT':
      return `${target} 只在 ${distance} 單位外，range 卻開到 ${range}，雷達過熱！半徑最多只能比距離多 ${RANGE_MARGIN}，要從 planet.distance 算出來。`;
    case 'BAD_MODE':
      return `${target} 的 mode 是 ${JSON.stringify(mode)}，解析度只能是 "HIGH" 或 "NORMAL"（英文大寫、加引號）。`;
    case 'LOW_RES':
      return `${target} 在 ${distance} 單位外（超過 ${HIGH_RES_DISTANCE}），用 "NORMAL" 解析度看不清楚，params.mode 要改成 "HIGH"。`;
    case 'OVEREXPOSED':
      return `${target} 只在 ${distance} 單位外，用 "HIGH" 解析度會過曝。只有距離超過 ${HIGH_RES_DISTANCE} 的星體才切 "HIGH"。`;
    default:
      return '';
  }
}
