<template>
  <div class="control-panel">
    <div class="deck-header">
      <div class="deck-title-group">
        <GitBranch :size="18" class="text-brand" />
        <h3 class="deck-title">自動導航：條件判斷 if / else</h3>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="resetDefaults" title="還原場景與參數至最初狀態">
          <RotateCcw :size="14" />
          <span>還原</span>
        </button>
      </div>
    </div>

    <div class="deck-content">
      <!-- 手寫 autoPilot，走 Worker 真測 + 隱藏邊界 -->
      <div class="code-mode-card card">
        <div class="code-mode-header">
          <div class="code-mode-title">
            <Code :size="15" class="text-brand" />
            <span>手寫 JS 挑戰 · 把 ___ 補成數字再執行</span>
          </div>
          <span class="badge badge-info">邊界全對 = 3星</span>
        </div>
        <div class="code-editor-wrap">
          <CodeEditor v-model="studentCode" :level-id="3" @reset="resetCode" @run="runCodeExecution" />
        </div>
        <div class="code-mode-actions">
          <button
            class="btn btn-success execute-btn"
            :disabled="levelStore.isExecuting || !studentCode.trim()"
            @click="runCodeExecution"
          >
            <Play :size="16" />
            <span>{{ levelStore.isExecuting ? '沙箱執行中...' : '執行 JS 程式碼' }}</span>
          </button>
        </div>
        <RunFeedback />
      </div>
    </div>

    <!-- Execute Bar -->
    <div class="deck-footer">
      <div class="footer-hint">
        系統還會偷偷測試距離剛好是 5 和 15 的情況，想想該用 < 還是 <=
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { GitBranch, RotateCcw, Play, Code } from 'lucide-vue-next';
import { useLevelStore } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { LEVEL_3_STARTER_CODE } from '../../levels/level-3.js';
import CodeEditor from '../editor/CodeEditor.vue';
import RunFeedback from './RunFeedback.vue';

const levelStore = useLevelStore();
const progressStore = useProgressStore();

const studentCode = ref(LEVEL_3_STARTER_CODE);

onMounted(() => {
  const saved = progressStore.getSavedOperation(3);
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
  studentCode.value = LEVEL_3_STARTER_CODE;
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

/* L3: code mode + locked preview */
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





.preview-locked {
  padding: 0.8rem;
  background: var(--bg-panel-hover);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.deck-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.conditions-flow {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.branch-block {
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.branch-if {
  border-left: 4px solid var(--primary-blue);
}

.branch-elif {
  border-left: 4px solid var(--accent-purple);
}

.branch-else {
  border-left: 4px solid var(--warning);
}

.branch-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.keyword-badge {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
}

.badge-blue {
  background: var(--primary-blue-light);
  color: var(--primary-blue);
}

.badge-purple {
  background: var(--accent-purple-light);
  color: var(--text-purple);
}

.badge-warning {
  background: var(--warning-light);
  color: var(--warning-dark);
}

.condition-expression {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.condition-fallback-label {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.num-input {
  width: 58px;
  padding: 0.25rem 0.45rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-medium);
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 0.85rem;
  text-align: center;
  outline: none;
}

.num-input:focus {
  border-color: var(--primary-blue);
}

.branch-action-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.action-arrow {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.action-select {
  flex: 1;
  padding: 0.4rem 0.65rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-medium);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  background: #ffffff;
  outline: none;
  cursor: pointer;
}

.action-select:focus {
  border-color: var(--primary-blue);
}

/* Preview */
.preview-card {
  background: var(--bg-panel-hover);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.preview-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.6rem;
}

.dist-test-item {
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.dist-val {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 0.76rem;
}

.tag-danger-bg {
  background: var(--danger-light);
  border-color: var(--danger-border);
  color: var(--danger-dark);
}

.tag-warning-bg {
  background: var(--warning-light);
  border-color: var(--warning-border);
  color: var(--warning-dark);
}

.tag-success-bg {
  background: var(--success-light);
  border-color: var(--success-border);
  color: var(--success-dark);
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
</style>
