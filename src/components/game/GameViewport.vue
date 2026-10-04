<template>
  <div class="game-viewport-container">
    <!-- Level 6: 2D Webpage Mode (取代 3D，專注 DOM 體驗) -->
    <Level6DomViewport v-if="levelId === 6" />

    <!-- 3D Canvas Mount Point (Level 6 以外) -->
    <div v-else class="canvas-wrapper" ref="canvasContainer"></div>
    <div v-if="levelId !== 6" class="viewport-vignette" aria-hidden="true"></div>

    <!-- Viewport Optical HUD Header (Top Left / Right) -->
    <div v-if="levelId !== 6" class="viewport-telemetry-banner">
      <div class="telemetry-item">
        <span class="beacon-dot"></span>
        <span class="telemetry-label">3D OPTICAL SENSOR</span>
      </div>
      <div class="telemetry-item hide-mobile">
        <span class="telemetry-dim">SUB-ORBIT:</span>
        <span class="telemetry-val">ALT 142.8 KM</span>
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
        <strong>3D 圖形核心中斷 · WEBGL CONTEXT INTERRUPTED</strong>
        <span>瀏覽器已釋放 GPU 圖形資源，請點擊右側按鈕重新建立連線。</span>
      </div>
      <button class="btn btn-primary btn-sm" @click="reinitScene">重新連線</button>
    </div>

    <!-- Level Complete Success Milestone Modal -->
    <div v-if="showSuccessModal" class="success-overlay" @click.self="closeSuccess">
      <div class="success-card glass-panel pulse-glow">
        <div class="confetti-container" aria-hidden="true">
          <span v-for="n in 24" :key="n" class="confetti" :style="confettiStyle(n)">{{ confettiEmoji(n) }}</span>
        </div>
        <div class="success-badge-container">
          <div class="badge-ring"></div>
          <div class="success-icon-wrapper">
            <Award :size="42" class="icon-award" />
          </div>
        </div>

        <div class="success-headings">
          <span class="sub-heading">MISSION NOMINAL · TELEMETRY VERIFIED</span>
          <h3 class="success-title">任務圓滿達成！</h3>
        </div>

        <div class="success-feedback-box">
          <p class="success-feedback">{{ feedbackText }}</p>
        </div>

        <div class="success-actions">
          <button class="btn btn-secondary btn-sm" @click="closeSuccess">
            留在本站觀察
          </button>
          <button v-if="hasNextLevel" class="btn btn-success" @click="goToNextLevel">
            <span>前往下一站導航</span>
            <ArrowRight :size="16" />
          </button>
          <button v-else class="btn btn-success" @click="closeSuccess">
            <span>恭喜通關全課程！</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Level Failed Diagnostic Alert Modal (UX Consistency with Success Modal) -->
    <div v-if="showFailModal" class="fail-overlay" @click.self="closeFail">
      <div class="fail-card glass-panel pulse-glow-amber">
        <div class="fail-badge-container">
          <div class="fail-badge-ring"></div>
          <div class="fail-icon-wrapper">
            <AlertTriangle :size="38" class="icon-fail" />
          </div>
        </div>

        <div class="fail-headings">
          <span class="sub-heading text-warning">DIAGNOSTIC ALERT · TELEMETRY INCOMPLETE</span>
          <h3 class="fail-title">遙測自檢未通過</h3>
        </div>

        <div class="fail-feedback-box">
          <p class="fail-feedback">{{ failureErrorText }}</p>
        </div>

        <div class="fail-suggestion-box">
          <div class="suggestion-header">
            <Lightbulb :size="14" class="text-brand" />
            <strong class="suggestion-title">💡 偵錯建議指引：</strong>
          </div>
          <p class="suggestion-text">{{ failureSuggestionText }}</p>
        </div>

        <div class="fail-actions">
          <button class="btn btn-secondary btn-sm" @click="closeFail">
            留在現場觀察
          </button>
          <button class="btn btn-outline btn-sm" @click="openHint">
            <Lightbulb :size="15" />
            <span>查看思考提示</span>
          </button>
          <button class="btn btn-primary" @click="restoreAndTune">
            <RotateCcw :size="15" />
            <span>場景還原並調整</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { Compass, RotateCcw, AlertTriangle, Award, ArrowRight, Lightbulb } from 'lucide-vue-next';
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
import { getNextLevelId } from '../../levels/index.js';
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
const feedbackText = computed(() => props.lastRunResult?.feedback || '探測船邏輯自檢完成，所有遙測數據全數通過！');
const failureErrorText = computed(() => props.lastRunResult?.error || '遙測數據自檢未通過，請檢查參數設定。');

const failureSuggestionText = computed(() => {
  const err = failureErrorText.value;
  if (err.includes('未命名')) return 'JavaScript 變數需賦予字串型態，請在控制面板輸入船艦名稱或點選快速代號。';
  if (err.includes('能源不足') || err.includes('功率')) return '系統最低需 80% 功率才能啟動反應爐，請拖曳功率滑桿至 80%~100% 安全範圍。';
  if (err.includes('防護力場') || err.includes('防護罩')) return '外太空充滿輻射危險，請將 shieldActive 設為 true (布林值真)。';
  if (err.includes('推力不足') || err.includes('尚未抵達補給站')) return '位移 = 推力次數 × 每次速度。目標補給站位於 24 單位，請調高次數或速度達到 24！';
  if (err.includes('超速') || err.includes('超出')) return '探測船衝過頭了！請計算 推力次數 × 速度 剛好等於 24，避免超過補給站。';
  if (err.includes('燃料不足') || err.includes('燃料耗盡')) return '總耗油 = 推力次數 × 每次燃燒量。請調高初始燃料或調整推力次數以避免油料用罄。';
  if (err.includes('採集數量不足')) return '迴圈執行次數過少，請將 for 迴圈次數調高以採集完 5 顆能量水晶。';
  if (err.includes('模組型號')) return '當前模組掃描半徑不足，請更換為高階感測模組並調用 scanArea() 方法。';
  if (err.includes('安全警報')) return '尚未解除警報！請在按鈕上觸發設定的 DOM 事件（如點擊或連擊）。';
  if (err.includes('墜毀')) return '低電量無人機因電量不足墜毀！請提高安全電量門檻，並將低電量無人機設為返航充電。';
  if (err.includes('氣象') || err.includes('fetch')) return '尚未取得即時氣象遙測資料，請點擊 API 請求並校準安全發射係數。';
  return '請參閱任務目標與通關要求，調整控制面板中的對應參數後再次測試！';
});

const droneFleetData = computed(() => {
  if (props.lastRunResult?.data?.fleet) {
    return props.lastRunResult.data.fleet;
  }
  return [
    { id: "drone-01", x: -6, y: 5, z: 2, battery: 85, status: 'STANDBY' },
    { id: "drone-02", x: -2, y: 7, z: -3, battery: 18, status: 'STANDBY' },
    { id: "drone-03", x: 3, y: 6, z: 1, battery: 92, status: 'STANDBY' },
    { id: "drone-04", x: 7, y: 4, z: -2, battery: 15, status: 'STANDBY' }
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

/* Success Milestone Modal */
.success-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  padding: 1.5rem;
}

.success-card {
  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border: 1px solid var(--success-border);
  box-shadow: var(--shadow-elevated), 0 0 30px rgba(16, 185, 129, 0.2);
  padding: 2.2rem;
  text-align: center;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.15rem;
  animation: modalEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
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

.success-badge-container {
  position: relative;
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px dashed rgba(16, 185, 129, 0.5);
  animation: rotateRing 12s linear infinite;
}

@keyframes rotateRing {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.success-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--success-light);
  border: 2px solid var(--success);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px var(--success-glow);
}

.icon-award {
  color: var(--success-dark);
}

.success-headings {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.sub-heading {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--success-dark);
  letter-spacing: 0.08em;
}

.success-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.success-feedback-box {
  background: var(--success-light);
  border: 1px solid var(--success-border);
  border-radius: var(--radius-md);
  padding: 0.85rem 1.1rem;
  width: 100%;
}

.success-feedback {
  font-size: 0.92rem;
  color: var(--success-dark);
  line-height: 1.6;
}

.success-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.4rem;
  width: 100%;
  justify-content: center;
}

/* ==========================================================================
   Failure Diagnostic Alert Modal Styles (Consistent with Success Modal)
   ========================================================================== */
.pulse-glow-amber {
  box-shadow: 0 20px 48px rgba(239, 68, 68, 0.12), 0 0 0 1px rgba(239, 68, 68, 0.2);
}

.fail-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 80;
  padding: 1.5rem;
  animation: fadeIn 0.25s ease-out;
}

.fail-card {
  max-width: 480px;
  width: 100%;
  background: #ffffff;
  border-radius: var(--radius-lg);
  padding: 2rem 1.8rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.1rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.fail-badge-container {
  position: relative;
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fail-badge-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px dashed rgba(239, 68, 68, 0.45);
  animation: rotateRing 12s linear infinite reverse;
}

.fail-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #fef2f2;
  border: 2px solid #ef4444;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.25);
}

.icon-fail {
  color: #dc2626;
}

.fail-headings {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.fail-title {
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.fail-feedback-box {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-md);
  padding: 0.85rem 1.1rem;
  width: 100%;
}

.fail-feedback {
  font-size: 0.92rem;
  color: #b91c1c;
  line-height: 1.6;
  font-weight: 600;
}

.fail-suggestion-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-md);
  padding: 0.85rem 1.1rem;
  width: 100%;
  text-align: left;
}

.suggestion-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.35rem;
}

.suggestion-title {
  font-size: 0.84rem;
  color: var(--text-primary);
}

.suggestion-text {
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.55;
  margin: 0;
}

.fail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.4rem;
  width: 100%;
  justify-content: center;
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
