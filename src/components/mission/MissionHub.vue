<template>
  <aside class="mission-hub">
    <!-- Header -->
    <div class="hub-header">
      <div class="hub-title-row">
        <Target :size="18" class="text-brand" />
        <h2 class="hub-title">任務簡報 · Mission Brief</h2>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-xs hint-nav-btn" @click="openHints" title="查看任務導引提示">
          <Lightbulb :size="14" class="text-warning" />
          <span>提示</span>
        </button>
        <span class="badge badge-blue">LEVEL {{ formatLevelNumber(level.id) }}</span>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="hub-content">
      <!-- Mission Objective Box -->
      <section class="info-card card">
        <div class="card-top-title">
          <h3 class="card-title">{{ level.title }}</h3>
          <span class="card-subtitle">{{ level.subtitle }}</span>
        </div>

        <!-- Concept Badges -->
        <div v-if="level.concepts" class="concept-tags-row">
          <span v-for="tag in level.concepts" :key="tag" class="concept-pill">
            {{ tag }}
          </span>
        </div>

        <p class="mission-story">{{ level.description }}</p>

        <div class="requirements-box">
          <span class="req-title">通關要求 (Requirements)：</span>
          <ul class="req-list">
            <li v-for="(req, idx) in level.targetRequirements" :key="idx" class="req-item">
              <CheckCircle2 v-if="isCompleted" :size="15" class="text-success req-icon" />
              <Circle v-else :size="15" class="text-muted req-icon" />
              <span>{{ req }}</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- Execution Status & Diagnostic Feedback -->
      <section v-if="lastRunResult" class="feedback-card card" :class="lastRunResult.pass ? 'feedback-pass' : 'feedback-fail'">
        <div class="feedback-header">
          <CheckCircle2 v-if="lastRunResult.pass" :size="18" class="text-success" />
          <AlertCircle v-else :size="18" class="text-danger" />
          <strong class="feedback-title">{{ lastRunResult.pass ? '通關遙測驗證通過！' : '遙測自檢未通過 (需調整參數)' }}</strong>
        </div>
        <p class="feedback-body">
          {{ lastRunResult.pass ? lastRunResult.feedback : lastRunResult.error }}
        </p>
        <div v-if="!lastRunResult.pass && failureHint" class="feedback-action-hint">
          <Lightbulb :size="14" class="text-brand" />
          <span>{{ failureHint }}</span>
        </div>
      </section>

      <!-- Core Concept Card (collapsed to reduce scroll) -->
      <section class="concept-card card collapsible">
        <div class="concept-header collapsible-header" @click="toggleSection('concept')">
          <BookOpen :size="16" class="text-purple" />
          <h4 class="concept-name">{{ level.conceptTitle }}</h4>
          <span class="collapse-icon">
            <ChevronUp v-if="openSections.concept" :size="15" class="text-muted" />
            <ChevronDown v-else :size="15" class="text-muted" />
          </span>
        </div>
        <p v-show="openSections.concept" class="concept-text">{{ level.conceptExplanation }}</p>
      </section>

    </div>

    <!-- Socratic Hint Modal Component -->
    <HintModal
      :is-open="levelStore.isHintModalOpen"
      :hints="level.hints || []"
      @close="levelStore.toggleHintModal(false)"
    />
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue';
import {
  Target, CheckCircle2, Circle, AlertCircle, BookOpen,
  ChevronDown, ChevronUp, Lightbulb
} from 'lucide-vue-next';
import { useLevelStore } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { formatLevelNumber } from '../../levels/index.js';
import HintModal from './HintModal.vue';

const levelStore = useLevelStore();
const progressStore = useProgressStore();

const level = computed(() => levelStore.currentLevel);
const isCompleted = computed(() => progressStore.isLevelCompleted(level.value.id));
const lastRunResult = computed(() => levelStore.lastRunResult);

const failureHint = computed(() => {
  if (!lastRunResult.value || lastRunResult.value.pass) return '';
  const err = lastRunResult.value.error || '';
  if (err.includes('未命名')) return 'JavaScript 變數需賦予字串，請在左下輸入名稱或點選快速代號。';
  if (err.includes('能源不足') || err.includes('功率')) return '系統最低需 80% 功率，請拉動功率滑桿至 80%~100% 範圍。';
  if (err.includes('防護力場') || err.includes('防護罩')) return '請將 shieldActive 設為 true 以啟動防護力場。';
  if (err.includes('推力不足') || err.includes('尚未抵達補給站')) return '請調整推進次數與速度，讓 總位移 (次數 × 速度) 剛好等於 24 單位。';
  if (err.includes('超速') || err.includes('超出')) return '速度或位移過大，請將著陸速度控制在 3 以內，並讓位移剛好為 24。';
  if (err.includes('燃料不足') || err.includes('燃料耗盡')) return '請調高初始燃料或減少推進次數，確保剩餘燃料大於 0。';
  if (err.includes('採集數量不足')) return '請調整 for 迴圈次數至 5 次以採集所有水晶。';
  if (err.includes('模組型號')) return '請更換為高階模組並調用 scanArea() 方法。';
  return '請調整左側控制項參數後再次點擊測試。';
});

function openHints() {
  levelStore.toggleHintModal(true);
}

// 概念卡收合狀態（監視器與語法對照已刪除，僅保留概念卡）
const openSections = ref({ concept: false });
function toggleSection(key) {
  openSections.value[key] = !openSections.value[key];
}
</script>

<style scoped>
.mission-hub {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border-left: 1px solid var(--border-subtle);
  overflow: hidden;
}

.hub-header {
  height: 52px;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  border-bottom: 1px solid var(--border-subtle);
  background: #ffffff;
}

.hub-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hub-title {
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hint-nav-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border-radius: var(--radius-sm);
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  font-weight: 600;
}

.hint-nav-btn:hover {
  background: #fde68a;
}

.hub-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #ffffff;
  border: 1px solid var(--border-subtle);
}

.card-top-title {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.card-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.card-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.concept-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.concept-pill {
  font-size: 0.7rem;
  font-weight: 600;
  background: #eff6ff;
  color: #2563eb;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  border: 1px solid #bfdbfe;
}

.mission-story {
  font-size: 0.86rem;
  color: #475569;
  line-height: 1.55;
  margin: 0;
}

.requirements-box {
  background: #f8fafc;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.req-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-main);
}

.req-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0;
  margin: 0;
}

.req-item {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: #334155;
  line-height: 1.4;
}

.req-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

/* Feedback Card */
.feedback-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.85rem 1rem;
}

.feedback-pass {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
}

.feedback-fail {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.feedback-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.feedback-title {
  font-size: 0.9rem;
}

.feedback-body {
  font-size: 0.84rem;
  line-height: 1.5;
  margin: 0;
}

.feedback-action-hint {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: #ffffff;
  padding: 0.45rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid #fecaca;
  font-size: 0.8rem;
  color: #991b1b;
  font-weight: 500;
  margin-top: 0.25rem;
}

/* Concept Card */
.concept-card {
  background: #faf5ff;
  border: 1px solid #e9d5ff;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.85rem 1rem;
}

.concept-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.concept-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: #6b21a8;
  margin: 0;
}

.concept-text {
  font-size: 0.82rem;
  color: #581c87;
  line-height: 1.5;
  margin: 0;
}

.collapsible-header {
  cursor: pointer;
  user-select: none;
}

.collapse-icon {
  margin-left: auto;
  display: inline-flex;
}

.hub-content {
  gap: 0.8rem !important;
  padding: 0.8rem !important;
}
</style>
