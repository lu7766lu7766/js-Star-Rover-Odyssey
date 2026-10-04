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
    }
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

    markLevelCompleted(levelId) {
      if (!this.completedLevels.includes(levelId)) {
        this.completedLevels.push(levelId);
      }
      const nextId = getNextLevelId(levelId);
      if (nextId !== null && !this.unlockedLevels.includes(nextId)) {
        this.unlockedLevels.push(nextId);
      }
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
        savedOperations: this.savedOperations
      });
    },

    exportSave() {
      exportSaveFile({
        version: 2,
        currentView: this.currentView,
        currentLevel: this.currentLevelId,
        unlockedLevels: this.unlockedLevels,
        completedLevels: this.completedLevels,
        savedOperations: this.savedOperations
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
      // Imported save may carry a level view; only honor it when unlocked.
      this.currentView = result.data.currentView === 'level' && this.unlockedLevels.includes(this.currentLevelId)
        ? 'level'
        : 'home';
      this.persist();
      return { success: true };
    }
  }
});
