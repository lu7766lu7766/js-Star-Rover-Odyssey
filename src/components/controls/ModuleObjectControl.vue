<template>
  <div class="control-panel">
    <div class="deck-header">
      <div class="deck-title-group">
        <Cpu :size="18" class="text-brand" />
        <h3 class="deck-title">模組裝載：函式與物件</h3>
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
          <span class="badge badge-info">物件 + 方法 = 3星</span>
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

      <!-- 1. Function reference cards（方法對照表：讀懂三個 f 的差別再選） -->
      <div class="module-select-box">
        <span class="box-label">函式對照表 f（讀懂行為差異，寫碼時選對函式）：</span>
        <div class="module-cards-grid">
          <div
            v-for="m in availableMethods"
            :key="m.id"
            class="mod-option-card card"
          >
            <div class="mod-top">
              <strong class="mono">{{ m.signature }}</strong>
              <span class="badge" :class="m.id === 'activateScan' ? 'badge-blue' : 'badge-warning'">
                {{ m.label }}
              </span>
            </div>
            <p class="mod-desc">{{ m.description }}</p>
            <p class="mod-return mono">回傳 {{ m.returns }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Execute Bar -->
    <div class="deck-footer">
      <div class="footer-hint">
        先選對要呼叫的函式，再把參數物件的屬性填好
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Cpu, RotateCcw, Radio, Code } from 'lucide-vue-next';
import { useLevelStore } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { AVAILABLE_METHODS, LEVEL_5_STARTER_CODE } from '../../levels/level-5.js';
import CodeEditor from '../editor/CodeEditor.vue';
import RunFeedback from './RunFeedback.vue';

const levelStore = useLevelStore();
const progressStore = useProgressStore();

const availableMethods = AVAILABLE_METHODS;
const studentCode = ref(LEVEL_5_STARTER_CODE);

onMounted(() => {
  const saved = progressStore.getSavedOperation(5);
  if (saved && typeof saved.code === 'string' && saved.code.length > 0) {
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
