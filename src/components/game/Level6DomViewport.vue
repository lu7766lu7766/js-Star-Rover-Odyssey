<template>
  <div class="dom-viewport" :class="{ collapsed, alarmed: !dom.disarmed }">
    <!-- 控制終端的瀏覽器外框：這台終端機開著一個真的網頁 -->
    <div class="browser-bar">
      <div class="traffic">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
      </div>
      <div class="url-bar">
        <Globe :size="13" />
        <span>station-control.local/dashboard</span>
      </div>
      <span class="badge-dom">真實 DOM 網頁</span>
      <button
        class="collapse-btn"
        :title="collapsed ? '展開控制終端' : '收合終端，看完整 3D 氣閘'"
        :aria-label="collapsed ? '展開控制終端' : '收合控制終端'"
        @click="collapsed = !collapsed"
      >
        <ChevronUp v-if="collapsed" :size="16" />
        <ChevronDown v-else :size="16" />
      </button>
    </div>

    <div v-if="!collapsed && levelStore.l6CodeApproved && !(dom.disarmed && dom.airlockOpen)" class="manual-banner">
      <span>✅ 程式送審通過！請親手點擊「解除警報」→「開啟氣閘門」完成任務</span>
    </div>

    <div v-show="!collapsed" class="browser-body">
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
              <p class="page-sub">用 HTML + CSS 畫出來的「網頁」，你的 JS 正在操控它，上方 3D 氣閘會跟著動</p>
            </div>
          </div>
        </div>

        <!-- 狀態燈與艙門並排，讓按鈕不用捲動就看得到 -->
        <div class="state-grid">
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

          <!-- #airlock-door -->
          <div class="door-section">
            <div class="door-label-row">
              <span class="door-state" :class="{ open: dom.airlockOpen, unlocked: dom.disarmed && !dom.airlockOpen }">
                {{ dom.airlockOpen ? 'OPEN · 已開啟' : dom.disarmed ? 'UNLOCKED · 待開啟' : 'LOCKED · 鎖定中' }}
              </span>
            </div>
            <div id="airlock-door" class="door-frame" :class="{ open: dom.airlockOpen, unlocked: dom.disarmed }">
              <div class="door-panel left"></div>
              <div class="door-panel right"></div>
              <div class="door-glow"></div>
              <div class="door-center-label">
                <template v-if="dom.airlockOpen">✨ 通道暢通</template>
                <template v-else-if="dom.disarmed">🔓 已解鎖</template>
                <template v-else>🔒 鎖定中</template>
              </div>
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
        <div v-else class="test-tip">💡 直接在這個網頁上「點擊 / 懸停 / 雙擊」按鈕，感受綁定不同事件的差別</div>
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
import { ref, computed, onMounted, watch } from 'vue';
import { Globe, Rocket, ShieldAlert, ShieldCheck, DoorClosed, DoorOpen, Terminal, ChevronUp, ChevronDown } from 'lucide-vue-next';
import { useDomLabStore } from '../../stores/domLabStore.js';
import { useLevelStore } from '../../stores/levelStore.js';
import { useProgressStore } from '../../stores/progressStore.js';
import { soundManager } from '../../game/core/SoundManager.js';

const dom = useDomLabStore();
const levelStore = useLevelStore();
const progress = useProgressStore();
// 收合後只留網址列，讓學生看完整的 3D 氣閘
const collapsed = ref(false);

// 通關時自動收合，讓學生看完整的開門運鏡；重置關卡再展開
watch(() => levelStore.lastRunResult, (res) => {
  if (res?.pass && levelStore.currentLevel?.id === 6) collapsed.value = true;
});
watch(() => levelStore.resetNonce, () => {
  collapsed.value = false;
});

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
/* 控制終端：深色全息面板，疊在 3D 氣閘下半部 */
.dom-viewport {
  --term-bg: rgba(6, 11, 24, 0.9);
  --term-line: rgba(56, 189, 248, 0.32);
  --term-text: #e2e8f0;
  --term-dim: #94a3b8;
  --term-cyan: #38bdf8;
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: 0.75rem;
  height: 54%;
  min-height: 300px;
  max-height: calc(100% - 4.25rem);
  z-index: 8;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--term-text);
  background: var(--term-bg);
  backdrop-filter: blur(14px);
  border: 1px solid var(--term-line);
  border-radius: 16px;
  box-shadow: 0 18px 44px rgba(2, 6, 23, 0.55), 0 0 0 1px rgba(56, 189, 248, 0.08), 0 0 28px rgba(56, 189, 248, 0.18);
  transition: border-color 0.4s, box-shadow 0.4s;
}
.dom-viewport.alarmed {
  border-color: rgba(239, 68, 68, 0.5);
  box-shadow: 0 18px 44px rgba(2, 6, 23, 0.55), 0 0 28px rgba(239, 68, 68, 0.22);
}
.dom-viewport.collapsed {
  height: auto;
  min-height: 0;
}
/* 細掃描線，讓面板像全息螢幕 */
.dom-viewport::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(to bottom, rgba(148, 163, 184, 0.035) 0 1px, transparent 1px 3px);
  border-radius: inherit;
}
.browser-bar {
  height: 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0 0.6rem 0 0.85rem;
  background: rgba(15, 23, 42, 0.85);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}
.traffic { display: flex; gap: 5px; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.dot.r { background: #f87171; } .dot.y { background: #fbbf24; } .dot.g { background: #34d399; }
.url-bar {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(2, 6, 23, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  padding: 0.22rem 0.8rem;
  font-size: 0.74rem;
  color: var(--term-dim);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
}
.url-bar span { overflow: hidden; text-overflow: ellipsis; }
.badge-dom {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 800;
  color: #7dd3fc;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.4);
  padding: 0.12rem 0.55rem;
  border-radius: 999px;
}
.collapse-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: transparent;
  color: var(--term-dim);
  cursor: pointer;
}
.collapse-btn:hover { color: #fff; border-color: var(--term-cyan); }
.manual-banner {
  background: rgba(16, 185, 129, 0.14);
  border-bottom: 1px solid rgba(16, 185, 129, 0.4);
  color: #6ee7b7;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.4rem 1rem;
  text-align: center;
}
.browser-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 0.65rem;
  padding: 0.65rem;
  overflow: hidden;
  min-height: 0;
}
.webpage {
  background: linear-gradient(180deg, rgba(15, 26, 46, 0.95), rgba(11, 20, 36, 0.95));
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  padding: 0.75rem 0.85rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  position: relative;
}
.webpage.alarmed { border-color: rgba(239, 68, 68, 0.45); }
.siren-strip { display: flex; gap: 5px; }
.siren-light {
  flex: 1; height: 6px; border-radius: 999px; background: rgba(239, 68, 68, 0.18);
  animation: siren 1s infinite alternate;
}
@keyframes siren { from { background: rgba(239, 68, 68, 0.18); } to { background: #ef4444; box-shadow: 0 0 10px #ef4444; } }
.page-header { display: flex; flex-direction: column; gap: 0.55rem; }
.state-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; align-items: stretch; }
.page-title-row { display: flex; gap: 0.55rem; align-items: flex-start; }
.page-title-row .text-brand { color: var(--term-cyan); flex-shrink: 0; margin-top: 2px; }
.page-title-row h3 { margin: 0; font-size: 0.95rem; color: #f8fafc; }
.ver { font-size: 0.66rem; background: rgba(56, 189, 248, 0.14); color: #7dd3fc; padding: 0.08rem 0.4rem; border-radius: 999px; }
.page-sub { margin: 0.15rem 0 0; font-size: 0.73rem; color: var(--term-dim); line-height: 1.45; }
.status-card {
  border-radius: 10px; padding: 0.5rem 0.7rem; border: 1.5px solid;
  display: flex; flex-direction: column; justify-content: center; gap: 0.35rem; transition: all 0.3s;
}
.status-card.alarm { border-color: #ef4444; background: rgba(239, 68, 68, 0.12); color: #fecaca; }
.status-card.ok { border-color: #10b981; background: rgba(16, 185, 129, 0.12); color: #a7f3d0; }
.status-main { display: flex; align-items: center; gap: 0.5rem; font-size: 0.92rem; }
.status-lamp { width: 13px; height: 13px; border-radius: 50%; box-shadow: 0 0 12px currentColor; }
.status-card.alarm .status-lamp { animation: lampBlink 0.9s infinite; }
@keyframes lampBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.door-section { display: flex; flex-direction: column; gap: 0.35rem; }
.door-label-row { display: flex; justify-content: space-between; align-items: center; }
.door-state {
  font-size: 0.7rem; font-weight: 800; padding: 0.12rem 0.55rem; border-radius: 999px;
  background: rgba(239, 68, 68, 0.12); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.45);
}
.door-state.unlocked { background: rgba(245, 158, 11, 0.12); color: #fcd34d; border-color: rgba(245, 158, 11, 0.5); }
.door-state.open { background: rgba(16, 185, 129, 0.12); color: #6ee7b7; border-color: rgba(16, 185, 129, 0.45); }
.door-frame {
  position: relative; height: 52px; border-radius: 10px; overflow: hidden;
  background: linear-gradient(180deg, #020617, #0f172a);
  border: 1.5px solid #334155;
}
.door-frame.unlocked { border-color: #f59e0b; }
.door-frame.open { border-color: #10b981; box-shadow: 0 0 20px rgba(16, 185, 129, 0.35); }
.door-panel {
  position: absolute; top: 0; bottom: 0; width: 50%;
  background: linear-gradient(180deg, #3b82f6, #1d4ed8);
  transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 2;
}
.door-panel.left { left: 0; border-right: 2px solid #1e3a8a; }
.door-panel.right { right: 0; border-left: 2px solid #1e3a8a; }
.door-frame.open .door-panel.left { transform: translateX(-102%); }
.door-frame.open .door-panel.right { transform: translateX(102%); }
.door-glow {
  position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 60%, rgba(56, 189, 248, 0.55), transparent 65%);
  opacity: 0; transition: opacity 1s; z-index: 1;
}
.door-frame.open .door-glow { opacity: 1; }
.door-center-label {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #f1f5f9; font-size: 0.8rem; font-weight: 700; z-index: 3; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.7);
}
.btn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.btn-cell { display: flex; flex-direction: column; gap: 0.3rem; }
.btn-tag-row { display: flex; justify-content: space-between; align-items: center; }
.listener-badge {
  font-size: 0.66rem; font-weight: 800; padding: 0.1rem 0.5rem; border-radius: 999px;
  border: 1px solid; font-family: var(--font-mono);
}
.listener-badge.click { background: rgba(16, 185, 129, 0.12); color: #6ee7b7; border-color: rgba(16, 185, 129, 0.5); }
.listener-badge.mouseover { background: rgba(245, 158, 11, 0.12); color: #fcd34d; border-color: rgba(245, 158, 11, 0.5); }
.listener-badge.dblclick { background: rgba(139, 92, 246, 0.14); color: #c4b5fd; border-color: rgba(139, 92, 246, 0.5); }
.web-btn {
  display: flex; gap: 0.55rem; align-items: center; text-align: left;
  padding: 0.6rem 0.7rem; border-radius: 10px; cursor: pointer;
  border: 1.5px solid; transition: all 0.2s; min-height: 52px;
}
.web-btn strong { display: block; font-size: 0.86rem; }
.web-btn small { font-size: 0.7rem; opacity: 0.85; }
.web-btn.disarm { border-color: rgba(239, 68, 68, 0.6); color: #fecaca; background: rgba(239, 68, 68, 0.1); }
.web-btn.airlock { border-color: rgba(56, 189, 248, 0.6); color: #bae6fd; background: rgba(56, 189, 248, 0.1); }
.web-btn.disarm.done,
.web-btn.airlock.done { border-color: rgba(16, 185, 129, 0.7); background: rgba(16, 185, 129, 0.12); color: #a7f3d0; }
.web-btn:hover { transform: translateY(-1px); box-shadow: 0 0 0 1px currentColor, 0 8px 20px rgba(0, 0, 0, 0.35); }
.web-btn:active { transform: translateY(0) scale(0.99); }
.web-btn:focus-visible { outline: 2px solid var(--term-cyan); outline-offset: 2px; }
/* 程式模擬點擊：彈一下＋變色，讓學生看到「被程式按下去」 */
.web-btn.sim-press {
  animation: simPressPop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1);
  border-color: #818cf8;
  background: rgba(99, 102, 241, 0.22);
  color: #e0e7ff;
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.35), 0 8px 20px rgba(79, 70, 229, 0.35);
}
@keyframes simPressPop {
  0% { transform: scale(1); }
  30% { transform: scale(0.93); }
  60% { transform: scale(1.04); }
  100% { transform: scale(1); }
}
.notice {
  font-size: 0.78rem; line-height: 1.5; padding: 0.5rem 0.7rem; border-radius: 8px; border: 1px solid;
}
.notice.success { background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.45); color: #a7f3d0; }
.notice.danger { background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.45); color: #fecaca; }
.notice.warning { background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.45); color: #fde68a; }
.notice.muted { background: rgba(148, 163, 184, 0.08); border-color: rgba(148, 163, 184, 0.25); color: #cbd5e1; }
.test-tip {
  font-size: 0.72rem; color: var(--term-dim); background: rgba(148, 163, 184, 0.06);
  padding: 0.4rem 0.65rem; border-radius: 8px; border: 1px dashed rgba(148, 163, 184, 0.3);
}
.devtools {
  background: rgba(2, 6, 23, 0.88); color: var(--term-text); border-radius: 12px; overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.14);
  display: flex; flex-direction: column; min-height: 0;
}
.dev-header {
  display: flex; align-items: center; gap: 0.45rem; padding: 0.45rem 0.7rem;
  background: rgba(30, 41, 59, 0.8); font-size: 0.76rem; font-weight: 700;
}
.clear-btn {
  margin-left: auto; font-size: 0.68rem; background: transparent; color: var(--term-dim);
  border: 1px solid #334155; border-radius: 6px; padding: 0.12rem 0.5rem; cursor: pointer;
}
.clear-btn:hover { color: #fff; border-color: #64748b; }
.dom-tree { padding: 0.5rem 0.7rem; border-bottom: 1px solid #1e293b; }
.tree-title { font-size: 0.66rem; font-weight: 800; color: var(--term-cyan); letter-spacing: 0.06em; margin-bottom: 0.3rem; }
.tree-code { margin: 0; background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 0.5rem 0.6rem; overflow-x: auto; }
.tree-code code { font-family: var(--font-mono); font-size: 0.66rem; line-height: 1.55; color: #a5f3fc; white-space: pre; }
.log-list { flex: 1; overflow-y: auto; padding: 0.5rem 0.6rem; display: flex; flex-direction: column; gap: 0.3rem; }
.log-empty { font-size: 0.72rem; color: #64748b; }
.log-line { font-size: 0.7rem; display: flex; gap: 0.5rem; padding: 0.3rem 0.45rem; border-radius: 6px; background: #0f172a; line-height: 1.45; }
.log-time { color: #64748b; font-family: var(--font-mono); flex-shrink: 0; }
.log-line.k-dom .log-msg { color: #6ee7b7; }
.log-line.k-event .log-msg { color: #7dd3fc; }
.log-line.k-error .log-msg, .log-line.k-miss .log-msg { color: #fca5a5; }
.log-line.k-system .log-msg { color: #cbd5e1; }
/* 面板太窄時改成上下排，整塊可捲動 */
@container (max-width: 540px) {
  .browser-body { grid-template-columns: 1fr; overflow-y: auto; }
  .webpage { overflow: visible; }
  .devtools { min-height: 220px; }
}
/* 教室投影機 1280×720 時面板只剩 450px 左右：收掉副標題、縮小間距，讓按鈕不用捲動 */
@container (max-width: 480px) {
  .page-sub { display: none; }
  .webpage { gap: 0.5rem; padding: 0.6rem 0.7rem; }
  .browser-body { padding: 0.5rem; }
  .badge-dom { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .siren-light, .status-card.alarm .status-lamp, .web-btn.sim-press { animation: none; }
  .door-panel { transition: none; }
}
</style>
