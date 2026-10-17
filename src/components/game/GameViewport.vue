<template>
  <div class="game-viewport-container">
    <!-- Level 6: 2D Webpage Mode (取代 3D，專注 DOM 體驗) -->
    <Level6DomViewport v-if="levelId === 6" />

    <!-- 3D Canvas Mount Point (Level 6 以外) -->
    <div v-else class="canvas-wrapper" ref="canvasContainer"></div>
    <div v-if="levelId !== 6" class="viewport-vignette" aria-hidden="true"></div>

    <!-- 左上角：學生在第 1 關取的船名，一路跟著每一關 -->
    <div v-if="levelId !== 6" class="viewport-telemetry-banner">
      <div class="telemetry-item">
        <span class="beacon-dot"></span>
        <span class="telemetry-label">{{ shipLabel }}</span>
      </div>
      <div class="telemetry-item hide-mobile">
        <span class="telemetry-dim">第 {{ levelNumber }} 站</span>
        <span class="telemetry-val">{{ level.title }}</span>
      </div>
    </div>

    <!-- HUD Overlay Controls (Top Right, 3D only) -->
    <div v-if="levelId !== 6" class="viewport-hud-controls">
      <button class="btn btn-sm hud-btn" @click="resetCamera" title="重設 3D 觀察視角">
        <Compass :size="14" class="icon-hud" />
        <span>視角復位</span>
      </button>
      <button class="btn btn-sm hud-btn btn-action-restore" @click="restoreScene" title="將當前關卡 3D 場景與機器實體還原至出發整備點">
        <RotateCcw :size="14" class="icon-hud" />
        <span>場景還原</span>
      </button>
    </div>

    <!-- Level 7 Custom Drone Fleet HUD -->
    <DroneFleetHUD
      v-if="levelId === 7"
      :drones="droneFleetData"
    />

    <!-- WebGL Context Lost Warning (3D only) -->
    <div v-if="levelId !== 6 && contextLost" class="context-lost-banner">
      <AlertTriangle :size="22" class="text-danger" />
      <div class="banner-text">
        <strong>3D 畫面暫時中斷了</strong>
        <span>電腦的顯示資源被瀏覽器收回，按右邊的按鈕就能重新顯示。</span>
      </div>
      <button class="btn btn-primary btn-sm" @click="reinitScene">重新連線</button>
    </div>

    <!-- 通關卡片：星數、學到了什麼、出場券小測驗、通關碼 -->
    <div v-if="showSuccessModal" class="success-overlay" @click.self="closeSuccess">
      <div class="success-card">
        <div class="confetti-container" aria-hidden="true">
          <span v-for="n in 24" :key="n" class="confetti" :style="confettiStyle(n)">{{ confettiEmoji(n) }}</span>
        </div>

        <div class="success-stars" :aria-label="`獲得 ${earnedStars} 顆星`">
          <Star
            v-for="n in 3"
            :key="n"
            :size="40"
            class="big-star"
            :class="n <= earnedStars ? 'star-on' : 'star-off'"
            :style="{ animationDelay: `${n * 0.18}s` }"
          />
        </div>

        <div class="success-headings">
          <h3 class="success-title">任務圓滿達成！</h3>
          <span class="success-sub">「{{ shipLabel }}」完成第 {{ levelNumber }} 站：{{ level.title }}</span>
        </div>

        <div class="success-feedback-box">
          <p class="success-feedback">{{ feedbackText }}</p>
        </div>

        <div class="recap-box">
          <div class="recap-label">
            <BookOpen :size="15" />
            <span>你剛剛學會了</span>
          </div>
          <p class="recap-text">{{ level.conceptTitle }}</p>
          <button v-if="level.jsCodeExample" class="recap-toggle" @click="showExample = !showExample">
            {{ showExample ? '收起範例寫法' : '看看完整的範例寫法' }}
          </button>
          <pre v-if="showExample" class="recap-code">{{ level.jsCodeExample }}</pre>
        </div>

        <div v-if="level.quiz" class="quiz-box">
          <div class="recap-label">
            <HelpCircle :size="15" />
            <span>出場券：{{ level.quiz.question }}</span>
          </div>
          <pre v-if="level.quiz.code" class="recap-code">{{ level.quiz.code }}</pre>
          <div class="quiz-options">
            <button
              v-for="(opt, idx) in level.quiz.options"
              :key="idx"
              class="quiz-option"
              :class="quizOptionClass(idx)"
              :disabled="quizChoice !== null"
              @click="quizChoice = idx"
            >
              {{ opt }}
            </button>
          </div>
          <p v-if="quizChoice !== null" class="quiz-explain" :class="quizCorrect ? 'is-correct' : 'is-wrong'">
            {{ quizCorrect ? '答對了！' : '再想想～' }}{{ level.quiz.explain }}
          </p>
        </div>

        <div class="pass-code" title="給老師登記用；老師可以在教師密令視窗驗證">
          通關碼 <code>{{ passCode }}</code>
        </div>

        <div class="success-actions">
          <button class="btn btn-secondary btn-sm" @click="closeSuccess">
            留在本站觀察
          </button>
          <button v-if="hasNextLevel" class="btn btn-success" @click="goToNextLevel">
            <span>前往下一站</span>
            <ArrowRight :size="16" />
          </button>
          <button v-else class="btn btn-success" @click="closeSuccess">
            <span>恭喜完成全部課程！</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 沒通過：底部小提示，不擋住 3D 失敗畫面；詳細說明在程式碼區 -->
    <div v-if="showFailModal" class="fail-toast" role="status">
      <span class="fail-toast-icon" aria-hidden="true">{{ failIcon }}</span>
      <div class="fail-toast-text">
        <strong>還差一步！</strong>
        <span>{{ failSummary }}</span>
      </div>
      <div class="fail-toast-actions">
        <button class="btn btn-sm btn-outline" @click="openHint">
          <Lightbulb :size="14" />
          <span>提示</span>
        </button>
        <button class="btn btn-sm btn-primary" @click="restoreAndTune">
          <RotateCcw :size="14" />
          <span>重設場景</span>
        </button>
        <button class="fail-toast-close" @click="closeFail" title="關閉" aria-label="關閉">
          <X :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { Compass, RotateCcw, AlertTriangle, ArrowRight, Lightbulb, Star, BookOpen, HelpCircle, X } from 'lucide-vue-next';
import { SceneManager } from '../../game/core/SceneManager.js';
import { Level1Scene } from '../../game/scenes/Level1Scene.js';
import { Level2Scene } from '../../game/scenes/Level2Scene.js';
import { Level3Scene } from '../../game/scenes/Level3Scene.js';
import { Level4Scene } from '../../game/scenes/Level4Scene.js';
import { Level5Scene } from '../../game/scenes/Level5Scene.js';
import { Level6Scene } from '../../game/scenes/Level6Scene.js';
import { Level7Scene } from '../../game/scenes/Level7Scene.js';
import { Level8Scene } from '../../game/scenes/Level8Scene.js';
import { Level9Scene } from '../../game/scenes/Level9Scene.js';
import { getNextLevelId, getLevelById, getLevelNumber } from '../../levels/index.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { ERROR_DEX } from '../../utils/errorTranslator.js';
import { makePassCode } from '../../utils/passCode.js';
import Level6DomViewport from './Level6DomViewport.vue';
import DroneFleetHUD from './DroneFleetHUD.vue';

const props = defineProps({
  levelId: {
    type: Number,
    required: true
  },
  mockDomState: {
    type: Object,
    default: () => ({})
  },
  lastRunResult: {
    type: Object,
    default: null
  },
  isSuccessModalOpen: {
    type: Boolean,
    default: false
  },
  isFailModalOpen: {
    type: Boolean,
    default: false
  },
  isLowPerformance: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['mock-dom-click', 'next-level', 'close-success', 'close-fail', 'restore-vehicle', 'open-hint', 'register-trigger']);

const canvasContainer = ref(null);
let sceneManager = null;
const contextLost = ref(false);

const showSuccessModal = computed(() => props.isSuccessModalOpen);
const showFailModal = computed(() => props.isFailModalOpen);
const hasNextLevel = computed(() => getNextLevelId(props.levelId) !== null);
const feedbackText = computed(() => props.lastRunResult?.feedback || '所有檢查全部通過！');

const progressStore = useProgressStore();
const level = computed(() => getLevelById(props.levelId));
const levelNumber = computed(() => getLevelNumber(props.levelId));
const shipLabel = computed(() => progressStore.roverName || '探測船');
const earnedStars = computed(() => props.lastRunResult?.data?.stars || 0);
const passCode = computed(() => makePassCode(levelNumber.value, earnedStars.value || 1, progressStore.roverName));

const failInfo = computed(() => props.lastRunResult?.errorInfo || null);
const failIcon = computed(() => ERROR_DEX[failInfo.value?.type]?.icon || '🛠️');
const failSummary = computed(() => {
  const info = failInfo.value;
  if (!info) return '看看程式碼下方的說明，改一下再試一次。';
  if (info.line) return `第 ${info.line} 行：${info.title}（說明在程式碼裡）`;
  const title = info.title || '';
  return title.length > 46 ? `${title.slice(0, 46)}…（完整說明在程式碼下方）` : title;
});

// 出場券：每次打開通關卡片都重新作答
const showExample = ref(false);
const quizChoice = ref(null);
const quizCorrect = computed(() => quizChoice.value === level.value.quiz?.answer);
function quizOptionClass(idx) {
  if (quizChoice.value === null) return '';
  if (idx === level.value.quiz.answer) return 'is-answer';
  if (idx === quizChoice.value) return 'is-picked-wrong';
  return 'is-dimmed';
}
watch(() => props.isSuccessModalOpen, (open) => {
  if (open) {
    quizChoice.value = null;
    showExample.value = false;
  }
});

const droneFleetData = computed(() => {
  const basePositions = [
    { x: -6, y: 5, z: 2 },
    { x: -2, y: 7, z: -3 },
    { x: 3, y: 6, z: 1 },
    { x: 7, y: 4, z: -2 }
  ];
  if (props.lastRunResult?.data?.fleet) {
    return props.lastRunResult.data.fleet.map((d, i) => ({
      ...d,
      x: d.x ?? basePositions[i]?.x ?? 0,
      y: d.y ?? basePositions[i]?.y ?? 5,
      z: d.z ?? basePositions[i]?.z ?? 0,
      status: (d.order === 'RETURN_BASE' || d.battery < 20) ? 'WARNING' : d.order || 'PATROL'
    }));
  }
  return [
    { id: "DRONE-01", x: -6, y: 5, z: 2, battery: 85, status: 'STANDBY' },
    { id: "DRONE-02", x: -2, y: 7, z: -3, battery: 15, status: 'STANDBY' },
    { id: "DRONE-03", x: 3, y: 6, z: 1, battery: 92, status: 'STANDBY' },
    { id: "DRONE-04", x: 7, y: 4, z: -2, battery: 12, status: 'STANDBY' }
  ];
});

function createSceneInstance(id) {
  switch (id) {
    case 1: return new Level1Scene();
    case 2: return new Level2Scene();
    case 3: return new Level3Scene();
    case 4: return new Level4Scene();
    case 5: return new Level5Scene();
    case 6: return new Level6Scene();
    case 7: return new Level7Scene();
    case 8: return new Level8Scene();
    case 9: return new Level9Scene();
    default: return new Level1Scene();
  }
}

function loadLevelScene(id) {
  if (!sceneManager) return;
  const instance = createSceneInstance(id);
  sceneManager.switchGameScene(instance);
}

function resetCamera() {
  if (sceneManager) {
    sceneManager.cameraController.reset();
  }
}

function restoreScene() {
  emit('restore-scene');
  emit('restore-vehicle');
}

function restoreVehicle() {
  restoreScene();
}

function reinitScene() {
  if (sceneManager) {
    sceneManager.dispose();
  }
  contextLost.value = false;
  init3D();
}

function closeSuccess() {
  emit('close-success');
}

function closeFail() {
  emit('close-fail');
}

function restoreAndTune() {
  emit('close-fail');
  restoreScene();
}

function openHint() {
  emit('close-fail');
  emit('open-hint');
}

function goToNextLevel() {
  emit('close-success');
  emit('next-level');
}

// 課堂趣味：純 CSS confetti，免依賴。位置/延遲用確定性偽隨機，避免 hydration 抖動
const CONFETTI_EMOJI = ['🎉', '⭐', '✨', '🚀', '💫'];
function confettiStyle(n) {
  const left = (n * 37) % 100;
  const delay = ((n * 13) % 10) / 10;
  const duration = 1.6 + ((n * 7) % 10) / 10;
  const size = 0.9 + ((n * 11) % 8) / 10;
  return {
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    fontSize: `${size}rem`
  };
}
function confettiEmoji(n) {
  return CONFETTI_EMOJI[n % CONFETTI_EMOJI.length];
}

function init3D() {
  // Level 6 改用 2D 網頁模式，不初始化 WebGL，改註冊空觸發器讓 executeLevel 照常運作
  if (props.levelId === 6) {
    emit('register-trigger', () => {});
    return;
  }
  if (!canvasContainer.value) return;
  sceneManager = new SceneManager(canvasContainer.value);

  sceneManager.onContextLostCallback = () => {
    contextLost.value = true;
  };
  sceneManager.onContextRestoredCallback = () => {
    contextLost.value = false;
  };

  loadLevelScene(props.levelId);

  // Register scene action trigger so levelStore can drive 3D animations
  emit('register-trigger', (actionType, payload) => {
    if (sceneManager && sceneManager.activeGameScene) {
      sceneManager.activeGameScene.handleAction(actionType, payload);
    }
  });
}

onMounted(() => {
  init3D();
});

watch(() => props.levelId, (newId, oldId) => {
  // 切換進出 Level 6 (2D) 時重建 / 釋放 3D 資源
  if (newId === 6) {
    if (sceneManager) {
      sceneManager.dispose();
      sceneManager = null;
    }
    emit('register-trigger', () => {});
    return;
  }
  if (oldId === 6) {
    // 從 2D 切回 3D：等待 canvas 重新掛載後再初始化
    contextLost.value = false;
    setTimeout(() => init3D(), 50);
    return;
  }
  loadLevelScene(newId);
});

watch(() => props.isLowPerformance, (isLow) => {
  if (sceneManager) {
    sceneManager.setLowPerformance(isLow);
  }
});

watch(() => props.lastRunResult, (res) => {
  if (!res || !sceneManager?.cameraController) return;
  if (res.pass) sceneManager.cameraController.kick(0.22);
  else sceneManager.cameraController.kick(0.4);
});

onBeforeUnmount(() => {
  if (sceneManager) {
    sceneManager.dispose();
    sceneManager = null;
  }
});
</script>

<style scoped>
.game-viewport-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f1f5f9;
}

.canvas-wrapper {
  width: 100%;
  height: 100%;
  outline: none;
}

.viewport-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  background:
    radial-gradient(120% 90% at 50% 42%, transparent 58%, rgba(15, 23, 42, 0.14) 100%),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.35), transparent 18%, transparent 84%, rgba(15, 23, 42, 0.08));
}

.viewport-telemetry-banner {
  position: absolute;
  top: 0.85rem;
  left: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-subtle);
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-md);
  z-index: 10;
  pointer-events: none;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  box-shadow: var(--shadow-sm);
}

.beacon-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success);
  display: inline-block;
  box-shadow: 0 0 8px var(--success-glow);
}

.telemetry-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.telemetry-label {
  color: var(--primary-blue);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.telemetry-dim {
  color: var(--text-muted);
}

.telemetry-val {
  color: var(--text-primary);
  font-weight: 600;
}

.viewport-hud-controls {
  position: absolute;
  top: 0.85rem;
  right: 1rem;
  display: flex;
  gap: 0.4rem;
  z-index: 10;
  pointer-events: auto;
}

.hud-btn {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 0.78rem;
  padding: 0.35rem 0.75rem;
  box-shadow: var(--shadow-sm);
}

.hud-btn:hover {
  border-color: var(--primary-blue);
  background: var(--primary-blue-light);
  color: var(--primary-blue);
}

.icon-hud {
  color: var(--primary-blue);
}

.context-lost-banner {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--danger-light);
  border: 1px solid var(--danger-border);
  backdrop-filter: blur(12px);
  padding: 0.85rem 1.35rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 1rem;
  z-index: 25;
  box-shadow: var(--shadow-elevated);
}

.banner-text {
  display: flex;
  flex-direction: column;
  font-size: 0.82rem;
  color: var(--danger-dark);
  gap: 0.15rem;
}

/* 通關卡片：淡色背景、不模糊，學生還看得到 3D 通關畫面 */
.success-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  padding: 1rem;
  animation: fadeIn 0.25s ease-out;
}

.success-card {
  width: 100%;
  max-width: 500px;
  max-height: 100%;
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid var(--success-border);
  box-shadow: var(--shadow-elevated), 0 0 30px rgba(16, 185, 129, 0.2);
  padding: 1.5rem 1.6rem;
  text-align: center;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  animation: modalEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

.confetti-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.confetti {
  position: absolute;
  top: -2rem;
  animation: confettiFall linear infinite;
  opacity: 0.9;
}

@keyframes confettiFall {
  0% { transform: translateY(-2rem) rotate(0deg); opacity: 1; }
  100% { transform: translateY(22rem) rotate(360deg); opacity: 0.2; }
}

@keyframes modalEnter {
  from { opacity: 0; transform: scale(0.92) translateY(12px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.success-stars {
  display: flex;
  gap: 0.35rem;
}

.big-star {
  animation: starPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.big-star.star-on {
  color: #f59e0b;
  fill: #fbbf24;
  filter: drop-shadow(0 2px 6px rgba(245, 158, 11, 0.45));
}

.big-star.star-off {
  color: #cbd5e1;
}

@keyframes starPop {
  from { transform: scale(0.2) rotate(-30deg); opacity: 0; }
  to { transform: scale(1) rotate(0); opacity: 1; }
}

.success-headings {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.success-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.success-sub {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.success-feedback-box {
  background: var(--success-light);
  border: 1px solid var(--success-border);
  border-radius: var(--radius-md);
  padding: 0.7rem 1rem;
  width: 100%;
}

.success-feedback {
  font-size: 0.9rem;
  color: var(--success-dark);
  line-height: 1.6;
}

.recap-box,
.quiz-box {
  width: 100%;
  text-align: left;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.7rem 0.9rem;
  background: var(--bg-panel-hover);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.recap-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--text-purple);
}

.recap-text {
  font-size: 0.92rem;
  color: var(--text-primary);
  font-weight: 600;
  margin: 0;
}

.recap-toggle {
  align-self: flex-start;
  border: none;
  background: none;
  padding: 0;
  font-size: 0.82rem;
  color: var(--primary-blue);
  cursor: pointer;
  text-decoration: underline;
}

.recap-code {
  margin: 0;
  padding: 0.55rem 0.7rem;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-x: auto;
}

.quiz-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.quiz-option {
  flex: 1 1 auto;
  min-height: 40px;
  padding: 0.45rem 0.7rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-medium);
  background: #ffffff;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quiz-option:hover:not(:disabled) {
  border-color: var(--primary-blue);
  background: var(--primary-blue-light);
}

.quiz-option:disabled {
  cursor: default;
}

.quiz-option.is-answer {
  border-color: var(--success);
  background: var(--success-light);
  color: var(--success-dark);
}

.quiz-option.is-picked-wrong {
  border-color: var(--warning);
  background: var(--warning-light);
  color: #92400e;
}

.quiz-option.is-dimmed {
  opacity: 0.55;
}

.quiz-explain {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.55;
}

.quiz-explain.is-correct {
  color: var(--success-dark);
}

.quiz-explain.is-wrong {
  color: #92400e;
}

.pass-code {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.pass-code code {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary);
  background: var(--bg-panel-hover);
  border: 1px dashed var(--border-medium);
  padding: 0.1rem 0.45rem;
  border-radius: 6px;
  letter-spacing: 0.06em;
}

.success-actions {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  justify-content: center;
}

/* 沒通過：底部小提示，不蓋住 3D 畫面 */
.fail-toast {
  position: absolute;
  left: 50%;
  bottom: 1rem;
  transform: translateX(-50%);
  width: calc(100% - 2rem);
  max-width: 560px;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 0.8rem;
  background: var(--warning-light);
  border: 1px solid var(--warning-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-elevated);
  animation: toastUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes toastUp {
  from { opacity: 0; transform: translate(-50%, 12px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

.fail-toast-icon {
  font-size: 1.5rem;
}

.fail-toast-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  color: #78350f;
  font-size: 0.86rem;
  line-height: 1.45;
}

.fail-toast-text strong {
  font-size: 0.95rem;
}

.fail-toast-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.fail-toast-close {
  border: none;
  background: none;
  color: #92400e;
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
}

.btn-action-restore {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.btn-action-restore:hover {
  background: #dbeafe;
}

@media (max-width: 600px) {
  .hide-mobile {
    display: none;
  }
}
</style>
