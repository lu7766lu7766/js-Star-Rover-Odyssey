<template>
  <header class="level-topbar">
    <div class="topbar-left">
      <!-- Back to Map Button -->
      <button class="btn btn-outline btn-sm nav-back-btn" @click="progressStore.goToHome" title="返回星圖地圖">
        <Map :size="16" class="text-brand" />
        <span>星圖導航</span>
      </button>

      <!-- Level Switcher -->
      <div class="level-indicator">
        <select
          :value="currentLevel.id"
          @change="handleLevelChange($event.target.value)"
          class="level-select"
        >
          <option
            v-for="lvl in ALL_LEVELS"
            :key="lvl.id"
            :value="lvl.id"
            :disabled="!progressStore.isLevelUnlocked(lvl.id)"
          >
            Level {{ getLevelNumber(lvl.id) }}: {{ lvl.title }} {{ progressStore.isLevelCompleted(lvl.id) ? '✓' : (!progressStore.isLevelUnlocked(lvl.id) ? '🔒' : '') }}
          </option>
        </select>
        <span class="concept-badge badge badge-blue hide-mobile">{{ currentLevel.subtitle }}</span>
      </div>
    </div>

    <div class="topbar-right">
      <!-- Stepwise Hints -->
      <button class="btn btn-outline btn-sm" @click="levelStore.toggleHintModal" title="分步提示">
        <HelpCircle :size="16" class="text-warning" />
        <span>任務提示 ({{ currentLevel.hints?.length || 0 }})</span>
      </button>

      <!-- Sound Toggle -->
      <button class="btn btn-ghost btn-sm" @click="toggleSound" :title="progressStore.isSoundMuted ? '開啟音效' : '靜音'">
        <VolumeX v-if="progressStore.isSoundMuted" :size="17" class="text-muted" />
        <Volume2 v-else :size="17" class="text-brand" />
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { Map, HelpCircle, Volume2, VolumeX } from 'lucide-vue-next';
import { ALL_LEVELS, getLevelNumber } from '../../levels/index.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { useLevelStore } from '../../stores/levelStore.js';
import { soundManager } from '../../game/core/SoundManager.js';

const progressStore = useProgressStore();
const levelStore = useLevelStore();

const currentLevel = computed(() => levelStore.currentLevel);

function handleLevelChange(val) {
  const id = parseInt(val, 10);
  if (id && progressStore.isLevelUnlocked(id)) {
    soundManager.playClick();
    progressStore.goToLevel(id);
  }
}

function toggleSound() {
  const muted = progressStore.toggleSound();
  soundManager.setMuted(muted);
}
</script>

<style scoped>
.level-topbar {
  height: 56px;
  min-height: 56px;
  background: var(--bg-panel-glass);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  z-index: 40;
  box-shadow: var(--shadow-sm);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.nav-back-btn {
  font-weight: 700;
}

.level-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.level-select {
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-medium);
  background: #ffffff;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--text-primary);
  outline: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.level-select:focus {
  border-color: var(--primary-blue);
  box-shadow: 0 0 0 3px var(--primary-blue-light);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .hide-mobile {
    display: none;
  }
}
</style>
