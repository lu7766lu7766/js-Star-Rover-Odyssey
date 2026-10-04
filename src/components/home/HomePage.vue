<template>
  <div class="home-container">
    <!-- Top Bar for Home Page -->
    <header class="home-header">
      <div class="brand">
        <div class="brand-icon">
          <Compass :size="24" class="text-brand" />
        </div>
        <div class="brand-text">
          <h1 class="brand-title">Star Rover Odyssey 2.0</h1>
          <span class="brand-subtitle">星際巡航：高中 JavaScript 互動式遊戲探索平台</span>
        </div>
      </div>

      <div class="header-actions">
        <!-- Audio Mute Toggle -->
        <button class="btn btn-outline btn-sm" @click="toggleSound" :title="progressStore.isSoundMuted ? '開啟音效' : '靜音'">
          <VolumeX v-if="progressStore.isSoundMuted" :size="16" class="text-muted" />
          <Volume2 v-else :size="16" class="text-brand" />
          <span class="hide-mobile">{{ progressStore.isSoundMuted ? '靜音' : '音效開' }}</span>
        </button>

        <!-- Save Export & Import -->
        <button class="btn btn-outline btn-sm" @click="exportSave" title="匯出存檔 JSON">
          <Download :size="16" />
          <span class="hide-mobile">匯出存檔</span>
        </button>

        <label class="btn btn-outline btn-sm import-label" title="匯入存檔 JSON">
          <Upload :size="16" />
          <span class="hide-mobile">匯入存檔</span>
          <input type="file" accept=".json" @change="handleImportFile" class="file-input-hidden" />
        </label>

        <!-- Help Guide -->
        <button class="btn btn-outline btn-sm" @click="showGuide = true" title="操作說明">
          <HelpCircle :size="16" />
          <span class="hide-mobile">操作說明</span>
        </button>

        <!-- Secret Cheat Code for Teachers -->
        <button class="btn btn-ghost btn-sm" @click="openCheatModal" title="開發者 / 教師模式">
          <Key :size="16" />
        </button>
      </div>
    </header>

    <!-- Main Map & Progress Section -->
    <main class="home-content">
      <!-- Hero Banner -->
      <section class="hero-section">
        <div class="hero-badge badge badge-blue">
          <Sparkles :size="14" />
          <span>遊戲優先 · 零程式門檻 · 視覺化學習</span>
        </div>
        <h2 class="hero-heading">探索 JavaScript 星系的核心奧秘</h2>
        <p class="hero-desc">
          無需背誦複雜語法，透過操作指令卡、調節飛行參數、搭建條件與迴圈積木，即時驅動 3D 太空探測船，在冒險中自然掌握核心程式思維！
        </p>
        
        <div class="hero-actions">
          <button class="btn btn-primary hero-btn" @click="startAdventure">
            <Play :size="18" />
            <span>開始冒險 (第 {{ getLevelNumber(nextPlayableLevel) }} 關)</span>
          </button>
        </div>

        <!-- Overall Progress Bar Card -->
        <div class="progress-card card">
          <div class="progress-info">
            <span class="progress-label">航程總進度</span>
            <span class="progress-value">{{ progressStore.completedLevels.length }} / {{ ALL_LEVELS.length }} 站點已通關 ({{ progressStore.progressPercentage }}%)</span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" :style="{ width: `${progressStore.progressPercentage}%` }"></div>
          </div>
        </div>
      </section>

      <!-- Level Exploration Map -->
      <section class="map-section">
        <div class="section-title-wrap">
          <h3 class="section-title">星際航線地圖 (Mission Starmap)</h3>
          <span class="section-subtitle">點擊已解鎖的站點即可進入關卡</span>
        </div>

        <div class="level-grid">
          <div
            v-for="(level, index) in ALL_LEVELS"
            :key="level.id"
            class="level-card card"
            :class="{
              'level-unlocked': progressStore.isLevelUnlocked(level.id),
              'level-completed': progressStore.isLevelCompleted(level.id),
              'level-current': progressStore.currentLevelId === level.id,
              'level-locked': !progressStore.isLevelUnlocked(level.id)
            }"
            @click="selectLevel(level.id)"
          >
            <!-- Card Header -->
            <div class="level-card-top">
              <span class="level-number">LEVEL {{ getLevelNumber(level.id) }}</span>
              <span v-if="progressStore.isLevelCompleted(level.id)" class="badge badge-success">
                <CheckCircle2 :size="12" /> 已完成
              </span>
              <span v-else-if="progressStore.isLevelUnlocked(level.id)" class="badge badge-blue">
                可進行
              </span>
              <span v-else class="badge badge-warning">
                <Lock :size="12" /> 未解鎖
              </span>
            </div>

            <!-- Card Body -->
            <div class="level-card-body">
              <h4 class="level-title">{{ level.title }}</h4>
              <span class="level-concept">{{ level.subtitle }}</span>
              <p class="level-desc">{{ level.description.slice(0, 52) }}...</p>
            </div>

            <!-- Card Tags -->
            <div class="level-tags">
              <span v-for="tag in level.concepts.slice(0, 2)" :key="tag" class="tag-pill">
                #{{ tag }}
              </span>
            </div>

            <!-- Bottom Button / Lock State -->
            <div class="level-card-footer">
              <button
                v-if="progressStore.isLevelUnlocked(level.id)"
                class="btn btn-sm"
                :class="progressStore.isLevelCompleted(level.id) ? 'btn-outline' : 'btn-primary'"
              >
                <span>{{ progressStore.isLevelCompleted(level.id) ? '再次探索' : '立即啟航' }}</span>
                <ArrowRight :size="14" />
              </button>
              <div v-else class="locked-hint">
                <Lock :size="14" class="text-muted" />
                <span>完成前置關卡後自動解鎖</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Help Instructions Modal -->
    <div v-if="showGuide" class="modal-overlay" @click.self="showGuide = false">
      <div class="modal-card card">
        <div class="modal-header">
          <h3 class="modal-title">奧德賽星艦學院 · 操作手冊</h3>
          <button class="btn btn-ghost btn-sm" @click="showGuide = false">
            <X :size="18" />
          </button>
        </div>
        <div class="modal-body">
          <div class="guide-step">
            <div class="step-num">1</div>
            <div>
              <strong>觀察任務與環境</strong>
              <p>進入關卡後，先閱讀任務目標與 3D 世界中的地形、障礙物或指示燈號。</p>
            </div>
          </div>
          <div class="guide-step">
            <div class="step-num">2</div>
            <div>
              <strong>操作指令與參數</strong>
              <p>使用滑鼠點擊或拖曳指令卡、拖動滑桿數值、調整條件積木，不用寫任何程式碼。</p>
            </div>
          </div>
          <div class="guide-step">
            <div class="step-num">3</div>
            <div>
              <strong>點擊執行與觀察</strong>
              <p>按下「啟動執行」觀察探測船或機器的即時 3D 反應；若失敗隨時可重試修正策略！</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="showGuide = false">我明白了，開始出發！</button>
        </div>
      </div>
    </div>

    <!-- Cheat Code Modal -->
    <div v-if="showCheatModal" class="modal-overlay" @click.self="showCheatModal = false">
      <div class="modal-card card">
        <div class="modal-header">
          <h3 class="modal-title">教師 / 開發者密令驗證</h3>
          <button class="btn btn-ghost btn-sm" @click="showCheatModal = false">
            <X :size="18" />
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">輸入指定密碼可解鎖所有關卡供教學演示使用。</p>
          <input
            v-model="cheatInput"
            type="password"
            placeholder="請輸入密令..."
            class="cheat-input"
            @keyup.enter="submitCheat"
          />
          <div v-if="cheatFeedback" class="cheat-feedback" :class="cheatSuccess ? 'text-success' : 'text-danger'">
            {{ cheatFeedback }}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showCheatModal = false">取消</button>
          <button class="btn btn-primary" @click="submitCheat">送出驗證</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import {
  Compass, Play, Volume2, VolumeX, Download, Upload, HelpCircle, Key,
  Sparkles, CheckCircle2, Lock, ArrowRight, X
} from 'lucide-vue-next';
import { ALL_LEVELS, getLevelNumber } from '../../levels/index.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { soundManager } from '../../game/core/SoundManager.js';

const progressStore = useProgressStore();
const showGuide = ref(false);
const showCheatModal = ref(false);
const cheatInput = ref('');
const cheatFeedback = ref('');
const cheatSuccess = ref(false);

const nextPlayableLevel = computed(() => {
  for (const lvl of ALL_LEVELS) {
    if (!progressStore.isLevelCompleted(lvl.id)) {
      return lvl.id;
    }
  }
  return 1;
});

function toggleSound() {
  const muted = progressStore.toggleSound();
  soundManager.setMuted(muted);
}

function startAdventure() {
  soundManager.playClick();
  progressStore.goToLevel(nextPlayableLevel.value);
}

function selectLevel(id) {
  if (progressStore.isLevelUnlocked(id)) {
    soundManager.playClick();
    progressStore.goToLevel(id);
  } else {
    soundManager.playError();
  }
}

function exportSave() {
  soundManager.playClick();
  progressStore.exportSave();
}

async function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const res = await progressStore.importSave(file);
  if (res.success) {
    soundManager.playSuccess();
    alert('存檔匯入成功！已更新進度。');
  } else {
    soundManager.playError();
    alert(`存檔匯入失敗: ${res.error}`);
  }
  event.target.value = '';
}

function openCheatModal() {
  cheatInput.value = '';
  cheatFeedback.value = '';
  cheatSuccess.value = false;
  showCheatModal.value = true;
}

function submitCheat() {
  const res = progressStore.applyCheatCode(cheatInput.value);
  cheatFeedback.value = res.message;
  cheatSuccess.value = res.success;
  if (res.success) {
    soundManager.playSuccess();
    setTimeout(() => {
      showCheatModal.value = false;
    }, 1200);
  } else {
    soundManager.playError();
  }
}
</script>

<style scoped>
.home-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-space);
  background-image: var(--bg-space-gradient);
}

/* Header */
.home-header {
  height: 64px;
  min-height: 64px;
  background: var(--bg-panel-glass);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: var(--shadow-sm);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--primary-blue-light);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-accent-light);
}

.brand-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
}

.brand-subtitle {
  font-size: 0.76rem;
  color: var(--text-muted);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.import-label {
  position: relative;
  cursor: pointer;
}

.file-input-hidden {
  display: none;
}

/* Hero Section */
.home-content {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.hero-section {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
}

.hero-badge {
  padding: 0.35rem 0.85rem;
  font-size: 0.82rem;
}

.hero-heading {
  font-family: var(--font-display);
  font-size: 2.3rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  max-width: 720px;
  line-height: 1.25;
}

.hero-desc {
  font-size: 1.05rem;
  color: var(--text-secondary);
  max-width: 680px;
  line-height: 1.6;
}

.hero-actions {
  margin-top: 0.5rem;
}

.hero-btn {
  padding: 0.75rem 2rem;
  font-size: 1.05rem;
  border-radius: var(--radius-lg);
}

/* Progress Card */
.progress-card {
  width: 100%;
  max-width: 580px;
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  font-weight: 600;
}

.progress-label {
  color: var(--text-secondary);
}

.progress-value {
  color: var(--primary-blue);
}

.progress-track {
  width: 100%;
  height: 8px;
  background: var(--border-subtle);
  border-radius: 9999px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-blue) 0%, var(--accent-purple) 100%);
  border-radius: 9999px;
  transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Map Section */
.map-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.section-title {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary);
}

.section-subtitle {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.25rem;
}

.level-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  min-height: 220px;
  cursor: pointer;
  position: relative;
  transition: all var(--transition-normal);
}

.level-unlocked:hover {
  transform: translateY(-4px);
  border-color: var(--primary-blue);
  box-shadow: var(--shadow-elevated), var(--shadow-blue-glow);
}

.level-current {
  border-color: var(--primary-blue);
  box-shadow: 0 0 0 2px var(--primary-blue-glow);
}

.level-completed {
  border-left: 4px solid var(--success);
}

.level-locked {
  opacity: 0.65;
  background: #f8fafc;
  cursor: not-allowed;
}

.level-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.level-number {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-muted);
}

.level-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.level-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
}

.level-concept {
  font-size: 0.8rem;
  color: var(--primary-blue);
  font-weight: 600;
}

.level-desc {
  font-size: 0.82rem;
  color: var(--text-muted);
  line-height: 1.45;
  margin-top: 0.25rem;
}

.level-tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.tag-pill {
  font-size: 0.72rem;
  background: var(--bg-panel-hover);
  color: var(--text-secondary);
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}

.level-card-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
}

.level-card-footer .btn {
  width: 100%;
}

.locked-hint {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.76rem;
  color: var(--text-muted);
}

/* Modals */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1.5rem;
}

.modal-card {
  width: 100%;
  max-width: 520px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: var(--shadow-elevated);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 0.75rem;
}

.modal-title {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.guide-step {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary-blue-light);
  color: var(--primary-blue);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--border-accent-light);
}

.guide-step strong {
  font-size: 0.92rem;
  color: var(--text-primary);
}

.guide-step p {
  font-size: 0.82rem;
  color: var(--text-muted);
  line-height: 1.45;
  margin-top: 0.15rem;
}

.modal-desc {
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.cheat-input {
  width: 100%;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-medium);
  font-size: 0.95rem;
  outline: none;
}

.cheat-input:focus {
  border-color: var(--primary-blue);
  box-shadow: 0 0 0 3px var(--primary-blue-light);
}

.cheat-feedback {
  font-size: 0.85rem;
  font-weight: 600;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@media (max-width: 640px) {
  .hero-heading {
    font-size: 1.7rem;
  }
  .hide-mobile {
    display: none;
  }
}
</style>
