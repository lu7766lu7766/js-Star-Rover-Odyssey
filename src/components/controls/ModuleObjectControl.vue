<template>
  <div class="control-panel">
    <div class="deck-header">
      <div class="deck-title-group">
        <Cpu :size="18" class="text-brand" />
        <h3 class="deck-title">深空普查：物件與函式</h3>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="resetDefaults" title="還原場景與參數至最初狀態">
          <RotateCcw :size="14" />
          <span>還原</span>
        </button>
      </div>
    </div>

    <div class="deck-content">
      <!-- 0. Code mode（手寫物件 + 方法，走 Worker 真調用） -->
      <div class="code-mode-card card">
        <div class="code-mode-header">
          <div class="code-mode-title">
            <Code :size="15" class="text-brand" />
            <span>手寫 JS 挑戰 · 把 ___ 補完再執行</span>
          </div>
          <span class="badge badge-info">通關隱藏星系 = 1~3星</span>
        </div>
        <div class="code-editor-wrap">
          <CodeEditor v-model="studentCode" :level-id="5" @reset="resetCode" @run="runCodeExecution" />
        </div>
        <div class="code-mode-actions">
          <button
            class="btn btn-success execute-btn"
            :disabled="levelStore.isExecuting || !studentCode.trim()"
            @click="runCodeExecution"
          >
            <Radio :size="16" />
            <span>{{ levelStore.isExecuting ? '執行中...' : '執行 JS 程式碼' }}</span>
          </button>
        </div>
        <RunFeedback />
      </div>

      <!-- 1. 雷達規格（只寫規則，不寫答案：數值要從 planet 物件讀） -->
      <div class="module-select-box">
        <span class="box-label">雷達規格表（三顆星距離不同，range 要從 planet.distance 算）：</span>
        <div class="module-cards-grid">
          <div class="mod-option-card card">
            <div class="mod-top">
              <strong class="mono">scanner.pulse(params)</strong>
              <span class="badge badge-blue">掃描脈衝</span>
            </div>
            <p class="mod-desc">params 是參數物件：target（星體名稱）、range（半徑）、mode（解析度）</p>
            <p class="mod-return mono">回傳 { target, found, coords }</p>
          </div>
          <div class="mod-option-card card">
            <div class="mod-top">
              <strong class="mono">range</strong>
              <span class="badge badge-warning">半徑限制</span>
            </div>
            <p class="mod-desc">至少要等於星體距離才碰得到；比距離多超過 {{ rangeMargin }} 會過熱</p>
          </div>
          <div class="mod-option-card card">
            <div class="mod-top">
              <strong class="mono">mode</strong>
              <span class="badge badge-warning">解析度</span>
            </div>
            <p class="mod-desc">距離超過 {{ highResDistance }} 用 "HIGH"；近距離用 "HIGH" 會過曝，要用 "NORMAL"</p>
          </div>
          <div class="mod-option-card card">
            <div class="mod-top">
              <strong class="mono">rover.flyTo(coords)</strong>
              <span class="badge badge-blue">導航</span>
            </div>
            <p class="mod-desc">只收座標物件，座標在掃描報告的 coords 屬性裡</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Execute Bar -->
    <div class="deck-footer">
      <div class="footer-hint">
        同一個 scanPlanet 呼叫三次：每次交給它不同的星體物件
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Cpu, RotateCcw, Radio, Code } from 'lucide-vue-next';
import { useLevelStore } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { LEVEL_5_STARTER_CODE } from '../../levels/level-5.js';
import { RANGE_MARGIN, HIGH_RES_DISTANCE } from '../../game/sim/scanner.js';
import CodeEditor from '../editor/CodeEditor.vue';
import RunFeedback from './RunFeedback.vue';

const levelStore = useLevelStore();
const progressStore = useProgressStore();

const rangeMargin = RANGE_MARGIN;
const highResDistance = HIGH_RES_DISTANCE;
const studentCode = ref(LEVEL_5_STARTER_CODE);

onMounted(() => {
  const saved = progressStore.getSavedOperation(5);
  // 舊版關卡（rover.installModule 模組裝載）的存檔程式碼已經跑不動，直接用新的起始程式碼
  if (saved && typeof saved.code === 'string' && saved.code.length > 0 && !saved.code.includes('installModule')) {
    studentCode.value = saved.code;
  }
});

function resetDefaults() {
  levelStore.resetCurrentLevel();
}

function runCodeExecution() {
  levelStore.requestRun({
    code: studentCode.value
  });
}

function resetCode() {
  studentCode.value = LEVEL_5_STARTER_CODE;
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

.module-select-box {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.box-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted);
}

.module-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.mod-option-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem;
}

.mod-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.mono {
  font-family: var(--font-mono);
}

.mod-desc {
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.35;
}

.mod-return {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.deck-footer {
  height: 52px;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-panel-hover);
}

.footer-hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.execute-btn {
  padding: 0.5rem 1.4rem;
  font-size: 0.92rem;
}

/* L5: code mode */
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
  height: clamp(280px, 46vh, 560px);
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




</style>
