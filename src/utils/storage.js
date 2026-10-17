/**
 * Star Rover Odyssey 2.0 - Storage Utility
 * Manages LocalStorage persistence and JSON import/export
 * Stores unlocked levels, completed levels, and operation states (all levels in the registry).
 */

import { VALID_LEVEL_IDS } from '../levels/index.js';
import { isValidCustomMiddle } from '../game/sim/parkour.js';

const STORAGE_KEY = 'star_rover_odyssey_save_v2';
const isValidLevelId = (n) => VALID_LEVEL_IDS.includes(n);

export const DEFAULT_SAVE_DATA = {
  version: 2,
  currentView: 'home',
  currentLevel: 1,
  unlockedLevels: [1],
  savedOperations: {},
  completedLevels: [],
  levelStars: {},
  roverName: '',
  errorDex: {},
  predictionStats: { total: 0, correct: 0 },
  predictEveryRun: false,
  parsonsDone: {},
  parkourCourse: [],
  timestamp: Date.now()
};

/** 暖身完成紀錄：{ 關卡 id: true }，只保留合法關卡 */
function sanitizeLevelFlags(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, val] of Object.entries(raw)) {
    const id = Number(key);
    if (isValidLevelId(id) && val === true) out[id] = true;
  }
  return out;
}

/** 預測統計：{ total, correct }，correct 不可大於 total */
function sanitizePredictionStats(raw) {
  const total = Math.max(0, Math.floor(Number(raw?.total) || 0));
  const correct = Math.max(0, Math.min(total, Math.floor(Number(raw?.correct) || 0)));
  return { total, correct };
}

/** 星數：{ 關卡 id: 1~3 }，只保留合法關卡 */
function sanitizeLevelStars(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, val] of Object.entries(raw)) {
    const id = Number(key);
    const stars = Math.round(Number(val));
    if (isValidLevelId(id) && stars >= 1 && stars <= 3) out[id] = stars;
  }
  return out;
}

/** 錯誤圖鑑：{ 錯誤類型: 遇到次數 } */
function sanitizeErrorDex(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, val] of Object.entries(raw)) {
    const count = Math.floor(Number(val));
    if (/^[a-z-]{1,32}$/.test(key) && count > 0) out[key] = Math.min(count, 9999);
  }
  return out;
}

/**
 * Validates the save data structure
 * @param {any} data 
 * @returns {{ valid: boolean, error?: string, data?: object }}
 */
export function validateSaveData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '存檔內容非有效 JSON 物件' };
  }

  // Support version 1 and 2
  const version = typeof data.version === 'number' ? data.version : 1;
  if (version !== 1 && version !== 2) {
    return { valid: false, error: `不支援的存檔版本: ${data.version}` };
  }

  if (!Array.isArray(data.unlockedLevels) || data.unlockedLevels.length === 0) {
    return { valid: false, error: '存檔缺少解鎖關卡列表' };
  }
  if (!Array.isArray(data.completedLevels)) {
    return { valid: false, error: '存檔缺少完成關卡列表' };
  }

  // Ensure currentLevel is a known level id
  let currentLevel = typeof data.currentLevel === 'number' ? data.currentLevel : 1;
  if (!isValidLevelId(currentLevel)) currentLevel = 1;

  // Persist current view so refresh stays in the same level ('home' | 'level')
  let currentView = data.currentView === 'level' ? 'level' : 'home';

  // Sanitize savedOperations
  const savedOperations = (data.savedOperations && typeof data.savedOperations === 'object')
    ? data.savedOperations
    : (data.savedCode && typeof data.savedCode === 'object') ? data.savedCode : {};

  return {
    valid: true,
    data: {
      version: 2,
      currentView,
      currentLevel,
      unlockedLevels: Array.from(new Set(data.unlockedLevels.map(Number))).filter(isValidLevelId),
      completedLevels: Array.from(new Set(data.completedLevels.map(Number))).filter(isValidLevelId),
      savedOperations,
      levelStars: sanitizeLevelStars(data.levelStars),
      roverName: typeof data.roverName === 'string' ? data.roverName.trim().slice(0, 20) : '',
      errorDex: sanitizeErrorDex(data.errorDex),
      predictionStats: sanitizePredictionStats(data.predictionStats),
      predictEveryRun: data.predictEveryRun === true,
      parsonsDone: sanitizeLevelFlags(data.parsonsDone),
      parkourCourse: isValidCustomMiddle(data.parkourCourse) ? [...data.parkourCourse] : [],
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now()
    }
  };
}

/** 每次都給一份全新的預設存檔（淺拷貝會讓陣列、物件被不同存檔共用，改一個全部跟著變） */
function freshDefaultSave() {
  return JSON.parse(JSON.stringify({ ...DEFAULT_SAVE_DATA, timestamp: Date.now() }));
}

/**
 * Loads save data from LocalStorage
 * @returns {object} Valid save data
 */
export function loadSaveData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshDefaultSave();
    const parsed = JSON.parse(raw);
    const result = validateSaveData(parsed);
    if (result.valid) {
      return result.data;
    }
    console.warn('[Storage] Invalid saved data, falling back to default', result.error);
    return freshDefaultSave();
  } catch (err) {
    console.error('[Storage] Failed to read from localStorage:', err);
    return freshDefaultSave();
  }
}

/**
 * Saves data to LocalStorage
 * @param {object} data 
 * @returns {boolean}
 */
export function saveSaveData(data) {
  try {
    const payload = {
      ...data,
      version: 2,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('[Storage] Failed to write to localStorage:', err);
    return false;
  }
}

/**
 * Exports save data as a downloadable JSON file
 * @param {object} data 
 */
export function exportSaveFile(data) {
  const payload = {
    ...data,
    version: 2,
    timestamp: Date.now()
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `star-rover-save-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Reads and validates an imported JSON file
 * @param {File} file 
 * @returns {Promise<{ valid: boolean, data?: object, error?: string }>}
 */
export function importSaveFile(file) {
  return new Promise((resolve) => {
    if (!file || !file.name.endsWith('.json')) {
      return resolve({ valid: false, error: '請選擇 .json 格式的存檔檔案' });
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = JSON.parse(text);
        const validated = validateSaveData(parsed);
        resolve(validated);
      } catch (err) {
        resolve({ valid: false, error: '存檔解析失敗，非合法 JSON 內容' });
      }
    };
    reader.onerror = () => {
      resolve({ valid: false, error: '讀取檔案失敗' });
    };
    reader.readAsText(file);
  });
}
