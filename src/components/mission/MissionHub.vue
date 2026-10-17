<template>
  <aside class="mission-hub">
    <!-- Header -->
    <div class="hub-header">
      <div class="hub-title-row">
        <Target :size="18" class="text-brand" />
        <h2 class="hub-title">任務簡報</h2>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-xs hint-nav-btn" @click="openHints" title="查看任務提示">
          <Lightbulb :size="14" class="text-warning" />
          <span>提示 {{ levelStore.unlockedHintCount }}/{{ level.hints?.length || 0 }}</span>
        </button>
        <span class="badge badge-blue">第 {{ getLevelNumber(level.id) }} 站</span>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="hub-content">
      <section class="info-card card">
        <div class="card-top-title">
          <h3 class="card-title">{{ level.title }}</h3>
          <span class="card-subtitle">{{ level.subtitle }}</span>
        </div>

        <!-- 一句話任務 -->
        <p v-if="level.goal" class="mission-goal">🎯 {{ level.goal }}</p>

        <!-- 通關要求：逐項打勾，沒過時標出卡在哪一項 -->
        <div class="requirements-box">
          <span class="req-title">通關要求</span>
          <ul class="req-list">
            <li
              v-for="(req, idx) in level.targetRequirements"
              :key="idx"
              class="req-item"
              :class="`req-${reqState(idx)}`"
            >
              <CheckCircle2 v-if="reqState(idx) === 'done'" :size="16" class="text-success req-icon" />
              <AlertCircle v-else-if="reqState(idx) === 'stuck'" :size="16" class="req-icon icon-stuck" />
              <Circle v-else :size="16" class="text-muted req-icon" />
              <span>
                {{ req }}
                <em v-if="reqState(idx) === 'stuck'" class="stuck-tag">← 卡在這裡</em>
              </span>
            </li>
          </ul>
        </div>

        <!-- 任務故事（預設收合，避免一進來就是一大段文字） -->
        <details class="story-details">
          <summary>看任務故事與詳細說明</summary>
          <div v-if="level.concepts" class="concept-tags-row">
            <span v-for="tag in level.concepts" :key="tag" class="concept-pill">
              {{ tag }}
            </span>
          </div>
          <p class="mission-story">{{ level.description }}</p>
        </details>
      </section>

      <!-- Core Concept Card -->
      <section class="concept-card card collapsible">
        <div class="concept-header collapsible-header" @click="toggleSection('concept')">
          <BookOpen :size="16" class="text-purple" />
          <h4 class="concept-name">觀念小教室：{{ level.conceptTitle }}</h4>
          <span class="collapse-icon">
            <ChevronUp v-if="openSections.concept" :size="15" class="text-muted" />
            <ChevronDown v-else :size="15" class="text-muted" />
          </span>
        </div>
        <p v-show="openSections.concept" class="concept-text">{{ conceptPlainText }}</p>
      </section>
    </div>

    <!-- Socratic Hint Modal Component -->
    <HintModal
      :is-open="levelStore.isHintModalOpen"
      :hints="level.hints || []"
      :unlocked-count="levelStore.unlockedHintCount"
      :fail-count="levelStore.failCount"
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
import { getLevelNumber } from '../../levels/index.js';
import HintModal from './HintModal.vue';

const levelStore = useLevelStore();
const progressStore = useProgressStore();

const level = computed(() => levelStore.currentLevel);
const isCompleted = computed(() => progressStore.isLevelCompleted(level.value.id));
const lastRunResult = computed(() => levelStore.lastRunResult);

// 觀念說明裡的 **粗體** 記號直接顯示會很怪，先拿掉
const conceptPlainText = computed(() => (level.value.conceptExplanation || '').replace(/\*\*/g, ''));

/** 每一項要求的狀態：done 已達成 / stuck 卡在這裡 / todo 尚未檢查 */
function reqState(idx) {
  const res = lastRunResult.value;
  if (res?.pass) return 'done';
  const stuckAt = res?.errorInfo?.reqIndex;
  if (typeof stuckAt === 'number') {
    if (idx < stuckAt) return 'done';
    if (idx === stuckAt) return 'stuck';
    return 'todo';
  }
  // 這次執行沒過、又看不出卡在哪一項（例如語法錯誤）→ 全部視為待檢查，避免沿用舊的通關勾勾
  if (res && !res.pass) return 'todo';
  return isCompleted.value ? 'done' : 'todo';
}

function openHints() {
  levelStore.toggleHintModal(true);
}

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
  font-size: 0.88rem;
  color: #334155;
  line-height: 1.5;
  padding: 0.2rem 0.3rem;
  transition: background var(--transition-fast);
}

.req-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

/* Feedback Card */
.mission-goal {
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.55;
  color: var(--text-primary);
  background: var(--primary-blue-light);
  border: 1px solid var(--border-accent-light);
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.7rem;
  margin: 0;
}

.req-stuck {
  background: var(--warning-light);
  border-radius: var(--radius-sm);
  color: #78350f;
}

.icon-stuck {
  color: var(--warning-dark);
}

.stuck-tag {
  font-style: normal;
  font-weight: 800;
  color: var(--warning-dark);
  white-space: nowrap;
}

.req-done {
  color: var(--text-secondary);
}

.story-details summary {
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--primary-blue);
  padding: 0.2rem 0;
}

.story-details[open] summary {
  margin-bottom: 0.45rem;
}

.story-details .mission-story {
  margin-top: 0.45rem;
}

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
