<template>
  <div class="run-feedback">
    <!-- 執行前先預測：讓學生在按下執行前讀一遍自己的程式 -->
    <div v-if="levelStore.isPredicting" class="fb-card fb-predict">
      <div class="fb-title">
        <span aria-hidden="true">🔮</span>
        <span>按下執行之前，先猜猜看！</span>
      </div>
      <p class="fb-text">從頭讀一遍你的程式，你覺得結果會是：</p>
      <div class="predict-options">
        <button
          v-for="opt in PREDICTION_OPTIONS"
          :key="opt.id"
          class="predict-option"
          @click="levelStore.submitPrediction(opt.id)"
        >
          <span aria-hidden="true">{{ opt.icon }}</span>
          <span>{{ opt.label }}</span>
        </button>
      </div>
      <div class="predict-footer">
        <label class="predict-toggle">
          <input
            type="checkbox"
            :checked="progressStore.predictEveryRun"
            @change="progressStore.setPredictEveryRun($event.target.checked)"
          />
          <span>每次執行前都先預測</span>
        </label>
        <button class="predict-skip" @click="levelStore.submitPrediction(null)">跳過，直接執行</button>
      </div>
    </div>

    <!-- 預測對答案 -->
    <div v-if="prediction && !levelStore.isExecuting && !levelStore.isPredicting" class="predict-result" :class="prediction.correct ? 'is-correct' : 'is-wrong'">
      <span aria-hidden="true">🔮</span>
      <span>
        你猜「{{ optionText(prediction.predicted, 'label') }}」，結果{{ optionText(prediction.actual, 'outcome') }}——
        {{ prediction.correct ? '猜對了！你已經讀得懂自己的程式 🎯' : '猜錯也沒關係，想想看：結果哪裡跟你想的不一樣？' }}
      </span>
    </div>

    <!-- 執行中 -->
    <div v-if="levelStore.isExecuting" class="fb-card fb-running">
      <Loader2 :size="16" class="spin" />
      <span>程式執行中，看看左邊的場景…</span>
    </div>

    <!-- L6 送審通過，等學生親手操作 -->
    <div v-else-if="levelStore.l6CodeApproved" class="fb-card fb-pass">
      <div class="fb-title">
        <CheckCircle2 :size="16" />
        <span>程式接線正確！</span>
      </div>
      <p class="fb-text">到上方網頁親手點擊「解除警報」→「開啟氣閘」，完成後自動過關。</p>
    </div>

    <!-- 通關 -->
    <div v-else-if="result?.pass" class="fb-card fb-pass">
      <div class="fb-title">
        <CheckCircle2 :size="16" />
        <span>通關！</span>
        <span class="fb-stars" :aria-label="`${stars} 顆星`">
          <Star v-for="n in 3" :key="n" :size="15" :class="n <= stars ? 'star-on' : 'star-off'" />
        </span>
      </div>
      <p class="fb-text">{{ result.feedback }}</p>
    </div>

    <!-- 未通過 -->
    <div v-else-if="result && !result.pass && info" class="fb-card fb-fail">
      <div class="fb-title">
        <span class="fb-icon" aria-hidden="true">{{ dexIcon }}</span>
        <span>還差一步！</span>
        <span class="fb-tag">{{ dexName }}</span>
      </div>
      <p v-if="info.line" class="fb-text">
        <strong>第 {{ info.line }} 行：{{ info.title }}</strong>
        <span class="fb-pointer">詳細說明標在程式碼的黃色那一行 ↑</span>
      </p>
      <template v-else>
        <p class="fb-text"><strong>{{ info.title }}</strong></p>
        <p v-if="info.explain" class="fb-text">{{ info.explain }}</p>
      </template>
      <div class="fb-actions">
        <button class="btn btn-sm fb-hint-btn" @click="levelStore.toggleHintModal(true)">
          <Lightbulb :size="14" />
          <span>看提示（已解鎖 {{ levelStore.unlockedHintCount }}/{{ totalHints }}）</span>
        </button>
        <span class="fb-encourage">{{ encouragement }}</span>
      </div>
    </div>

    <!-- 變數盒子：程式跑完後，最外層變數裡裝了什麼（逐步模式時改看編輯器下方那一步的值） -->
    <div v-if="showVarBoxes" class="var-boxes">
      <div class="section-label">
        <Box :size="13" />
        <span>變數盒子（程式跑完後，盒子裡裝了什麼）</span>
      </div>
      <div class="box-row">
        <div v-for="v in variables" :key="v.name" class="var-box" :class="`type-${v.type}`">
          <span class="box-label">{{ v.kind }} {{ v.name }}</span>
          <code class="box-value">{{ v.display }}</code>
          <span class="box-type">{{ typeName(v.type) }}</span>
        </div>
      </div>
    </div>

    <!-- console.log 輸出 -->
    <div v-if="consoleLines.length > 0" class="console-out">
      <div class="section-label">
        <Terminal :size="13" />
        <span>console.log 輸出</span>
      </div>
      <div v-for="line in consoleLines" :key="line.id" class="console-line" :class="{ 'is-error': line.type === 'error' }">
        {{ line.text }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { CheckCircle2, Lightbulb, Loader2, Star, Box, Terminal } from 'lucide-vue-next';
import { useLevelStore, PREDICTION_OPTIONS } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { ERROR_DEX } from '../../utils/errorTranslator.js';

const levelStore = useLevelStore();
const progressStore = useProgressStore();

const prediction = computed(() => levelStore.predictionResult);
function optionText(id, field) {
  return PREDICTION_OPTIONS.find((o) => o.id === id)?.[field] || id;
}

const result = computed(() => levelStore.lastRunResult);
const info = computed(() => result.value?.errorInfo || null);
const stars = computed(() => result.value?.data?.stars || 0);
const totalHints = computed(() => levelStore.currentLevel.hints?.length || 0);
const variables = computed(() => levelStore.lastVariables || []);
const showVarBoxes = computed(
  () => variables.value.length > 0 && !levelStore.isExecuting && levelStore.traceIndex === null
);
const dexName = computed(() => ERROR_DEX[info.value?.type]?.name || '');
const dexIcon = computed(() => ERROR_DEX[info.value?.type]?.icon || '🛠️');

const ENCOURAGEMENTS = [
  '除錯是工程師每天的工作 💪',
  '每個錯誤都是線索 🔍',
  '改一個地方，再跑一次看看 🚀',
  '越來越接近了！✨'
];
const encouragement = computed(() => ENCOURAGEMENTS[levelStore.failCount % ENCOURAGEMENTS.length]);

const consoleLines = computed(() =>
  levelStore.executionLogs
    .filter((l) => l.message.startsWith('console.'))
    .slice(-6)
    .map((l) => ({ id: l.id, type: l.type, text: l.message.replace(/^console\.\w+: /, '') }))
);

const TYPE_NAMES = {
  string: '字串 String',
  number: '數字 Number',
  boolean: '布林 Boolean',
  array: '陣列 Array',
  object: '物件 Object',
  function: '函式 Function',
  undefined: 'undefined（空的）',
  null: 'null（空的）'
};
function typeName(type) {
  return TYPE_NAMES[type] || type;
}
</script>

<style scoped>
.run-feedback {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.fb-card {
  border-radius: var(--radius-md);
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.fb-predict {
  background: #f5f3ff;
  border-color: #c4b5fd;
  color: #4c1d95;
}

.predict-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.predict-option {
  flex: 1 1 140px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.45rem 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid #c4b5fd;
  background: #ffffff;
  color: #4c1d95;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.predict-option:hover {
  background: #ede9fe;
  border-color: #8b5cf6;
}

.predict-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.8rem;
}

.predict-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
}

.predict-skip {
  border: none;
  background: none;
  color: #6d28d9;
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
}

.predict-result {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.5rem 0.7rem;
  border-radius: var(--radius-sm);
  font-size: 0.86rem;
  line-height: 1.5;
}

.predict-result.is-correct {
  background: #f5f3ff;
  color: #5b21b6;
}

.predict-result.is-wrong {
  background: var(--bg-panel-hover);
  color: var(--text-secondary);
}

.fb-running {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  background: var(--bg-panel-hover);
  font-size: 0.9rem;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.fb-pass {
  background: var(--success-light);
  border-color: var(--success-border);
  color: var(--success-dark);
}

.fb-fail {
  background: var(--warning-light);
  border-color: var(--warning-border);
  color: #78350f;
}

.fb-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 800;
  font-size: 0.98rem;
}

.fb-icon {
  font-size: 1.05rem;
}

.fb-tag {
  margin-left: auto;
  font-size: 0.74rem;
  font-weight: 700;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: #fde68a;
  color: #78350f;
}

.fb-stars {
  margin-left: auto;
  display: inline-flex;
  gap: 2px;
}

.star-on {
  color: #f59e0b;
  fill: #f59e0b;
}

.star-off {
  color: #cbd5e1;
}

.fb-text {
  font-size: 0.9rem;
  line-height: 1.6;
  margin: 0;
}

.fb-pointer {
  display: block;
  font-size: 0.82rem;
  color: #92400e;
}

.fb-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 0.15rem;
}

.fb-hint-btn {
  background: #ffffff;
  border: 1px solid #fcd34d;
  color: #92400e;
}

.fb-hint-btn:hover {
  background: #fef3c7;
}

.fb-encourage {
  font-size: 0.8rem;
  color: #92400e;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 0.35rem;
}

.box-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.var-box {
  min-width: 110px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.45rem 0.6rem;
  border-radius: var(--radius-sm);
  border: 2px solid var(--border-medium);
  background: #ffffff;
}

.box-label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.box-value {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  word-break: break-all;
}

.box-type {
  font-size: 0.72rem;
  font-weight: 700;
}

/* 型態配色：與第 1 關的型態提示一致（字串粉、數字藍、布林綠） */
.type-string { border-color: #f9a8d4; background: #fdf2f8; }
.type-string .box-type { color: #be185d; }
.type-number { border-color: #93c5fd; background: #eff6ff; }
.type-number .box-type { color: #1d4ed8; }
.type-boolean { border-color: #86efac; background: #f0fdf4; }
.type-boolean .box-type { color: #15803d; }
.type-array,
.type-object { border-color: #c4b5fd; background: #f5f3ff; }
.type-array .box-type,
.type-object .box-type { color: #6d28d9; }
.type-function { border-color: #fcd34d; background: #fffbeb; }
.type-function .box-type { color: #b45309; }
.type-undefined,
.type-null { border-style: dashed; }
.type-undefined .box-type,
.type-null .box-type { color: var(--text-muted); }

.console-out {
  background: #0f172a;
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.65rem;
}

.console-out .section-label {
  color: #94a3b8;
}

.console-line {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}

.console-line.is-error {
  color: #fca5a5;
}
</style>
