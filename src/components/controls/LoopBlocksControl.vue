<template>
  <div class="control-panel">
    <!-- Header -->
    <div class="deck-header">
      <div class="deck-title-group">
        <Repeat :size="18" class="text-brand" />
        <h3 class="deck-title">迷宮導航：for 迴圈</h3>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="resetDefaults" title="還原場景與參數至最初狀態">
          <RotateCcw :size="14" />
          <span>還原</span>
        </button>
      </div>
    </div>

    <div class="deck-content">
      <!-- 手寫 for 迴圈，走 Worker 真跑 -->
      <div class="code-mode-card card">
        <div class="code-mode-header">
          <div class="code-mode-title">
            <Code :size="15" class="text-brand" />
            <span>手寫 JS 挑戰 · 把 ___ 補完再執行</span>
          </div>
          <span class="badge badge-info">for 迴圈 ×3 = 3星</span>
        </div>
        <div class="code-editor-wrap">
          <CodeEditor v-model="studentCode" :level-id="4" @reset="resetCode" @run="runCodeExecution" />
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

    <!-- Footer Controls -->
    <div class="deck-footer">
      <div class="footer-left">
        <span class="footer-hint">同一個指令要重複好幾次？試試用 for 迴圈包起來</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import {
  Repeat,
  RotateCcw,
  Play,
  Code
} from 'lucide-vue-next';
import { useLevelStore } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { LEVEL_4_STARTER_CODE } from '../../levels/level-4.js';
import CodeEditor from '../editor/CodeEditor.vue';
import RunFeedback from './RunFeedback.vue';

const levelStore = useLevelStore();
const progressStore = useProgressStore();

const studentCode = ref(LEVEL_4_STARTER_CODE);

onMounted(() => {
  const saved = progressStore.getSavedOperation(4);
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
  studentCode.value = LEVEL_4_STARTER_CODE;
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

/* Footer */
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

.footer-left {
  display: flex;
  align-items: center;
}

.footer-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.execute-btn {
  padding: 0.5rem 1.4rem;
  font-size: 0.92rem;
  font-weight: 700;
}

/* L4: code mode */
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
