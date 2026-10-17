<template>
  <div class="control-panel">
    <div class="deck-header">
      <div class="deck-title-group">
        <MousePointer :size="18" class="text-brand" />
        <h3 class="deck-title">DOM 事件實驗室：幫網頁按鈕接上電線</h3>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="onReset" title="還原場景與參數至最初狀態">
          <RotateCcw :size="14" />
          <span>還原</span>
        </button>
      </div>
    </div>

    <div class="deck-content">
      <!-- 手寫接線＋回呼，走 Worker 模擬點擊 -->
      <div class="code-mode-card card">
        <div class="code-mode-header">
          <div class="code-mode-title">
            <Code :size="15" class="text-brand" />
            <span>手寫 JS 挑戰 · 把 ___ 補完再執行</span>
          </div>
          <span class="badge badge-info">守衛判斷 = 3星</span>
        </div>
        <div class="code-editor-wrap">
          <CodeEditor v-model="studentCode" :level-id="6" @reset="resetCode" @run="runCodeExecution" />
        </div>
        <div class="code-mode-note">
          <span>送出只檢查程式接線（事件＋回呼＋守衛判斷），不自動開門。通過後請到上方 2D 網頁親手解除警報＋開啟氣閘，完成後自動過關。</span>
        </div>
        <div v-if="levelStore.l6CodeApproved" class="code-mode-approved">
          <span>✅ 程式送審通過！請到上方 2D 網頁親手點擊完成任務（改程式需重新送出）。</span>
        </div>
        <div class="code-mode-actions">
          <button
            class="btn btn-success execute-btn"
            :disabled="levelStore.isExecuting || !studentCode.trim()"
            @click="runCodeExecution"
          >
            <Play :size="16" />
            <span>{{ levelStore.isExecuting ? '檢查中...' : '送出程式' }}</span>
          </button>
        </div>
        <RunFeedback />
      </div>
    </div>

    <!-- Execute Bar -->
    <div class="deck-footer">
      <div class="footer-hint">
        送審模式：先送出檢查程式，通過後到 2D 網頁親手操作過關
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import {
  MousePointer, RotateCcw, Play, Code
} from 'lucide-vue-next';
import { useLevelStore } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { LEVEL_6_STARTER_CODE } from '../../levels/level-6.js';
import CodeEditor from '../editor/CodeEditor.vue';
import RunFeedback from './RunFeedback.vue';

const levelStore = useLevelStore();
const progressStore = useProgressStore();

const studentCode = ref(LEVEL_6_STARTER_CODE);

onMounted(() => {
  const saved = progressStore.getSavedOperation(6);
  if (saved && typeof saved.code === 'string' && saved.code.length > 0) {
    studentCode.value = saved.code;
  }
});

// 程式改過就視為需重新送審，避免拿舊通過混過新手動操作
watch(studentCode, (newCode) => {
  if (levelStore.l6CodeApproved && newCode !== levelStore.l6ApprovedCode) {
    levelStore.l6CodeApproved = false;
    levelStore.appendLog({ type: 'info', message: '✏️ 程式已修改，請重新送出檢查。' });
  }
});

function onReset() {
  levelStore.resetCurrentLevel();
}

function runCodeExecution() {
  levelStore.requestRun({ code: studentCode.value });
}

function resetCode() {
  studentCode.value = LEVEL_6_STARTER_CODE;
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

/* L6: code mode */
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

.code-mode-note {
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: var(--bg-panel-hover);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.65rem;
  line-height: 1.5;
}

.code-mode-approved {
  font-size: 0.78rem;
  font-weight: 700;
  color: #065f46;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.65rem;
  line-height: 1.5;
}

.code-mode-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}




</style>
