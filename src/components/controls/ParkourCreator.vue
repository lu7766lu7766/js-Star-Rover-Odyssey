<template>
  <div class="creator-card card">
    <div class="card-section-title">
      <Hammer :size="15" class="text-brand" />
      <span>創作模式：設計你的賽道</span>
      <span v-if="!unlocked" class="lock-badge"><Lock :size="12" /> 通關後解鎖</span>
    </div>

    <p v-if="!unlocked" class="creator-locked">
      先用 decide(ahead) 通過訓練場和隱藏賽道，就能自己設計賽道、拿去考同學的程式！
    </p>

    <template v-else>
      <p class="creator-intro">
        點下面的地形把賽道拼起來，再用<strong>你現在的程式</strong>跑跑看。規則寫得夠通用，任何賽道都難不倒它！
      </p>

      <!-- 地形調色盤 -->
      <div class="palette">
        <button
          v-for="tile in PALETTE"
          :key="tile.id"
          class="palette-btn"
          :class="`tile-${tile.id}`"
          :disabled="middle.length >= CUSTOM_COURSE_LIMITS.max || levelStore.isExecuting"
          @click="addTile(tile.id)"
        >
          <span class="tile-icon">{{ tile.icon }}</span>
          <span>{{ tile.label }}</span>
        </button>
      </div>

      <!-- 賽道 -->
      <div class="course-row" aria-label="自製賽道">
        <span class="course-tile fixed tile-ground" title="起點（固定）">起點</span>
        <button
          v-for="(tile, i) in middle"
          :key="i"
          class="course-tile tile-btn"
          :class="`tile-${tile}`"
          :title="`第 ${i + 1} 格：${labelOf(tile)}（點一下拿掉）`"
          :disabled="levelStore.isExecuting"
          @click="removeTile(i)"
        >
          {{ iconOf(tile) }}
        </button>
        <span class="course-tile fixed tile-finish" title="終點（固定）">🏁</span>
      </div>
      <div class="course-meta">
        <span>中間 {{ middle.length }} / {{ CUSTOM_COURSE_LIMITS.max }} 格（至少 {{ CUSTOM_COURSE_LIMITS.min }} 格）</span>
        <button class="link-btn" :disabled="levelStore.isExecuting" @click="randomize">🎲 隨機一條</button>
        <button class="link-btn" :disabled="levelStore.isExecuting || middle.length === 0" @click="clearTiles">清空</button>
      </div>

      <div class="creator-actions">
        <button
          class="btn btn-success btn-sm"
          :disabled="!canRun"
          @click="run"
        >
          <Play :size="15" />
          <span>{{ levelStore.isExecuting ? '跑酷中…' : '用我的程式跑這條賽道' }}</span>
        </button>
      </div>

      <div
        v-if="levelStore.customCourseResult"
        class="creator-result"
        :class="levelStore.customCourseResult.finished ? 'is-ok' : 'is-bad'"
      >
        {{ levelStore.customCourseResult.finished ? '🏆 ' : '💥 ' }}{{ levelStore.customCourseResult.message }}
      </div>

      <!-- 賽道碼：分享給同學 / 載入同學的賽道 -->
      <div class="share-box">
        <div class="share-row">
          <span class="share-label">我的賽道碼</span>
          <code class="share-code">{{ isValid ? courseCode : '（至少放 3 格才會產生）' }}</code>
          <button v-if="isValid" class="link-btn" @click="copyCode">{{ copied ? '已複製！' : '複製' }}</button>
        </div>
        <div class="share-row">
          <input
            v-model="importText"
            class="share-input"
            type="text"
            placeholder="貼上同學的賽道碼，例如 PK-RGRLRH"
            @keyup.enter="loadCode"
          />
          <button class="btn btn-outline btn-sm" :disabled="levelStore.isExecuting" @click="loadCode">載入</button>
        </div>
        <span v-if="importError" class="share-error">{{ importError }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Hammer, Lock, Play } from 'lucide-vue-next';
import { useLevelStore } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import {
  TILE,
  TILE_LABEL,
  CUSTOM_COURSE_LIMITS,
  isValidCustomMiddle,
  encodeCourseCode,
  decodeCourseCode
} from '../../game/sim/parkour.js';

const props = defineProps({
  // 學生目前的程式碼（跟編輯器同一份）
  code: { type: String, required: true }
});

const levelStore = useLevelStore();
const progressStore = useProgressStore();

const PALETTE = [
  { id: TILE.GROUND, icon: '▬', label: '平地' },
  { id: TILE.GAP, icon: '⌴', label: '缺口' },
  { id: TILE.LOW, icon: '▲', label: '矮欄' },
  { id: TILE.HIGH, icon: '⎴', label: '橫桿' }
];

const unlocked = computed(() => progressStore.isLevelCompleted(9) || progressStore.isDeveloperMode);
const middle = ref([...progressStore.parkourCourse]);
const isValid = computed(() => isValidCustomMiddle(middle.value));
const courseCode = computed(() => encodeCourseCode(middle.value));
const canRun = computed(() => isValid.value && !levelStore.isExecuting && props.code.trim().length > 0);

function iconOf(tile) {
  return PALETTE.find((p) => p.id === tile)?.icon || '·';
}

function labelOf(tile) {
  return TILE_LABEL[tile] || tile;
}

function save() {
  levelStore.customCourseResult = null;
  if (isValid.value || middle.value.length === 0) progressStore.setParkourCourse(middle.value);
}

function addTile(tile) {
  if (middle.value.length >= CUSTOM_COURSE_LIMITS.max) return;
  middle.value = [...middle.value, tile];
  save();
}

function removeTile(i) {
  middle.value = middle.value.filter((_, idx) => idx !== i);
  save();
}

function clearTiles() {
  middle.value = [];
  save();
}

function randomize() {
  const tiles = PALETTE.map((p) => p.id);
  const length = 8 + Math.floor(Math.random() * 7);
  middle.value = Array.from({ length }, () => tiles[Math.floor(Math.random() * tiles.length)]);
  save();
}

function run() {
  if (!canRun.value) return;
  levelStore.runCustomCourse({ code: props.code, middle: middle.value });
}

const copied = ref(false);
async function copyCode() {
  try {
    await navigator.clipboard.writeText(courseCode.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch (e) {
    // 有些教室電腦不允許存取剪貼簿：改成選取文字讓學生自己複製
    importText.value = courseCode.value;
  }
}

const importText = ref('');
const importError = ref('');
function loadCode() {
  const decoded = decodeCourseCode(importText.value);
  if (!decoded) {
    importError.value = `賽道碼看不懂：要以 PK- 開頭，中間 ${CUSTOM_COURSE_LIMITS.min}~${CUSTOM_COURSE_LIMITS.max} 個 R / G / L / H。`;
    return;
  }
  importError.value = '';
  importText.value = '';
  middle.value = decoded;
  save();
}
</script>

<style scoped>
.creator-card {
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.card-section-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
}

.lock-badge {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.74rem;
  color: var(--text-muted);
  background: var(--bg-panel-hover);
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
}

.creator-locked,
.creator-intro {
  margin: 0;
  font-size: 0.86rem;
  color: var(--text-secondary);
  line-height: 1.55;
}

.palette {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.palette-btn {
  flex: 1 1 70px;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-medium);
  background: #ffffff;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
}

.palette-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.course-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  background: #0f172a;
}

.course-tile {
  min-width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 800;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.course-tile.fixed {
  padding: 0 0.4rem;
  font-size: 0.75rem;
}

.tile-btn {
  cursor: pointer;
}

.tile-btn:hover:not(:disabled) {
  outline: 2px solid #f87171;
}

/* 地形配色：與上方「地形感測器對照表」一致 */
.tile-ground { background: #334155; }
.tile-gap { background: #b91c1c; }
.tile-low { background: #c2410c; }
.tile-high { background: #7e22ce; }
.tile-finish { background: #047857; }
.palette-btn.tile-ground { background: #f1f5f9; color: #334155; }
.palette-btn.tile-gap { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.palette-btn.tile-low { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
.palette-btn.tile-high { background: #faf5ff; color: #7e22ce; border-color: #e9d5ff; }

.course-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.link-btn {
  border: none;
  background: none;
  color: var(--primary-blue);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
  text-decoration: underline;
}

.link-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.creator-result {
  font-size: 0.88rem;
  line-height: 1.55;
  padding: 0.55rem 0.7rem;
  border-radius: var(--radius-sm);
}

.creator-result.is-ok {
  background: var(--success-light);
  color: var(--success-dark);
  border: 1px solid var(--success-border);
}

.creator-result.is-bad {
  background: var(--warning-light);
  color: #78350f;
  border: 1px solid var(--warning-border);
}

.share-box {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-subtle);
}

.share-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.share-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.share-code {
  font-family: var(--font-mono);
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--text-primary);
  word-break: break-all;
}

.share-input {
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.85rem;
}

.share-error {
  font-size: 0.8rem;
  color: var(--danger-dark);
}
</style>
