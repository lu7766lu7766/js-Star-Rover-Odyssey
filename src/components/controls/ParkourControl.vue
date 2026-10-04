<template>
  <div class="control-panel">
    <!-- Header -->
    <div class="deck-header">
      <div class="deck-title-group">
        <Zap :size="18" class="text-brand" />
        <h3 class="deck-title">太空站跑酷 · 即時決策實戰 (Conditionals)</h3>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="resetDefaults" title="還原場景與參數至最初狀態">
          <RotateCcw :size="14" />
          <span>還原</span>
        </button>
      </div>
    </div>

    <div class="deck-content">
      <!-- Code Editor Section -->
      <div class="code-mode-card card">
        <div class="code-mode-header">
          <div class="code-mode-title">
            <Code :size="15" class="text-brand" />
            <span>手寫 JS 挑戰 · 補完 decide(ahead)</span>
          </div>
          <span class="badge badge-info">通關 4 賽道 = 2~3星</span>
        </div>

        <div class="code-editor-wrap">
          <CodeEditor v-model="studentCode" :level-id="9" @reset="resetCode" />
        </div>

        <div class="code-mode-actions">
          <button
            class="btn btn-success execute-btn"
            :disabled="levelStore.isExecuting || !studentCode.trim()"
            @click="runCodeExecution"
          >
            <Play :size="16" />
            <span>{{ levelStore.isExecuting ? '跑酷模擬中...' : '執行 JS 跑酷測試' }}</span>
          </button>
        </div>

        <div class="code-mode-logs" v-if="levelStore.executionLogs.length > 0">
          <div
            v-for="log in levelStore.executionLogs.slice(-4)"
            :key="log.id"
            class="mini-log"
            :class="'mini-log-' + log.type"
          >
            {{ log.message }}
          </div>
        </div>
      </div>

      <!-- Quick Reference & Track Preview -->
      <div class="reference-card card">
        <div class="card-section-title">
          <Compass :size="15" class="text-brand" />
          <span>地形感測器與動作決策對照表</span>
        </div>

        <div class="rules-grid">
          <div class="rule-chip chip-gap">
            <span class="chip-ahead">ahead === 'gap'</span>
            <span class="chip-arrow">➔</span>
            <span class="chip-act font-mono">'jump'</span>
            <span class="chip-desc">跨越斷崖</span>
          </div>
          <div class="rule-chip chip-low">
            <span class="chip-ahead">ahead === 'low'</span>
            <span class="chip-arrow">➔</span>
            <span class="chip-act font-mono">'jump'</span>
            <span class="chip-desc">躍過矮柵欄</span>
          </div>
          <div class="rule-chip chip-high">
            <span class="chip-ahead">ahead === 'high'</span>
            <span class="chip-arrow">➔</span>
            <span class="chip-act font-mono">'slide'</span>
            <span class="chip-desc">貼地滑過</span>
          </div>
          <div class="rule-chip chip-ground">
            <span class="chip-ahead">其餘地形</span>
            <span class="chip-arrow">➔</span>
            <span class="chip-act font-mono">'run'</span>
            <span class="chip-desc">平地與終點</span>
          </div>
        </div>

        <!-- Course A Track Strip -->
        <div class="track-strip-wrap">
          <div class="track-strip-header">
            <span class="track-strip-title">訓練場賽道預覽 (Course A)：</span>
            <span class="track-strip-badge">共 14 格</span>
          </div>
          <div class="track-strip">
            <div
              v-for="(tile, i) in visibleTiles"
              :key="i"
              class="tile-box"
              :class="'tile-' + tile"
              :title="`第 ${i} 格: ${tile}`"
            >
              <span class="tile-icon">{{ tileIcon(tile) }}</span>
              <span class="tile-name">{{ tileName(tile) }}</span>
            </div>
          </div>
          <span class="track-strip-note">💡 通關時除了訓練場，程式還會自動在 3 條隱藏賽道測試，驗證邏輯是否「通用」！</span>
        </div>
      </div>
    </div>

    <!-- Footer Controls -->
    <div class="deck-footer">
      <div class="footer-left">
        <span class="footer-hint">提示：每種地形有唯一對應動作，動作為英文小寫字串（需加引號）</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { Zap, RotateCcw, Play, Code, Compass } from 'lucide-vue-next';
import { useLevelStore } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { LEVEL_9_STARTER_CODE } from '../../levels/level-9.js';
import { PARKOUR_COURSES } from '../../game/sim/parkour.js';
import CodeEditor from '../editor/CodeEditor.vue';

const levelStore = useLevelStore();
const progressStore = useProgressStore();

const studentCode = ref(LEVEL_9_STARTER_CODE);

const visibleTiles = computed(() => {
  return PARKOUR_COURSES[0].tiles;
});

function tileIcon(tile) {
  switch (tile) {
    case 'ground': return '▬';
    case 'gap': return '⌴';
    case 'low': return '▲';
    case 'high': return '⎴';
    case 'finish': return '🏁';
    default: return '·';
  }
}

function tileName(tile) {
  switch (tile) {
    case 'ground': return '平地';
    case 'gap': return '缺口';
    case 'low': return '矮欄';
    case 'high': return '橫桿';
    case 'finish': return '終點';
    default: return tile;
  }
}

onMounted(() => {
  const saved = progressStore.getSavedOperation(9);
  if (saved && typeof saved.code === 'string' && saved.code.length > 0) {
    studentCode.value = saved.code;
  }
});

function resetDefaults() {
  levelStore.resetCurrentLevel();
}

function runCodeExecution() {
  levelStore.executeLevel({
    code: studentCode.value
  });
}

function resetCode() {
  studentCode.value = LEVEL_9_STARTER_CODE;
}
</script>

<style scoped>
.control-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border-top: 1px solid var(--border-subtle);
  overflow: hidden;
}

.deck-header {
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-panel-hover);
}

.deck-title-group {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.deck-title {
  font-family: var(--font-display);
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.deck-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.code-mode-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.code-mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.code-mode-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
}

.code-editor-wrap {
  height: 250px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.code-mode-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.execute-btn {
  padding: 0.45rem 1.2rem;
  font-size: 0.85rem;
}

.code-mode-logs {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.mini-log {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--bg-panel-hover);
  border: 1px solid var(--border-subtle);
  white-space: pre-wrap;
  word-break: break-all;
}

.mini-log-error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #991b1b;
}

.mini-log-success {
  background: #f0fdf4;
  border-color: #86efac;
  color: #15803d;
}

.reference-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-section-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.5rem;
}

.rule-chip {
  padding: 0.45rem 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.75rem;
}

.chip-ahead {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.7rem;
}

.chip-arrow {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.chip-act {
  font-weight: 700;
  font-size: 0.82rem;
}

.chip-desc {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.chip-gap {
  background: #fef2f2;
  border-color: #fee2e2;
  color: #b91c1c;
}

.chip-low {
  background: #fffbeb;
  border-color: #fef3c7;
  color: #b45309;
}

.chip-high {
  background: #f5f3ff;
  border-color: #ede9fe;
  color: #6d28d9;
}

.chip-ground {
  background: #f0fdf4;
  border-color: #dcfce7;
  color: #15803d;
}

.track-strip-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: var(--bg-panel-hover);
  padding: 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}

.track-strip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.track-strip-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.track-strip-badge {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.track-strip {
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.tile-box {
  min-width: 44px;
  padding: 0.35rem 0.2rem;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  border: 1px solid var(--border-subtle);
  background: #ffffff;
}

.tile-icon {
  font-size: 0.85rem;
}

.tile-name {
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.tile-gap {
  background: #fee2e2;
  border-color: #fca5a5;
}

.tile-low {
  background: #fef3c7;
  border-color: #fcd34d;
}

.tile-high {
  background: #ede9fe;
  border-color: #c4b5fd;
}

.tile-finish {
  background: #dcfce7;
  border-color: #86efac;
}

.track-strip-note {
  font-size: 0.7rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.deck-footer {
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-panel-hover);
}

.footer-hint {
  font-size: 0.78rem;
  color: var(--text-secondary);
}
</style>
