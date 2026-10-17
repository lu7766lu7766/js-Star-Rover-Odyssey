/**
 * Star Rover Odyssey 2.0 - Progress Store (Pinia)
 * Manages game views (Home Map vs Level Workspace), level progression (1..8),
 * operation state caching, sound settings, and developer mode.
 */

import { defineStore } from 'pinia';
import { loadSaveData, saveSaveData, exportSaveFile, importSaveFile, DEFAULT_SAVE_DATA } from '../utils/storage.js';
import { ALL_LEVELS, getNextLevelId } from '../levels/index.js';

// 跑酷關（id 9）後來才插入第 3、4 關之間；
// 舊存檔若已解鎖原本的第 4 關（id 4），代表早就過了第 3 關，補解鎖跑酷關避免被擋在外面。
const PARKOUR_LEVEL_ID = 9;
const LEVEL_AFTER_PARKOUR_ID = 4;

export function migrateUnlockedLevels(unlocked) {
  const list = Array.isArray(unlocked) ? [...unlocked] : [1];
  if (list.includes(LEVEL_AFTER_PARKOUR_ID) && !list.includes(PARKOUR_LEVEL_ID)) {
    list.push(PARKOUR_LEVEL_ID);
  }
  return list;
}

let debounceSaveTimer = null;

export const useProgressStore = defineStore('progress', {
  state: () => {
    const loaded = loadSaveData();
    // Refresh should stay in the same level: restore view only if the saved
    // level is still unlocked, otherwise fall back to home.
    const unlocked = migrateUnlockedLevels(loaded.unlockedLevels || [1]);
    const restoredView = loaded.currentView === 'level' && unlocked.includes(loaded.currentLevel || 1)
      ? 'level'
      : 'home';
    return {
      currentView: restoredView, // 'home' | 'level' (persisted for refresh restore)
      currentLevelId: loaded.currentLevel || 1,
      unlockedLevels: unlocked,
      completedLevels: loaded.completedLevels || [],
      savedOperations: loaded.savedOperations || {},
      // 每關最佳星數 { 關卡 id: 1~3 }
      levelStars: loaded.levelStars || {},
      // 第 1 關取的船名，之後每關沿用
      roverName: loaded.roverName || '',
      // 錯誤圖鑑 { 錯誤類型: 遇到次數 }
      errorDex: loaded.errorDex || {},
      // 跑酷創作模式：學生設計的賽道（起點與終點之間的格子）
      parkourCourse: loaded.parkourCourse || [],
      // 暖身排排看完成的關卡 { 關卡 id: true }
      parsonsDone: loaded.parsonsDone || {},
      // 執行前預測的統計 { total, correct }
      predictionStats: loaded.predictionStats || { total: 0, correct: 0 },
      // 勾選後每次執行前都要預測（預設只有每關第一次）
      predictEveryRun: !!loaded.predictEveryRun,
      isDeveloperMode: false,
      isSoundMuted: localStorage.getItem('star_rover_sound_muted') === 'true',
      // 教室電腦老舊，預設開啟低效能模式（除非使用者明確關過）
      isLowPerformanceMode: localStorage.getItem('star_rover_low_perf') !== 'false'
    };
  },

  getters: {
    isLevelUnlocked: (state) => (levelId) => {
      if (state.isDeveloperMode) return true;
      return state.unlockedLevels.includes(levelId);
    },
    isLevelCompleted: (state) => (levelId) => {
      return state.completedLevels.includes(levelId);
    },
    getSavedOperation: (state) => (levelId) => {
      return state.savedOperations[levelId] || null;
    },
    totalLevels: () => ALL_LEVELS.length,
    progressPercentage: (state) => {
      return Math.round((state.completedLevels.length / ALL_LEVELS.length) * 100);
    },
    getLevelStars: (state) => (levelId) => state.levelStars[levelId] || 0,
    isParsonsDone: (state) => (levelId) => !!state.parsonsDone[levelId],
    totalStars: (state) => Object.values(state.levelStars).reduce((sum, n) => sum + n, 0),
    maxStars: () => ALL_LEVELS.length * 3
  },

  actions: {
    setView(viewName) {
      this.currentView = viewName;
      this.persist();
    },

    goToLevel(levelId) {
      if (this.isLevelUnlocked(levelId)) {
        this.currentLevelId = levelId;
        this.currentView = 'level';
        this.persist();
      }
    },

    goToHome() {
      this.currentView = 'home';
      this.persist();
    },

    saveOperation(levelId, data) {
      this.savedOperations[levelId] = data;
      if (debounceSaveTimer) clearTimeout(debounceSaveTimer);
      debounceSaveTimer = setTimeout(() => {
        this.persist();
      }, 400);
    },

    clearSavedOperation(levelId) {
      if (this.savedOperations[levelId]) {
        delete this.savedOperations[levelId];
        this.persist();
      }
    },

    markLevelCompleted(levelId, stars = 0) {
      if (!this.completedLevels.includes(levelId)) {
        this.completedLevels.push(levelId);
      }
      const earned = Math.max(0, Math.min(3, Math.round(Number(stars) || 0)));
      if (earned > (this.levelStars[levelId] || 0)) {
        this.levelStars[levelId] = earned;
      }
      const nextId = getNextLevelId(levelId);
      if (nextId !== null && !this.unlockedLevels.includes(nextId)) {
        this.unlockedLevels.push(nextId);
      }
      this.persist();
    },

    setRoverName(name) {
      const clean = typeof name === 'string' ? name.trim().slice(0, 20) : '';
      if (clean && clean !== this.roverName) {
        this.roverName = clean;
        this.persist();
      }
    },

    setParkourCourse(middle) {
      this.parkourCourse = [...middle];
      this.persist();
    },

    markParsonsDone(levelId) {
      if (this.parsonsDone[levelId]) return;
      this.parsonsDone[levelId] = true;
      this.persist();
    },

    recordPrediction(correct) {
      this.predictionStats.total++;
      if (correct) this.predictionStats.correct++;
      this.persist();
    },

    setPredictEveryRun(value) {
      this.predictEveryRun = !!value;
      this.persist();
    },

    recordError(type) {
      if (!type) return;
      this.errorDex[type] = (this.errorDex[type] || 0) + 1;
      this.persist();
    },

    toggleSound() {
      this.isSoundMuted = !this.isSoundMuted;
      localStorage.setItem('star_rover_sound_muted', String(this.isSoundMuted));
      return this.isSoundMuted;
    },

    toggleLowPerformanceMode() {
      this.isLowPerformanceMode = !this.isLowPerformanceMode;
      localStorage.setItem('star_rover_low_perf', String(this.isLowPerformanceMode));
      return this.isLowPerformanceMode;
    },

    applyCheatCode(code) {
      if (code && code.trim() === 'jaccis666') {
        this.isDeveloperMode = !this.isDeveloperMode;
        if (this.isDeveloperMode) {
          this.unlockedLevels = ALL_LEVELS.map(l => l.id);
        }
        return {
          success: true,
          mode: this.isDeveloperMode,
          message: this.isDeveloperMode 
            ? '🚀 金手指已啟動！已開啟教師/全關卡解鎖模式！' 
            : '🔒 開發者模式已關閉，切回學生漸進探索模式。'
        };
      }
      return { success: false, message: '無效的指令代碼。' };
    },

    persist() {
      saveSaveData({
        version: 2,
        currentView: this.currentView,
        currentLevel: this.currentLevelId,
        unlockedLevels: this.unlockedLevels,
        completedLevels: this.completedLevels,
        savedOperations: this.savedOperations,
        levelStars: this.levelStars,
        roverName: this.roverName,
        errorDex: this.errorDex,
        predictionStats: this.predictionStats,
        predictEveryRun: this.predictEveryRun,
        parsonsDone: this.parsonsDone,
        parkourCourse: this.parkourCourse
      });
    },

    exportSave() {
      exportSaveFile({
        version: 2,
        currentView: this.currentView,
        currentLevel: this.currentLevelId,
        unlockedLevels: this.unlockedLevels,
        completedLevels: this.completedLevels,
        savedOperations: this.savedOperations,
        levelStars: this.levelStars,
        roverName: this.roverName,
        errorDex: this.errorDex,
        predictionStats: this.predictionStats,
        predictEveryRun: this.predictEveryRun,
        parsonsDone: this.parsonsDone,
        parkourCourse: this.parkourCourse
      });
    },

    async importSave(file) {
      const result = await importSaveFile(file);
      if (!result.valid) {
        return { success: false, error: result.error };
      }
      this.currentLevelId = result.data.currentLevel;
      this.unlockedLevels = migrateUnlockedLevels(result.data.unlockedLevels);
      this.completedLevels = result.data.completedLevels;
      this.savedOperations = result.data.savedOperations || {};
      this.levelStars = result.data.levelStars || {};
      this.roverName = result.data.roverName || '';
      this.errorDex = result.data.errorDex || {};
      this.predictionStats = result.data.predictionStats || { total: 0, correct: 0 };
      this.predictEveryRun = !!result.data.predictEveryRun;
      this.parsonsDone = result.data.parsonsDone || {};
      this.parkourCourse = result.data.parkourCourse || [];
      // Imported save may carry a level view; only honor it when unlocked.
      this.currentView = result.data.currentView === 'level' && this.unlockedLevels.includes(this.currentLevelId)
        ? 'level'
        : 'home';
      this.persist();
      return { success: true };
    }
  }
});
