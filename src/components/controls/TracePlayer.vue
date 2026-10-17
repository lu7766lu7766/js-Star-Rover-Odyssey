<template>
  <div v-if="total > 0" class="trace-player" :class="{ 'is-active': index !== null }">
    <div class="trace-head">
      <Footprints :size="14" />
      <span v-if="index === null" class="trace-status">
        程式一共跑了 {{ total }} 步{{ levelStore.traceTruncated ? '（只記錄前面這些）' : '' }}，按 ▶ 一步一步看它怎麼跑
      </span>
      <span v-else class="trace-status">
        第 <strong>{{ index + 1 }}</strong> / {{ total }} 步：準備執行第 <strong>{{ currentLine }}</strong> 行
      </span>
    </div>

    <div class="trace-controls">
      <button class="trace-btn" title="回到第 1 步" :disabled="index === 0" @click="seekStart">
        <SkipBack :size="15" />
      </button>
      <button class="trace-btn" title="上一步" :disabled="index === 0" @click="levelStore.stepTrace(-1)">
        <ChevronLeft :size="16" />
      </button>
      <button
        class="trace-btn trace-btn-main"
        :title="levelStore.isTracePlaying ? '暫停' : '自動播放'"
        @click="togglePlay"
      >
        <Pause v-if="levelStore.isTracePlaying" :size="16" />
        <Play v-else :size="16" />
      </button>
      <button class="trace-btn" title="下一步" :disabled="index !== null && index >= total - 1" @click="levelStore.stepTrace(1)">
        <ChevronRight :size="16" />
      </button>
      <input
        class="trace-slider"
        type="range"
        min="0"
        :max="total - 1"
        :value="index ?? 0"
        aria-label="拖曳到任一步"
        @input="onSlide"
      />
      <button v-if="index !== null" class="trace-exit" title="離開逐步模式，回到最後結果" @click="exitStepping">
        結束
      </button>
    </div>

    <!-- 這一步執行前，各變數的值 -->
    <div v-if="index !== null" class="trace-vars">
      <span v-if="stepVars.length === 0" class="trace-vars-empty">這一步還沒有任何變數</span>
      <code v-for="v in stepVars" :key="v.name" class="trace-var" :class="`type-${v.type}`">
        {{ v.name }} = {{ v.display }}
      </code>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Footprints, SkipBack, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-vue-next';
import { useLevelStore } from '../../stores/levelStore.js';

const levelStore = useLevelStore();

const total = computed(() => levelStore.traceSteps.length);
const index = computed(() => levelStore.traceIndex);
const currentStep = computed(() => (index.value === null ? null : levelStore.traceSteps[index.value]));
const currentLine = computed(() => currentStep.value?.line);
const stepVars = computed(() => currentStep.value?.vars || []);

function togglePlay() {
  if (levelStore.isTracePlaying) levelStore.pauseTrace();
  else levelStore.playTrace();
}

function seekStart() {
  levelStore.pauseTrace();
  levelStore.seekTrace(0);
}

function onSlide(e) {
  levelStore.pauseTrace();
  levelStore.seekTrace(Number(e.target.value));
}

function exitStepping() {
  levelStore.pauseTrace();
  levelStore.seekTrace(null);
}
</script>

<style scoped>
/* 放在程式編輯器底部，像除錯工具列（深色，跟編輯器一體） */
.trace-player {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.45rem 0.65rem 0.5rem;
  background: #0b1220;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-family: var(--font-sans);
}

.trace-player.is-active {
  border-top-color: #22d3ee;
  background: #082f3a;
}

.trace-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: #94a3b8;
  line-height: 1.4;
}

.trace-head strong {
  color: #67e8f9;
}

.trace-controls {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.trace-btn {
  width: 30px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.trace-btn:hover:not(:disabled) {
  border-color: #22d3ee;
  color: #ffffff;
}

.trace-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.trace-btn-main {
  background: #0891b2;
  border-color: #0891b2;
  color: #ffffff;
}

.trace-btn-main:hover:not(:disabled) {
  background: #06b6d4;
}

.trace-slider {
  flex: 1;
  min-width: 60px;
  accent-color: #22d3ee;
  cursor: pointer;
}

.trace-exit {
  flex-shrink: 0;
  border: none;
  background: none;
  font-size: 0.78rem;
  color: #67e8f9;
  text-decoration: underline;
  cursor: pointer;
  padding: 0 0.15rem;
}

.trace-vars {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.trace-vars-empty {
  font-size: 0.78rem;
  color: #64748b;
}

.trace-var {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #e2e8f0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 型態配色：與變數盒子一致（字串粉、數字藍、布林綠） */
.trace-var.type-string { border-color: #f9a8d4; color: #fbcfe8; }
.trace-var.type-number { border-color: #93c5fd; color: #bfdbfe; }
.trace-var.type-boolean { border-color: #86efac; color: #bbf7d0; }
.trace-var.type-array,
.trace-var.type-object { border-color: #c4b5fd; color: #ddd6fe; }
.trace-var.type-undefined,
.trace-var.type-null { border-style: dashed; color: #94a3b8; }
</style>
