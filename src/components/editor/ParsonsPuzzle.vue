<template>
  <div class="parsons">
    <p class="parsons-prompt">🧩 {{ puzzle.prompt }}</p>

    <!-- 學生排好的程式 -->
    <div class="answer-area">
      <div class="area-label">你的程式（拖曳或按 ↑↓ 調整順序，點一下可以拿掉）</div>
      <ol class="answer-list" :class="{ 'is-empty': answer.length === 0 }" @dragover.prevent @drop="dropAtEnd">
        <li
          v-for="(item, idx) in answer"
          :key="item.id"
          class="code-row"
          :class="rowClass(idx)"
          draggable="true"
          @dragstart="dragIndex = idx"
          @dragover.prevent
          @drop.stop="dropOn(idx)"
        >
          <span class="row-num">{{ idx + 1 }}</span>
          <code class="row-code" @click="removeAt(idx)">{{ item.text }}</code>
          <span class="row-tools">
            <button class="row-btn" :disabled="idx === 0" title="往上移" @click="move(idx, -1)">↑</button>
            <button class="row-btn" :disabled="idx === answer.length - 1" title="往下移" @click="move(idx, 1)">↓</button>
          </span>
        </li>
        <li v-if="answer.length === 0" class="empty-hint">點下面的程式碼，把它們一行一行排進來</li>
      </ol>
    </div>

    <!-- 還沒用到的程式碼 -->
    <div class="pool-area">
      <div class="area-label">可以用的程式碼（有些是陷阱，不一定全部用得到）</div>
      <div class="pool-list">
        <button v-for="item in pool" :key="item.id" class="code-chip" @click="addToAnswer(item)">
          <code>{{ item.text.trim() }}</code>
        </button>
        <span v-if="pool.length === 0" class="empty-hint">全部都排進去了</span>
      </div>
    </div>

    <div class="parsons-actions">
      <button class="btn btn-sm parsons-check" @click="check">檢查順序</button>
      <button class="btn btn-sm parsons-reset" @click="reset">重新洗牌</button>
      <span v-if="feedback" class="parsons-feedback" :class="result?.ok ? 'is-ok' : 'is-bad'">{{ feedback }}</span>
    </div>
    <p v-if="result?.ok" class="parsons-explain">💡 {{ puzzle.explain }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { checkParsons, shuffleLines } from '../../utils/parsons.js';

const props = defineProps({
  puzzle: { type: Object, required: true }
});
const emit = defineEmits(['solved']);

const pool = ref([]);
const answer = ref([]);
const result = ref(null);
const dragIndex = ref(null);

function reset() {
  const lines = [...props.puzzle.solution.flat(), ...(props.puzzle.distractors || [])];
  pool.value = shuffleLines(lines).map((text, i) => ({ id: `${i}-${text}`, text }));
  answer.value = [];
  result.value = null;
}
reset();

function addToAnswer(item) {
  pool.value = pool.value.filter((p) => p.id !== item.id);
  answer.value = [...answer.value, item];
  result.value = null;
}

function removeAt(idx) {
  const [item] = answer.value.splice(idx, 1);
  pool.value = [...pool.value, item];
  result.value = null;
}

function move(idx, delta) {
  const target = idx + delta;
  if (target < 0 || target >= answer.value.length) return;
  const list = [...answer.value];
  [list[idx], list[target]] = [list[target], list[idx]];
  answer.value = list;
  result.value = null;
}

function moveTo(from, to) {
  if (from === null || from === to) return;
  const list = [...answer.value];
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  answer.value = list;
  result.value = null;
}

function dropOn(idx) {
  moveTo(dragIndex.value, idx);
  dragIndex.value = null;
}

function dropAtEnd() {
  moveTo(dragIndex.value, answer.value.length - 1);
  dragIndex.value = null;
}

function check() {
  result.value = checkParsons(
    props.puzzle.solution,
    answer.value.map((a) => a.text),
    props.puzzle.distractors || []
  );
  if (result.value.ok) emit('solved');
}

const FEEDBACK = {
  empty: '先把程式碼排進上面的框框裡吧！',
  trap: '有一行是陷阱，這題用不到它（標黃色的那行），把它拿掉試試。',
  wrong: '標黃色的那一行位置不對，想想看它應該在前面還是後面？',
  missing: '順序都對！但還少了幾行，繼續從下面挑。',
  extra: '多放了用不到的程式碼，把標黃色的拿掉。'
};
const feedback = computed(() => {
  if (!result.value) return '';
  return result.value.ok ? '🎉 排對了！' : FEEDBACK[result.value.reason];
});

function rowClass(idx) {
  if (!result.value) return '';
  if (result.value.ok) return 'is-correct';
  return idx === result.value.wrongAt ? 'is-wrong' : '';
}
</script>

<style scoped>
.parsons {
  height: 100%;
  overflow-y: auto;
  padding: 0.75rem 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  color: #e2e8f0;
  font-family: var(--font-sans);
}

.parsons-prompt {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.5;
  color: #f8fafc;
}

.area-label {
  font-size: 0.76rem;
  color: #94a3b8;
  margin-bottom: 0.3rem;
}

.answer-list {
  list-style: none;
  margin: 0;
  padding: 0.35rem;
  min-height: 52px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.code-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.35rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  cursor: grab;
}

.code-row.is-wrong {
  background: rgba(251, 191, 36, 0.18);
  border-color: #fbbf24;
}

.code-row.is-correct {
  background: rgba(16, 185, 129, 0.16);
  border-color: rgba(16, 185, 129, 0.5);
}

.row-num {
  width: 1.4rem;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: #64748b;
  flex-shrink: 0;
}

.row-code {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 0.86rem;
  /* 保留縮排，但太長就換行，不要出現橫向捲軸 */
  white-space: pre-wrap;
  word-break: break-word;
  cursor: pointer;
}

.row-tools {
  display: flex;
  gap: 0.2rem;
  flex-shrink: 0;
}

.row-btn {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
  cursor: pointer;
  font-size: 0.8rem;
}

.row-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.pool-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.code-chip {
  padding: 0.3rem 0.55rem;
  border-radius: 6px;
  border: 1px solid rgba(103, 232, 249, 0.35);
  background: rgba(8, 145, 178, 0.14);
  color: #e0f2fe;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.84rem;
  text-align: left;
  transition: all var(--transition-fast);
}

.code-chip:hover {
  background: rgba(8, 145, 178, 0.3);
  border-color: #22d3ee;
}

.empty-hint {
  font-size: 0.8rem;
  color: #64748b;
  padding: 0.35rem;
}

.parsons-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.parsons-check {
  background: #0891b2;
  border-color: #0891b2;
  color: #ffffff;
}

.parsons-reset {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
  color: #cbd5e1;
}

.parsons-feedback {
  font-size: 0.86rem;
  font-weight: 700;
}

.parsons-feedback.is-ok {
  color: #6ee7b7;
}

.parsons-feedback.is-bad {
  color: #fcd34d;
}

.parsons-explain {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.55;
  color: #a7f3d0;
  background: rgba(16, 185, 129, 0.1);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.65rem;
}
</style>
