<template>
  <div class="dom-viewport">
    <!-- Mock browser chrome -->
    <div class="browser-bar">
      <div class="traffic">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
      </div>
      <div class="url-bar">
        <Globe :size="13" />
        <span>station-control.local/dashboard</span>
      </div>
      <span class="badge-2d">2D 網頁模式</span>
    </div>

    <div v-if="levelStore.l6CodeApproved && !(dom.disarmed && dom.airlockOpen)" class="manual-banner">
      <span>✅ 程式送審通過！請親手點擊「解除警報」→「開啟氣閘門」完成任務</span>
    </div>

    <div class="browser-body">
      <!-- Left: mock webpage -->
      <div class="webpage" :class="{ alarmed: !dom.disarmed }">
        <div class="siren-strip" v-if="!dom.disarmed">
          <span v-for="i in 12" :key="i" class="siren-light" :style="{ animationDelay: (i * 0.12) + 's' }"></span>
        </div>
        <div class="page-header">
          <div class="page-title-row">
            <Rocket :size="18" class="text-brand" />
            <div>
              <h3>太空艙控制網頁 <span class="ver">v2.0</span></h3>
              <p class="page-sub">這是一整個用 HTML + CSS 畫出來的「網頁」，你的 JS 正在操控它</p>
            </div>
          </div>
          <!-- #status-indicator -->
          <div
            id="status-indicator"
            class="status-card"
            :class="dom.disarmed ? 'ok' : 'alarm'"
          >
            
            <div class="status-main">
              <span class="status-lamp" :style="{ background: dom.statusColor }"></span>
              <strong>{{ dom.statusText }}</strong>
            </div>
          </div>
        </div>

        <!-- #airlock-door 2D -->
        <div class="door-section">
          <div class="door-label-row">
            <span class="door-state" :class="{ open: dom.airlockOpen }">
              {{ dom.airlockOpen ? 'OPEN · 已開啟' : dom.disarmed ? 'UNLOCKED · 待開啟' : 'LOCKED · 鎖定中' }}
            </span>
          </div>
          <div id="airlock-door" class="door-frame" :class="{ open: dom.airlockOpen, unlocked: dom.disarmed }">
            <div class="door-panel left"></div>
            <div class="door-panel right"></div>
            <div class="door-glow"></div>
            <div class="door-center-label">
              <template v-if="dom.airlockOpen">✨ 通道暢通</template>
              <template v-else-if="dom.disarmed">🔓 已解鎖，等待開門事件</template>
              <template v-else>🔒 警報鎖定中</template>
            </div>
          </div>
        </div>

        <!-- Buttons = real DOM -->
        <div class="btn-grid">
          <div class="btn-cell">
            <div class="btn-tag-row">
              <span class="listener-badge" :class="dom.disarmEvent">{{ '👂 ' + dom.disarmEvent }}</span>
            </div>
            <button
              id="disarm-btn"
              class="web-btn disarm"
              :class="{ done: dom.disarmed, 'sim-press': dom.pressTarget === 'disarm' }"
              @click="fire('disarm', 'click')"
              @mouseover="fire('disarm', 'mouseover')"
              @dblclick="fire('disarm', 'dblclick')"
            >
              <ShieldAlert v-if="!dom.disarmed" :size="18" />
              <ShieldCheck v-else :size="18" />
              <span>
                <strong>解除警報</strong>
                <small>{{ dom.disarmed ? 'textContent 已改為 ✓' : hintFor(dom.disarmEvent) }}</small>
              </span>
            </button>
          </div>

          <div class="btn-cell">
            <div class="btn-tag-row">
              <span class="listener-badge" :class="dom.airlockEvent">{{ '👂 ' + dom.airlockEvent }}</span>
            </div>
            <button
              id="airlock-btn"
              class="web-btn airlock"
              :class="{ done: dom.airlockOpen, 'sim-press': dom.pressTarget === 'airlock' }"
              @click="fire('airlock', 'click')"
              @mouseover="fire('airlock', 'mouseover')"
              @dblclick="fire('airlock', 'dblclick')"
            >
              <DoorClosed v-if="!dom.airlockOpen" :size="18" />
              <DoorOpen v-else :size="18" />
              <span>
                <strong>開啟氣閘門</strong>
                <small>{{ dom.airlockOpen ? 'classList 已加 open ✓' : hintFor(dom.airlockEvent) }}</small>
              </span>
            </button>
          </div>
        </div>

        <div class="notice" v-if="dom.notice" :class="dom.noticeType">{{ dom.notice }}</div>
        <div class="test-tip">💡 直接在這個 2D 網頁上「點擊 / 懸停 / 雙擊」按鈕，感受綁定不同事件的差別</div>
      </div>

      <!-- Right: devtools console -->
      <div class="devtools">
        <div class="dev-header">
          <Terminal :size="14" />
          <span>DevTools · Console</span>
          <button class="clear-btn" @click="dom.eventLog = []">清除</button>
        </div>
        <div class="dom-tree">
          <div class="tree-title">DOM TREE 即時預覽</div>
          <pre class="tree-code"><code>{{ treePreview }}</code></pre>
        </div>
        <div class="log-list">
          <div v-if="!dom.eventLog.length" class="log-empty">尚無事件…去點點左邊網頁按鈕，或先到下方綁定事件。</div>
          <div v-for="log in dom.eventLog" :key="log.id" class="log-line" :class="'k-' + log.kind">
            <span class="log-time">{{ log.time }}</span>
            <span class="log-msg">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { Globe, Rocket, ShieldAlert, ShieldCheck, DoorClosed, DoorOpen, Terminal } from 'lucide-vue-next';
import { useDomLabStore } from '../../stores/domLabStore.js';
import { useLevelStore } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { soundManager } from '../../game/core/SoundManager.js';

const dom = useDomLabStore();
const levelStore = useLevelStore();
const progress = useProgressStore();

onMounted(() => {
  const saved = progress.getSavedOperation(6);
  if (saved?.domState) dom.hydrateFromSaved(saved.domState);
  if (!dom.eventLog.length) {
    dom.pushLog('system', '📄 document.querySelector 已選到 4 個元素，等待 addEventListener…');
  }
});

// 送審通過後，親手點亮兩格才算通關（成功窗由 levelStore 發）
watch(() => [dom.disarmed, dom.airlockOpen], ([disarmed, airlockOpen]) => {
  if (disarmed && airlockOpen) {
    levelStore.checkL6ManualCompletion();
  }
});

function hintFor(evt) {
  if (evt === 'click') return '綁定 click：請「點擊」我';
  if (evt === 'mouseover') return '綁定 mouseover：請「懸停」我';
  return '綁定 dblclick：請「雙擊」我';
}

function fire(which, evt) {
  try { soundManager.playClick(); } catch (e) {}
  // dblclick 也會連帶觸發兩次 click，瀏覽器真實行為；這裡只取最後一次事件做示範
  // 為了教學清晰：dblclick 操作同時送出 dblclick 判定
  if (evt === 'click' && which) {
    // 若該按鈕綁的是 dblclick，單次 click 應該 miss（讓學生有感）
  }
  const ok = dom.dispatch(which, evt);
  if (ok) {
    try {
      if (which === 'disarm') soundManager.playPowerUp();
      else soundManager.playDoorOpen();
    } catch (e) {}
  }
}

const treePreview = computed(() => {
  return `<div id="dashboard">\n  <div id="status-indicator" style="color: ${dom.statusColor}">\n    ${dom.statusText}\n  </div>\n  <div id="airlock-door" class="${dom.airlockOpen ? 'open' : 'locked'}">…</div>\n  <button id="disarm-btn" @${dom.disarmEvent}="disarmAlarm">…</button>\n  <button id="airlock-btn" @${dom.airlockEvent}="openAirlock">…</button>\n</div>`;
});
</script>

<style scoped>
.dom-viewport {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #eef2ff;
  overflow: hidden;
}
.browser-bar {
  height: 42px;
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0 0.9rem;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}
.traffic { display: flex; gap: 5px; }
.dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
.dot.r { background: #f87171; } .dot.y { background: #fbbf24; } .dot.g { background: #34d399; }
.url-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 0.25rem 0.8rem;
  font-size: 0.76rem;
  color: #475569;
  font-family: var(--font-mono);
}
.badge-2d {
  font-size: 0.7rem;
  font-weight: 800;
  color: #4f46e5;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
}
.manual-banner {
  background: #ecfdf5;
  border-bottom: 1px solid #a7f3d0;
  color: #065f46;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.45rem 1rem;
  text-align: center;
}
.browser-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1.5fr 0.9fr;
  gap: 0.8rem;
  padding: 0.8rem;
  overflow: hidden;
  min-height: 0;
}
.webpage {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 0.9rem 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  position: relative;
}
.webpage.alarmed { border-color: #fecaca; box-shadow: inset 0 0 0 1px #fee2e2; }
.siren-strip { display: flex; gap: 6px; }
.siren-light {
  flex: 1; height: 8px; border-radius: 999px; background: #fee2e2;
  animation: siren 1s infinite alternate;
}
@keyframes siren { from { background: #fee2e2; } to { background: #ef4444; box-shadow: 0 0 10px #ef4444; } }
.page-header { display: flex; flex-direction: column; gap: 0.6rem; }
.page-title-row { display: flex; gap: 0.6rem; align-items: flex-start; }
.page-title-row h3 { margin: 0; font-size: 1rem; }
.ver { font-size: 0.68rem; background: #eef2ff; color: #4f46e5; padding: 0.1rem 0.4rem; border-radius: 999px; }
.page-sub { margin: 0.15rem 0 0; font-size: 0.76rem; color: #64748b; }
.status-card {
  border-radius: 10px; padding: 0.6rem 0.75rem; border: 1.5px solid;
  display: flex; flex-direction: column; gap: 0.35rem; transition: all 0.3s;
}
.status-card.alarm { border-color: #ef4444; background: #fef2f2; }
.status-card.ok { border-color: #10b981; background: #ecfdf5; }
.status-top { display: flex; justify-content: space-between; align-items: center; }
.status-top code { font-size: 0.7rem; color: #64748b; font-family: var(--font-mono); }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
.status-main { display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; }
.status-lamp { width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
.status-meta { font-size: 0.7rem; color: #64748b; }
.door-section { display: flex; flex-direction: column; gap: 0.4rem; }
.door-label-row { display: flex; justify-content: space-between; align-items: center; }
.door-label-row code { font-size: 0.7rem; color: #64748b; font-family: var(--font-mono); }
.door-state { font-size: 0.72rem; font-weight: 800; padding: 0.15rem 0.55rem; border-radius: 999px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.door-state.open { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
.door-frame {
  position: relative; height: 130px; border-radius: 10px; overflow: hidden;
  background: linear-gradient(180deg, #0f172a, #1e293b);
  border: 2px solid #cbd5e1;
}
.door-frame.unlocked { border-color: #f59e0b; }
.door-frame.open { border-color: #10b981; box-shadow: 0 0 24px rgba(16,185,129,0.35); }
.door-panel {
  position: absolute; top: 0; bottom: 0; width: 50%;
  background: linear-gradient(180deg, #94a3b8, #64748b);
  transition: transform 1.2s cubic-bezier(0.16,1,0.3,1);
  z-index: 2;
}
.door-panel.left { left: 0; border-right: 2px solid #475569; }
.door-panel.right { right: 0; border-left: 2px solid #475569; }
.door-frame.open .door-panel.left { transform: translateX(-102%); }
.door-frame.open .door-panel.right { transform: translateX(102%); }
.door-glow {
  position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 60%, rgba(56,189,248,0.55), transparent 65%);
  opacity: 0; transition: opacity 1s; z-index: 1;
}
.door-frame.open .door-glow { opacity: 1; }
.door-center-label {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #e2e8f0; font-size: 0.85rem; font-weight: 700; z-index: 3; text-shadow: 0 1px 8px rgba(0,0,0,0.6);
}
.btn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
.btn-cell { display: flex; flex-direction: column; gap: 0.35rem; }
.btn-tag-row { display: flex; justify-content: space-between; align-items: center; }
.btn-tag-row code { font-size: 0.68rem; color: #4f46e5; font-family: var(--font-mono); }
.listener-badge {
  font-size: 0.68rem; font-weight: 800; padding: 0.12rem 0.5rem; border-radius: 999px;
  border: 1px solid; font-family: var(--font-mono);
}
.listener-badge.click { background: #ecfdf5; color: #065f46; border-color: #6ee7b7; }
.listener-badge.mouseover { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
.listener-badge.dblclick { background: #f5f3ff; color: #5b21b6; border-color: #c4b5fd; }
.web-btn {
  display: flex; gap: 0.6rem; align-items: center; text-align: left;
  padding: 0.7rem 0.8rem; border-radius: 10px; cursor: pointer;
  border: 1.5px solid; transition: all 0.2s; background: #fff;
}
.web-btn strong { display: block; font-size: 0.88rem; }
.web-btn small { font-size: 0.72rem; opacity: 0.8; }
.web-btn.disarm { border-color: #fecaca; color: #991b1b; background: #fff7f7; }
.web-btn.disarm.done { border-color: #6ee7b7; background: #ecfdf5; color: #065f46; }
.web-btn.airlock { border-color: #bfdbfe; color: #1e40af; background: #f8fbff; }
.web-btn.airlock.done { border-color: #6ee7b7; background: #ecfdf5; color: #065f46; }
.web-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); }
.web-btn:active { transform: translateY(0) scale(0.99); }
/* 程式模擬點擊：彈一下＋變色，讓學生看到「被程式按下去」 */
.web-btn.sim-press {
  animation: simPressPop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1);
  border-color: #4f46e5;
  background: #eef2ff;
  color: #312e81;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.35), 0 8px 20px rgba(79, 70, 229, 0.25);
}
@keyframes simPressPop {
  0% { transform: scale(1); }
  30% { transform: scale(0.93); }
  60% { transform: scale(1.04); }
  100% { transform: scale(1); }
}
.notice {
  font-size: 0.8rem; line-height: 1.5; padding: 0.55rem 0.75rem; border-radius: 8px; border: 1px solid;
}
.notice.success { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
.notice.danger { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
.notice.warning { background: #fffbeb; border-color: #fde68a; color: #92400e; }
.notice.muted { background: #f8fafc; border-color: #e2e8f0; color: #475569; }
.test-tip { font-size: 0.75rem; color: #64748b; background: #f8fafc; padding: 0.45rem 0.7rem; border-radius: 8px; border: 1px dashed #cbd5e1; }
.devtools {
  background: #0f172a; color: #e2e8f0; border-radius: 14px; overflow: hidden;
  display: flex; flex-direction: column; min-height: 0;
}
.dev-header {
  display: flex; align-items: center; gap: 0.45rem; padding: 0.55rem 0.8rem;
  background: #1e293b; font-size: 0.78rem; font-weight: 700;
}
.clear-btn {
  margin-left: auto; font-size: 0.7rem; background: transparent; color: #94a3b8;
  border: 1px solid #334155; border-radius: 6px; padding: 0.15rem 0.55rem; cursor: pointer;
}
.clear-btn:hover { color: #fff; border-color: #64748b; }
.dom-tree { padding: 0.6rem 0.8rem; border-bottom: 1px solid #1e293b; }
.tree-title { font-size: 0.68rem; font-weight: 800; color: #38bdf8; letter-spacing: 0.06em; margin-bottom: 0.35rem; }
.tree-code { margin: 0; background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 0.55rem 0.65rem; overflow-x: auto; }
.tree-code code { font-family: var(--font-mono); font-size: 0.68rem; line-height: 1.55; color: #a5f3fc; white-space: pre; }
.log-list { flex: 1; overflow-y: auto; padding: 0.55rem 0.7rem; display: flex; flex-direction: column; gap: 0.35rem; }
.log-empty { font-size: 0.75rem; color: #64748b; }
.log-line { font-size: 0.72rem; display: flex; gap: 0.5rem; padding: 0.35rem 0.5rem; border-radius: 6px; background: #1e293b; line-height: 1.45; }
.log-time { color: #64748b; font-family: var(--font-mono); flex-shrink: 0; }
.log-line.k-dom .log-msg { color: #6ee7b7; }
.log-line.k-event .log-msg { color: #7dd3fc; }
.log-line.k-error .log-msg, .log-line.k-miss .log-msg { color: #fca5a5; }
.log-line.k-system .log-msg { color: #cbd5e1; }
@media (max-width: 900px) {
  .browser-body { grid-template-columns: 1fr; overflow-y: auto; }
  .devtools { min-height: 260px; }
}
</style>
