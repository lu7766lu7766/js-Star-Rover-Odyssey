<template>
  <div class="control-panel">
    <div class="deck-header">
      <div class="deck-title-group">
        <ListFilter :size="18" class="text-brand" />
        <h3 class="deck-title">陣列宣告與批次遍歷 · Array Fleet Dispatch</h3>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="resetDefaults" title="還原場景與參數至最初狀態">
          <RotateCcw :size="14" />
          <span>還原</span>
        </button>
      </div>
    </div>

    <div class="deck-content">
      <!-- 手寫 forEach + deploy，走 Worker 真跑 -->
      <div class="code-mode-card card">
        <div class="code-mode-header">
          <div class="code-mode-title">
            <Code :size="15" class="text-brand" />
            <span>手寫 JS 挑戰 · 陣列宣告與 forEach 遍歷</span>
          </div>
          <span class="badge badge-info">forEach = 3星</span>
        </div>
        <div class="code-editor-wrap">
          <CodeEditor v-model="studentCode" :level-id="7" @reset="resetCode" />
        </div>
        <div class="code-mode-actions">
          <button
            class="btn btn-success execute-btn"
            :disabled="levelStore.isExecuting || !studentCode.trim()"
            @click="runCodeExecution"
          >
            <Play :size="16" />
            <span>{{ levelStore.isExecuting ? '編隊調度中...' : '執行 JS 程式碼' }}</span>
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
    </div>

    <!-- Execute Bar -->
    <div class="deck-footer">
      <div class="footer-hint">
        觀察程式碼中的 const drones 陣列，為每架無人機指派安全指令後點擊「執行 JS 程式碼」
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ListFilter, RotateCcw, Play, Code } from 'lucide-vue-next';
import { useLevelStore } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { LEVEL_7_STARTER_CODE } from '../../levels/level-7.js';
import CodeEditor from '../editor/CodeEditor.vue';

const levelStore = useLevelStore();
const progressStore = useProgressStore();

const dronesData = [
  { id: 'DRONE-01', name: '游隼號', battery: 85, model: 'Recon-X' },
  { id: 'DRONE-02', name: '夜梟號', battery: 15, model: 'Stealth-V' },
  { id: 'DRONE-03', name: '海鵰號', battery: 92, model: 'Heavy-T' },
  { id: 'DRONE-04', name: '雀鷹號', battery: 12, model: 'Scout-M' }
];

const studentCode = ref(LEVEL_7_STARTER_CODE);

onMounted(() => {
  const saved = progressStore.getSavedOperation(7);
  if (saved && typeof saved.code === 'string' && saved.code.length > 0) {
    // 若暫存為未包含 const drones 的舊版程式碼，自動遷移至直觀的新版陣列樣板
    if (!saved.code.includes('const drones')) {
      studentCode.value = LEVEL_7_STARTER_CODE;
    } else {
      studentCode.value = saved.code;
    }
  }
});

function resetDefaults() {
  studentCode.value = LEVEL_7_STARTER_CODE;
  levelStore.resetCurrentLevel();
}

function runCodeExecution() {
  levelStore.executeLevel({
    code: studentCode.value,
    initialData: { drones: JSON.parse(JSON.stringify(dronesData)) }
  });
}

function resetCode() {
  studentCode.value = LEVEL_7_STARTER_CODE;
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
  min-height: 0;
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

/* L7: code mode */
.code-mode-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  flex: 1;
  min-height: 0;
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
  flex: 1;
  min-height: 340px;
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
</style>
