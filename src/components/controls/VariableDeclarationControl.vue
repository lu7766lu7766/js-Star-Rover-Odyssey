<template>
  <div class="control-panel">
    <!-- Header -->
    <div class="deck-header">
      <div class="deck-title-group">
        <Variable :size="18" class="text-brand" />
        <h3 class="deck-title">通電自檢：變數與資料型態</h3>
      </div>
      <div class="deck-actions">
        <button class="btn btn-secondary btn-sm" @click="handleRestore" title="還原場景與參數至最初狀態">
          <RotateCcw :size="14" />
          <span>還原</span>
        </button>
      </div>
    </div>

    <!-- Main Deck Grid -->
    <div class="deck-content">
      <!-- 手寫 let + rover.setup，走 Worker 真跑 -->
      <div class="code-mode-card card">
        <div class="code-mode-header">
          <div class="code-mode-title">
            <Code :size="15" class="text-brand" />
            <span>手寫 JS 挑戰 · 把 ___ 補完再執行</span>
          </div>
          <span class="badge badge-info">3 個 let = 3星</span>
        </div>
        <div class="code-editor-wrap">
          <CodeEditor v-model="studentCode" :level-id="1" @reset="resetCode" @run="runCodeExecution" />
        </div>
        <div class="type-hint-row">
          <span class="type-hint tag-string">String 加引號 " "</span>
          <span class="type-hint tag-number">Number 寫數字 80~100</span>
          <span class="type-hint tag-boolean">Boolean 寫 true（不加引號）</span>
        </div>
        <div class="code-mode-actions">
          <button
            class="btn btn-success execute-btn"
            :disabled="levelStore.isExecuting || !studentCode.trim()"
            @click="runCodeExecution"
          >
            <Zap :size="16" />
            <span>{{ levelStore.isExecuting ? '通電自檢運行中...' : '執行 JS 程式碼' }}</span>
          </button>
        </div>
        <RunFeedback />
      </div>
    </div>

    <!-- Execute Bar -->
    <div class="deck-footer">
      <div class="footer-hint">
        <span class="text-muted">
          文字要加引號，數字和 true / false 不用加
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Variable, RotateCcw, Code, Zap } from 'lucide-vue-next';
import { useLevelStore } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { LEVEL_1_STARTER_CODE } from '../../levels/level-1.js';
import CodeEditor from '../editor/CodeEditor.vue';
import RunFeedback from './RunFeedback.vue';

const levelStore = useLevelStore();
const progressStore = useProgressStore();

const studentCode = ref(LEVEL_1_STARTER_CODE);

onMounted(() => {
  const saved = progressStore.getSavedOperation(1);
  if (saved && typeof saved.code === 'string' && saved.code.length > 0) {
    studentCode.value = saved.code;
  }
});

function handleRestore() {
  levelStore.resetCurrentLevel();
}

function runCodeExecution() {
  levelStore.requestRun({
    code: studentCode.value
  });
}

function resetCode() {
  studentCode.value = LEVEL_1_STARTER_CODE;
}
</script>

<style scoped>
.control-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-card);
  overflow: hidden;
}

.deck-header {
  padding: 0.75rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-subtle);
  background: #ffffff;
}

.deck-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.header-right {
  display: flex;
  align-items: center;
}

.status-badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
}

.card-valid {
  border-left: 3px solid #10b981;
}

.card-pending {
  border-left: 3px solid #f59e0b;
}

.deck-title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.deck-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.deck-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.var-card {
  padding: 0.85rem 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  transition: all 0.2s ease;
}

.var-card:hover {
  border-color: var(--brand-300);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.05);
}

.var-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.var-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.keyword {
  color: #7c3aed;
  font-weight: 700;
  font-family: var(--font-mono);
  font-size: 0.9rem;
}

.var-name {
  font-size: 0.95rem;
  color: #0f172a;
  font-family: var(--font-mono);
}

.type-tag {
  font-size: 0.72rem;
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
}

.tag-string {
  background: #fdf2f8;
  color: #db2777;
  border: 1px solid #fbcfe8;
}

.tag-number {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.tag-boolean {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.var-comment {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.input-with-quotes {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  background: var(--bg-space);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.6rem;
}

.quote {
  font-family: var(--font-mono);
  color: #db2777;
  font-size: 1.1rem;
  font-weight: bold;
}

.text-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  color: var(--text-main);
}

.quick-chips {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.4rem;
  flex-wrap: wrap;
}

.chips-label {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.chip-btn {
  background: #f8fafc;
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  transition: all 0.15s ease;
}

.chip-active {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1d4ed8;
  font-weight: 600;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.slider {
  flex: 1;
  accent-color: var(--brand-500);
}

.power-badge {
  min-width: 60px;
  text-align: center;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
}

.badge-muted {
  background: #f1f5f9;
  color: #64748b;
}

.badge-warn {
  background: #fef3c7;
  color: #d97706;
}

.badge-safe {
  background: #ecfdf5;
  color: #059669;
  font-weight: bold;
}

.badge-danger {
  background: #fee2e2;
  color: #dc2626;
  font-weight: bold;
}

.power-feedback {
  font-size: 0.75rem;
  margin-top: 0.3rem;
}

.boolean-toggle-row {
  display: flex;
  gap: 0.75rem;
}

.bool-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.active-glow {
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.35);
}

.code-preview-card {
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
  margin-bottom: 0.4rem;
}

.js-pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  line-height: 1.5;
  color: #334155;
  background: #ffffff;
  padding: 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}

.string { color: #db2777; }
.number { color: #2563eb; }
.boolean { color: #059669; font-weight: bold; }
.func { color: #0284c7; }

.deck-footer {
  padding: 0.75rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border-subtle);
  background: #ffffff;
}

.footer-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.execute-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  padding: 0.6rem 1.25rem;
}

/* L1: code mode */
.code-mode-card {
  padding: 0.85rem 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: #ffffff;
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
}

.code-editor-wrap {
  height: clamp(280px, 46vh, 560px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.type-hint-row {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.type-hint {
  font-size: 0.7rem;
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
}

.code-mode-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}




</style>
