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
          <span>零基礎友善 · 寫真的 JavaScript · 即時 3D 回饋</span>
        </div>
        <h2 class="hero-heading">探索 JavaScript 星系的核心奧秘</h2>
        <p class="hero-desc">
          從「把空格 ___ 填好」開始，一步步寫出真正的 JavaScript。你寫的每一行程式，都會立刻驅動 3D 太空探測船——寫錯也沒關係，系統會用中文告訴你哪一行、哪裡要改！
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
            <span class="progress-label">
              航程總進度
              <span v-if="progressStore.roverName" class="ship-name">🚀 {{ progressStore.roverName }}</span>
            </span>
            <span class="progress-value">
              {{ progressStore.completedLevels.length }} / {{ ALL_LEVELS.length }} 站已通關
              <span class="star-total">★ {{ progressStore.totalStars }} / {{ progressStore.maxStars }}</span>
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" :style="{ width: `${progressStore.progressPercentage}%` }"></div>
          </div>
        </div>
      </section>

      <!-- Level Exploration Map -->
      <section class="map-section">
        <div class="section-title-wrap">
          <h3 class="section-title">星際航線地圖</h3>
          <span class="section-subtitle">點擊已解鎖的站點即可進入；每站最多 3 顆星，重玩可以刷新紀錄</span>
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
              <span class="level-number">第 {{ getLevelNumber(level.id) }} 站</span>
              <span v-if="progressStore.isLevelCompleted(level.id)" class="level-stars" :aria-label="`${progressStore.getLevelStars(level.id)} 顆星`">
                <Star
                  v-for="n in 3"
                  :key="n"
                  :size="15"
                  :class="n <= progressStore.getLevelStars(level.id) ? 'star-on' : 'star-off'"
                />
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
              <p class="level-desc">{{ level.goal || `${level.description.slice(0, 52)}...` }}</p>
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

      <!-- 錯誤圖鑑：把犯過的錯收集起來，錯誤也是成就 -->
      <section class="dex-section">
        <div class="section-title-wrap">
          <h3 class="section-title">錯誤圖鑑 {{ collectedDexCount }} / {{ dexEntries.length }}</h3>
          <span class="section-subtitle">每個工程師都會犯錯。遇到一種新錯誤，就收集一張卡；看懂錯誤訊息，是寫程式最重要的能力之一。</span>
        </div>
        <div class="dex-grid">
          <div
            v-for="entry in dexEntries"
            :key="entry.type"
            class="dex-card"
            :class="{ 'dex-collected': entry.count > 0 }"
          >
            <span class="dex-icon" aria-hidden="true">{{ entry.count > 0 ? entry.icon : '❔' }}</span>
            <div class="dex-text">
              <strong>{{ entry.count > 0 ? entry.name : '尚未遇到' }}</strong>
              <span>{{ entry.count > 0 ? entry.tip : '寫程式時遇到就會收集到這裡' }}</span>
            </div>
            <span v-if="entry.count > 0" class="dex-count">×{{ entry.count }}</span>
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
              <strong>看任務</strong>
              <p>右邊的任務簡報最上方有一句話任務目標，下面是要達成的通關要求。</p>
            </div>
          </div>
          <div class="guide-step">
            <div class="step-num">2</div>
            <div>
              <strong>填空寫程式</strong>
              <p>把程式碼裡的 ___ 換成正確的值或指令。文字要加引號，數字和 true / false 不用。</p>
            </div>
          </div>
          <div class="guide-step">
            <div class="step-num">3</div>
            <div>
              <strong>執行、觀察、修正</strong>
              <p>按「執行 JS 程式碼」（或 Ctrl / ⌘ + Enter）看 3D 場景的反應。沒過的話，程式碼裡會用黃色標出要改的那一行；卡住了就打開提示，失敗越多次，解鎖的提示越多。</p>
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

          <div class="passcode-verify">
            <strong class="passcode-title">驗證學生通關碼</strong>
            <p class="modal-desc">學生通關時會看到一組通關碼（例如 05-3-K7QF），輸入學生的船名與通關碼即可確認。</p>
            <div class="passcode-inputs">
              <input v-model="verifyName" type="text" placeholder="船名（第 1 關取的名字）" class="cheat-input" />
              <input v-model="verifyCode" type="text" placeholder="通關碼" class="cheat-input" @keyup.enter="checkPassCode" />
              <button class="btn btn-outline btn-sm" @click="checkPassCode">驗證</button>
            </div>
            <div v-if="verifyResult" class="cheat-feedback" :class="verifyResult.valid ? 'text-success' : 'text-danger'">
              {{ verifyResult.valid ? `✅ 正確：第 ${verifyResult.levelNumber} 站 ${'★'.repeat(verifyResult.stars)}` : '❌ 通關碼與船名不符' }}
            </div>
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
  Sparkles, Lock, ArrowRight, X, Star
} from 'lucide-vue-next';
import { ALL_LEVELS, getLevelNumber } from '../../levels/index.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { soundManager } from '../../game/core/SoundManager.js';
import { ERROR_DEX } from '../../utils/errorTranslator.js';
import { verifyPassCode } from '../../utils/passCode.js';

const progressStore = useProgressStore();
const showGuide = ref(false);
const showCheatModal = ref(false);
const cheatInput = ref('');
const cheatFeedback = ref('');
const cheatSuccess = ref(false);

// 錯誤圖鑑（「邏輯小誤差」與「神祕錯誤」也算，鼓勵學生把錯誤當收藏）
const dexEntries = computed(() =>
  Object.entries(ERROR_DEX).map(([type, meta]) => ({ type, ...meta, count: progressStore.errorDex[type] || 0 }))
);
const collectedDexCount = computed(() => dexEntries.value.filter((e) => e.count > 0).length);

const verifyName = ref('');
const verifyCode = ref('');
const verifyResult = ref(null);
function checkPassCode() {
  verifyResult.value = verifyPassCode(verifyCode.value, verifyName.value);
}

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
  verifyName.value = '';
  verifyCode.value = '';
  verifyResult.value = null;
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
.ship-name {
  margin-left: 0.5rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.star-total {
  margin-left: 0.6rem;
  color: var(--warning-dark);
  font-weight: 800;
}

.level-stars {
  display: inline-flex;
  gap: 2px;
}

.star-on {
  color: #f59e0b;
  fill: #fbbf24;
}

.star-off {
  color: #cbd5e1;
}

.dex-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dex-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}

.dex-card {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.7rem 0.85rem;
  border-radius: var(--radius-md);
  border: 1px dashed var(--border-medium);
  background: rgba(255, 255, 255, 0.6);
  color: var(--text-muted);
}

.dex-card.dex-collected {
  border-style: solid;
  border-color: var(--warning-border);
  background: #ffffff;
  color: var(--text-secondary);
  box-shadow: var(--shadow-sm);
}

.dex-icon {
  font-size: 1.6rem;
}

.dex-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  font-size: 0.82rem;
  line-height: 1.4;
}

.dex-text strong {
  font-size: 0.92rem;
  color: var(--text-primary);
}

.dex-count {
  font-family: var(--font-mono);
  font-weight: 800;
  color: var(--warning-dark);
}

.passcode-verify {
  margin-top: 1.1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.passcode-inputs {
  display: flex;
  gap: 0.45rem;
}

.passcode-inputs .cheat-input {
  flex: 1;
  min-width: 0;
}

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
