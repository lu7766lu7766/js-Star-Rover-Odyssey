/**
 * Star Rover Odyssey 2.0 - All Levels Registry
 *
 * 關卡的 `id` 是穩定的資料鍵（存檔、場景、驗證都靠它），**不等於課程順序**。
 * 課程順序由 LEVEL_ORDER 決定：跑酷關（id 9）插在第 3 關與第 4 關之間，
 * 這樣既有學生的存檔（以 id 記錄進度）完全不需要遷移。
 */

import level1 from './level-1.js';
import level2 from './level-2.js';
import level3 from './level-3.js';
import level4 from './level-4.js';
import level5 from './level-5.js';
import level6 from './level-6.js';
import level7 from './level-7.js';
import level8 from './level-8.js';
import level9 from './level-9.js';

/** 課程順序（由第 1 關到最後一關的 level.id） */
export const LEVEL_ORDER = [1, 2, 3, 9, 4, 5, 6, 7, 8];

const LEVELS_BY_ID = new Map(
  [level1, level2, level3, level4, level5, level6, level7, level8, level9].map((lvl) => [lvl.id, lvl])
);

/** 依課程順序排列的所有關卡 */
export const ALL_LEVELS = LEVEL_ORDER.map((id) => LEVELS_BY_ID.get(id));

export function getLevelById(id) {
  const numericId = parseInt(id, 10);
  return LEVELS_BY_ID.get(numericId) || ALL_LEVELS[0];
}

/** 課程順序中的關卡編號（1 起算，用於畫面顯示）；找不到回傳 0 */
export function getLevelNumber(id) {
  return LEVEL_ORDER.indexOf(Number(id)) + 1;
}

/** 顯示用的兩位數編號，例如 04 */
export function formatLevelNumber(id) {
  return String(getLevelNumber(id)).padStart(2, '0');
}

/** 課程順序中的下一關 id；已是最後一關回傳 null */
export function getNextLevelId(id) {
  const idx = LEVEL_ORDER.indexOf(Number(id));
  if (idx === -1 || idx === LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1];
}

/** 所有合法的關卡 id（存檔驗證用） */
export const VALID_LEVEL_IDS = Object.freeze([...LEVEL_ORDER]);

export {
  level1,
  level2,
  level3,
  level4,
  level5,
  level6,
  level7,
  level8,
  level9
};
