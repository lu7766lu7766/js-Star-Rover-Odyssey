/**
 * Star Rover Odyssey - Parkour Simulator (pure, deterministic)
 *
 * 太空站跑酷採「回合制離散模擬」：賽道是一排格子，每個 tick 探測車前進 1 格。
 * 學生寫 decide(ahead) 回傳 'run' | 'jump' | 'slide'，模擬器依「前方那一格」判定成敗。
 * 3D 場景只負責把每個 tick 做成流暢動畫；驗證、Worker、場景共用這份邏輯，
 * 因此結果可重現、可測試，也不會有兩份模擬不一致的問題。
 */

export const TILE = Object.freeze({
  GROUND: 'ground',
  GAP: 'gap',
  LOW: 'low',
  HIGH: 'high',
  FINISH: 'finish'
});

export const ACTION = Object.freeze({
  RUN: 'run',
  JUMP: 'jump',
  SLIDE: 'slide'
});

/** 每種地形「唯一」正確的動作 */
export const REQUIRED_ACTION = Object.freeze({
  [TILE.GROUND]: ACTION.RUN,
  [TILE.GAP]: ACTION.JUMP,
  [TILE.LOW]: ACTION.JUMP,
  [TILE.HIGH]: ACTION.SLIDE,
  [TILE.FINISH]: ACTION.RUN
});

export const TILE_LABEL = Object.freeze({
  [TILE.GROUND]: '平地',
  [TILE.GAP]: '缺口',
  [TILE.LOW]: '低矮障礙',
  [TILE.HIGH]: '高空橫桿',
  [TILE.FINISH]: '終點'
});

export const FAIL_REASON = Object.freeze({
  FALL: 'FALL', // 沒跳就踩進缺口
  TRIP: 'TRIP', // 沒跳就撞上低矮障礙
  HIT: 'HIT', // 沒滑就撞上高空橫桿
  WASTED: 'WASTED', // 平地亂跳 / 亂滑，失去平衡
  INVALID: 'INVALID', // decide 沒回傳合法動作
  ERROR: 'ERROR' // decide 執行時拋出例外
});

const t = (str) => str.split(' ');

/**
 * 賽道：每個陣列元素是一格，開頭為起點（ground），結尾必須是 finish。
 * A 為學生看得到的賽道；B / C / D 是隱藏賽道，用來驗證邏輯是否「通用」。
 */
export const PARKOUR_COURSES = Object.freeze([
  {
    id: 'A',
    name: '賽道 A（訓練場）',
    visible: true,
    tiles: t('ground ground gap ground low ground high ground gap low high ground ground finish')
  },
  {
    id: 'B',
    name: '賽道 B（隱藏）',
    visible: false,
    tiles: t('ground high high ground gap gap ground low low ground high gap ground finish')
  },
  {
    id: 'C',
    name: '賽道 C（隱藏）',
    visible: false,
    tiles: t('ground low gap low ground high low high ground gap high low ground ground finish')
  },
  {
    id: 'D',
    name: '賽道 D（隱藏）',
    visible: false,
    tiles: t('ground gap high low gap ground ground high gap low ground high low gap ground finish')
  }
]);

export function getCourse(id) {
  return PARKOUR_COURSES.find((c) => c.id === id) || null;
}

/** 回傳「在 tile 上做出 action」的結果；null 代表安全 */
export function judgeStep(tile, action) {
  const required = REQUIRED_ACTION[tile];
  if (required === undefined) return FAIL_REASON.INVALID;
  if (action === required) return null;
  if (tile === TILE.GAP) return FAIL_REASON.FALL;
  if (tile === TILE.LOW) return FAIL_REASON.TRIP;
  if (tile === TILE.HIGH) return FAIL_REASON.HIT;
  return FAIL_REASON.WASTED;
}

/**
 * 在一條賽道上跑 decide。
 *
 * @param {string[]} tiles 賽道格子
 * @param {(ahead: string) => any} decide 學生的決策函式
 * @returns {{
 *   finished: boolean,
 *   frames: Array<{ tick: number, x: number, ahead: string, action: any, ok: boolean, reason: string|null }>,
 *   fail: null | { tick: number, x: number, ahead: string, action: any, reason: string },
 *   error: string|null
 * }}
 */
export function runCourse(tiles, decide) {
  const frames = [];
  let x = 0; // 目前站的格子（起點）
  let tick = 0;
  const lastIndex = tiles.length - 1;

  while (x < lastIndex) {
    tick++;
    const ahead = tiles[x + 1];
    let action;
    try {
      action = decide(ahead);
    } catch (e) {
      const message = e && e.message ? e.message : String(e);
      const frame = { tick, x, ahead, action: null, ok: false, reason: FAIL_REASON.ERROR };
      frames.push(frame);
      return {
        finished: false,
        frames,
        fail: { tick, x, ahead, action: null, reason: FAIL_REASON.ERROR },
        error: message
      };
    }

    const isValidAction = action === ACTION.RUN || action === ACTION.JUMP || action === ACTION.SLIDE;
    const reason = isValidAction ? judgeStep(ahead, action) : FAIL_REASON.INVALID;
    const ok = reason === null;
    frames.push({ tick, x, ahead, action, ok, reason });

    if (!ok) {
      return {
        finished: false,
        frames,
        fail: { tick, x, ahead, action, reason },
        error: null
      };
    }
    x += 1;
  }

  return { finished: true, frames, fail: null, error: null };
}

/** 把一次失敗轉成學生看得懂的中文說明 */
export function describeFailure(fail, error = null) {
  if (!fail) return '';
  const label = TILE_LABEL[fail.ahead] || fail.ahead;
  const shown = typeof fail.action === 'string' ? `'${fail.action}'` : String(fail.action);
  const head = `第 ${fail.tick} 步，前方是【${label}】（ahead === '${fail.ahead}'），你的 decide 回傳了 ${shown}`;
  switch (fail.reason) {
    case FAIL_REASON.FALL:
      return `${head}，探測車一腳踩空掉進虛空！缺口要用 'jump' 跳過去。`;
    case FAIL_REASON.TRIP:
      return `${head}，探測車被低矮障礙絆倒！低矮障礙要用 'jump' 跳過去。`;
    case FAIL_REASON.HIT:
      return `${head}，探測車撞上高空橫桿！高空橫桿要用 'slide' 滑過去。`;
    case FAIL_REASON.WASTED:
      return `${head}，在平地做多餘的特技失去平衡！平地（與終點前）用 'run' 就好。`;
    case FAIL_REASON.INVALID:
      return `${head}，這不是合法動作！decide 只能回傳 'run'、'jump' 或 'slide'（字串要加引號，也別忘了 return）。`;
    case FAIL_REASON.ERROR:
      return `第 ${fail.tick} 步執行 decide 時出錯：${error || '未知錯誤'}。請檢查函式內容（是否還有 ___ 沒填？）。`;
    default:
      return head;
  }
}
