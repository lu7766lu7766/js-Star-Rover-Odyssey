/**
 * Level 6 DOM Lab Store (Pinia)
 * 讓 Zone A (2D 模擬網頁) 與 Zone B (事件綁定操作區) 共用同一份 DOM 狀態，
 * 學生在操作區改綁定，2D 網頁即時出現「監聽器徽章」；在 2D 網頁點擊/懸停/雙擊，
 * 會依照綁定實際觸發 textContent / style 變化，真正體驗 addEventListener。
 */
import { defineStore } from 'pinia';

const DEFAULTS = {
  disarmEvent: 'mouseover',
  disarmAction: 'EMERGENCY_LOCK',
  airlockEvent: 'dblclick',
  airlockAction: 'DISARM_ALARM'
};

let pressTimer = null;

export const useDomLabStore = defineStore('domLab', {
  state: () => ({
    disarmEvent: DEFAULTS.disarmEvent,
    disarmAction: DEFAULTS.disarmAction,
    airlockEvent: DEFAULTS.airlockEvent,
    airlockAction: DEFAULTS.airlockAction,
    disarmed: false,
    airlockOpen: false,
    notice: '',
    noticeType: 'muted', // success | danger | warning | muted
    eventLog: [], // { id, time, kind, message }
    pressTarget: null // 'disarm' | 'airlock' | null：程式模擬點擊時的按鈕彈跳
  }),

  getters: {
    bindings(state) {
      return {
        disarmEvent: state.disarmEvent,
        disarmAction: state.disarmAction,
        airlockEvent: state.airlockEvent,
        airlockAction: state.airlockAction
      };
    },
    statusText(state) {
      return state.disarmed ? '警報系統關閉' : '警戒鎖定中';
    },
    statusColor(state) {
      return state.disarmed ? '#10b981' : '#ef4444';
    },
    liveJsCode(state) {
      const disarmCb =
        state.disarmAction === 'DISARM_ALARM'
          ? `  isAlarmActive = false;\n  statusEl.textContent = '警報系統關閉';\n  statusEl.style.color = 'green';`
          : `  // ❌ 綁錯動作！全艙緊急封鎖與解除警報無關`;
      const airlockCb =
        state.airlockAction === 'OPEN_AIRLOCK'
          ? `  if (!isAlarmActive) {\n    doorEl.classList.add('open');\n    doorEl.textContent = '氣閘已開啟';\n  }`
          : `  // ❌ 綁錯動作！解除警報無法開門`;
      return `const disarmBtn = document.querySelector('#disarm-btn');\nconst airlockBtn = document.querySelector('#airlock-btn');\nconst statusEl = document.querySelector('#status-indicator');\nconst doorEl = document.querySelector('#airlock-door');\n\nlet isAlarmActive = ${state.disarmed ? 'false' : 'true'};\n\ndisarmBtn.addEventListener('${state.disarmEvent}', () => {\n${disarmCb}\n});\n\nairlockBtn.addEventListener('${state.airlockEvent}', () => {\n${airlockCb}\n});`;
    }
  },

  actions: {
    pushLog(kind, message) {
      this.eventLog.unshift({
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString('zh-TW', { hour12: false }),
        kind,
        message
      });
      if (this.eventLog.length > 30) this.eventLog.length = 30;
    },

    setNotice(message, type = 'muted') {
      this.notice = message;
      this.noticeType = type;
    },

    // 程式模擬點擊：讓 2D 按鈕彈一下變色（650ms 後自動復原）
    flashPress(which, ms = 650) {
      this.pressTarget = which;
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        this.pressTarget = null;
        pressTimer = null;
      }, ms);
    },

    resetDefaults() {
      this.disarmEvent = DEFAULTS.disarmEvent;
      this.disarmAction = DEFAULTS.disarmAction;
      this.airlockEvent = DEFAULTS.airlockEvent;
      this.airlockAction = DEFAULTS.airlockAction;
      this.disarmed = false;
      this.airlockOpen = false;
      this.notice = '';
      this.noticeType = 'muted';
      this.eventLog = [];
      this.pressTarget = null;
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      this.pushLog('system', '已重置：4 條線全部接錯（事件＋動作都要修），請重新配置。');
    },

    hydrateFromSaved(savedDomState) {
      if (!savedDomState) return;
      const b = savedDomState.bindings || {};
      if (b.disarmEvent) this.disarmEvent = b.disarmEvent;
      if (b.disarmAction) this.disarmAction = b.disarmAction;
      if (b.airlockEvent) this.airlockEvent = b.airlockEvent;
      if (b.airlockAction) this.airlockAction = b.airlockAction;
      this.disarmed = savedDomState.disarmed ?? false;
      this.airlockOpen = savedDomState.airlockOpen ?? false;
    },

    getDomStateForValidation() {
      return {
        bindings: {
          disarmEvent: this.disarmEvent,
          disarmAction: this.disarmAction,
          airlockEvent: this.airlockEvent,
          airlockAction: this.airlockAction
        },
        disarmed: this.disarmed,
        airlockOpen: this.airlockOpen
      };
    },

    /**
     * 模擬瀏覽器事件分發：只有當觸發的事件型別 == 綁定的事件型別才會執行回呼
     * @param {'disarm'|'airlock'} which
     * @param {'click'|'mouseover'|'dblclick'} firedEvent
     */
    dispatch(which, firedEvent) {
      if (which === 'disarm') {
        if (this.disarmEvent !== firedEvent) {
          const msg = `#disarm-btn 收到「${firedEvent}」，但監聽的是「${this.disarmEvent}」→ 回呼未執行`;
          this.setNotice(msg, 'warning');
          this.pushLog('miss', `❌ ${msg}`);
          return false;
        }
        this.pushLog('event', `⚡ event「${firedEvent}」on #disarm-btn → callback 執行`);
        if (this.disarmAction === 'DISARM_ALARM') {
          if (!this.disarmed) {
            this.disarmed = true;
            this.setNotice('【DOM 更新】statusEl.textContent =「警報系統關閉」；style 轉綠燈！警報解除。', 'success');
            this.pushLog('dom', '✅ #status-indicator.textContent →「警報系統關閉」/ style.color → green');
          } else {
            this.setNotice('警報已經解除了，可以去開氣閘門。', 'success');
          }
          return true;
        }
        this.setNotice('【事件有觸發】但回呼動作綁成「緊急封鎖」，不是解除警報！', 'danger');
        this.pushLog('error', '❌ #disarm-btn 回呼動作錯誤：應為 disarmAlarm');
        return false;
      }

      // airlock
      if (this.airlockEvent !== firedEvent) {
        const msg = `#airlock-btn 收到「${firedEvent}」，但監聽的是「${this.airlockEvent}」→ 回呼未執行`;
        this.setNotice(msg, 'warning');
        this.pushLog('miss', `❌ ${msg}`);
        return false;
      }
      this.pushLog('event', `⚡ event「${firedEvent}」on #airlock-btn → callback 執行`);
      if (!this.disarmed) {
        this.setNotice('【安全協議攔截】isAlarmActive 仍為 true，if 判斷擋下開門！請先解除警報。', 'danger');
        this.pushLog('error', '⛔ 開門被拒：if (!isAlarmActive) 為 false');
        return false;
      }
      if (this.airlockAction === 'OPEN_AIRLOCK') {
        this.airlockOpen = true;
        this.setNotice('【DOM 更新】#airlock-door.classList.add("open")，氣閘門滑開了！', 'success');
        this.pushLog('dom', '✅ #airlock-door.classList → open / textContent → OPEN');
        return true;
      }
      this.setNotice('【事件有觸發】但回呼動作不是開門，請改為 openAirlock。', 'danger');
      this.pushLog('error', '❌ #airlock-btn 回呼動作錯誤：應為 openAirlock');
      return false;
    }
  }
});
