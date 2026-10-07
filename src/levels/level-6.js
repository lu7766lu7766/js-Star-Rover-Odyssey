/**
 * Level 6: 太空艙控制中心
 * 核心概念：事件與 DOM (Events & DOM - addEventListener)
 */

export const LEVEL_6_STARTER_CODE = `// 太空艙控制中心
// 任務細節見左側任務簡報，元素 id 與正確字串見上方 2D 網頁與右側 DevTools

// 選取元素
const disarmButton = document.querySelector(___);   // @type {Element} 解除警報按鈕
const airlockButton = document.querySelector(___);  // @type {Element} 氣閘按鈕
const statusEl = document.querySelector(___);       // @type {Element} 狀態燈
const doorEl = document.querySelector(___);         // @type {Element} 氣閘艙門

let isAlarmActive = true; // @type {boolean} 警報狀態變數

// 解除警報回呼
disarmButton.addEventListener(___, () => {   // @type {"click" | "dbclick" | "mouseover"} 事件名稱
  isAlarmActive = false;
  statusEl.textContent = ___;   // @type {"警報系統關閉" | "系統故障"} 狀態燈文字
  statusEl.style.color = ___;   // @type {"green" | "red"} 燈號顏色
});

// 氣閘開門回呼（含守衛判斷）
airlockButton.addEventListener(___, () => {   // @type {"click" | "dbclick" | "mouseover"} 事件名稱
  if (!___) {   // @type {boolean} 警報狀態變數
    doorEl.classList.add(___);      // @type {"open" | "closed"} 艙門滑開用的 CSS class
    doorEl.textContent = ___;       // @type {"氣閘已開啟" | "氣閘已關閉"} 艙門文字
  }
});
`;

export default {
  id: 6,
  title: '太空艙控制中心',
  subtitle: '2D 網頁修復任務 · 事件與 DOM',
  conceptTitle: '使用者與網頁的橋樑：事件驅動',
  concepts: ['DOM 元素選擇', '事件監聽器 (addEventListener)', 'textContent / style 即時改寫'],
  description: `太空艙的控制「網頁」當機了！上方 2D 視窗就是一整個故障中的儀表板網頁：警報燈狂閃、氣閘門鎖死。2D 儀表板上有 4 個元素：解除警報按鈕、氣閘按鈕、狀態燈、氣閘艙門，請照著任務需求將程式接起來。`,
  targetRequirements: [
    '用 querySelector 選取 4 個元素（順序不可調換：第 1 行解除警報按鈕、第 2 行氣閘按鈕、第 3 行狀態燈 #status-indicator、第 4 行艙門 #airlock-door，id 寫在 2D 網頁各元素上方，選擇器為字串加引號、id 前面加 #）',
    '為兩顆按鈕接回 "click" 事件',
    '解除警報回呼：把 isAlarmActive 改為 false。並改寫狀態燈文字為：警報系統關閉。顏色改為green。',
    '氣閘回呼：先用 if 守衛判斷「警報已解除」才放行，把艙門加上滑開用的 CSS class：open。並改寫門文字：氣閘已開啟。',
  ],
  controlType: 'dom-events',
  initialBindings: {
    disarmBtn: { eventType: 'mouseover', action: 'EMERGENCY_LOCK' },
    airlockBtn: { eventType: 'dblclick', action: 'DISARM_ALARM' }
  },
  availableEvents: ['click', 'mouseover', 'dblclick'],
  availableActions: [
    { id: 'DISARM_ALARM', label: '解除安全警報 (disarmAlarm)' },
    { id: 'OPEN_AIRLOCK', label: '開啟氣閘艙門 (openAirlock)' },
    { id: 'EMERGENCY_LOCK', label: '全艙緊急封鎖 (emergencyLock)' }
  ],
  hints: [
    '提示 1【DOM 與事件】：addEventListener(事件, 回呼) 只是「先幫按鈕接好電線」。querySelector 則是用 CSS 選擇器把元素選出來，id 選擇器寫法是加引號、# 開頭，id 本尊寫在 2D 網頁每個元素上方的 <code> 標籤裡。',
    '提示 2【動手實驗】：故意把事件改成 mouseover 或 dblclick 再執行，看看報錯怎麼說。日常網頁按鈕最直覺的就是 click，驗證只認 click。',
    '提示 3【順序有意義】：開門的 JS 裡有 if (!isAlarmActive) 守衛判斷。警報沒解除（變數仍為 true）就開門會被擋下，先解除警報讓變數變 false 再開門才是正確流程。',
    '提示 4【字串去哪找】：狀態燈文字、燈號顏色、艙門 class 名都不用背——2D 網頁上都寫著：狀態卡顯示正常時的文字與顏色，氣閘按鈕下方小字會顯示「classList 已加 …」的提示，右側 DevTools 的 DOM TREE 也會即時顯示艙門目前的 class。照著填進 ___ 即可。'
  ],
  jsCodeExample: `// 💡 JavaScript 對照：你在下方接的線，就是這段程式碼
const disarmButton = document.querySelector('#disarm-btn');
const airlockButton = document.querySelector('#airlock-btn');
const statusEl = document.querySelector('#status-indicator');
const doorEl = document.querySelector('#airlock-door');

let isAlarmActive = true;

// 1. 接線：解除警報按鈕
disarmButton.addEventListener('click', () => {
  isAlarmActive = false;
  statusEl.textContent = '警報系統關閉'; // ← 直接改網頁文字！
  statusEl.style.color = 'green';             // ← 直接改網頁樣式！
});

// 2. 接線：氣閘門按鈕（含安全判斷）
airlockButton.addEventListener('click', () => {
  if (!isAlarmActive) {
    doorEl.classList.add('open');             // ← 加上 CSS class，門就滑開！
    doorEl.textContent = '氣閘已開啟';
  } else {
    alert('警報中，安全協議禁止開門！');
  }
});`,
  conceptExplanation: `網頁就是一棵 DOM 樹，每個按鈕、文字、艙門都是一個節點。addEventListener('click', callback) 是「幫節點接電線」：先接好，之後使用者一點擊，瀏覽器就自動跑回呼。本關上方就是一個真的 2D 網頁，你親手接線、親手點擊，親眼看到 textContent、style、class 被改寫——這就是前端工程師每天在做的事！`,
  starterCode: LEVEL_6_STARTER_CODE,
  validate: (runResult) => {
    // 新鏈路：Worker 真跑接線＋模擬兩路點擊的快照
    if (runResult.domWiring) {
      const code = runResult.code || '';
      const wiring = runResult.domWiring || {};
      const correct = runResult.domCorrect;
      const wrong = runResult.domWrong;

      const listensTo = (snap, id, ev) => {
        const types = snap?.[id]?.listenerTypes || [];
        return types.includes(ev);
      };

      if (!listensTo(wiring, 'disarm-btn', 'click')) {
        return {
          pass: false,
          error: '#disarm-btn 沒有接上 click 監聽！請寫 disarmButton.addEventListener(\'click\', ...)（mouseover / dblclick 不算，日常按鈕用點擊）。'
        };
      }
      if (!listensTo(wiring, 'airlock-btn', 'click')) {
        return {
          pass: false,
          error: '#airlock-btn 沒有接上 click 監聽！請寫 airlockButton.addEventListener(\'click\', ...)。'
        };
      }
      if (!correct || !wrong) {
        return {
          pass: false,
          error: '模擬點擊沒有回傳 DOM 快照，請重試一次。'
        };
      }

      const doorOf = (snap) => snap?.['airlock-door'] || {};
      const statusOf = (snap) => snap?.['status-indicator'] || {};
      const isDoorOpen = (door) =>
        (door.classes || []).includes('open') || /OPEN|開啟/.test(door.innerText || '');
      const isStatusNormal = (st) =>
        /NORMAL|正常|關閉|DISARM/i.test(st.innerText || '') || /green/i.test(st.style?.color || '');

      // 錯誤順序先驗：警報中開門必須被擋下（守衛判斷）
      if (isDoorOpen(doorOf(wrong))) {
        return {
          pass: false,
          error: '安全協議被繞過！警報還沒解除時點擊開門，門竟然開了。氣閘回呼裡必須先判斷警報狀態（例如 if (!isAlarmActive)），警報中禁止開門！'
        };
      }
      if (!isStatusNormal(statusOf(correct))) {
        return {
          pass: false,
          error: '解除警報沒生效！點擊 #disarm-btn 後，#status-indicator 應該轉為警報系統關閉（改 textContent 和 style.color 試試）。'
        };
      }
      if (!isDoorOpen(doorOf(correct))) {
        return {
          pass: false,
          error: '氣閘沒開！解除警報後點擊 #airlock-btn，#airlock-door 應該滑開（加上 open class、改文字）。'
        };
      }

      // 星級：用了幾種 DOM 手法
      const apis = ['querySelector', 'getElementById', 'addEventListener', 'textContent', 'style', 'classList']
        .filter((api) => code.includes(api)).length;
      let stars, suffix;
      if (apis >= 4) {
        stars = 3;
        suffix = '（3星：選擇＋監聽＋改寫全用上，完整前端流程！）';
      } else if (apis >= 2) {
        stars = 2;
        suffix = '（2星：過關！再用上 textContent / style / classList 改寫畫面拿 3 星！）';
      } else {
        stars = 1;
        suffix = '（1星：過關但 DOM 手法太少，多用選擇器與改寫 API 拿 3 星！）';
      }
      return {
        pass: true,
        data: { disarmed: true, airlockOpen: true, stars, fromCode: true },
        feedback: `2D 網頁修復成功！接線、點擊、改寫一次到位，警報解除、氣閘滑開，錯誤順序也被安全協議擋下！${suffix}`
      };
    }

    const domState = runResult.domState || {};
    const { bindings = {}, disarmed = false, airlockOpen = false } = domState;

    if (bindings.disarmEvent !== 'click' || bindings.disarmAction !== 'DISARM_ALARM') {
      return {
        pass: false,
        error: '警報按鈕 (#disarm-btn) 的線接錯了！請接回 "click" 事件＋「解除安全警報」，再去 2D 網頁試試點擊 / 懸停的差別。'
      };
    }

    if (bindings.airlockEvent !== 'click' || bindings.airlockAction !== 'OPEN_AIRLOCK') {
      return {
        pass: false,
        error: '氣閘按鈕 (#airlock-btn) 的線接錯了！請接回 "click" 事件＋「開啟氣閘艙門」。'
      };
    }

    if (!disarmed) {
      return {
        pass: false,
        error: '線接對了，但你還沒親手觸發事件！請到上方 2D 網頁點擊「解除警報」，看 #status-indicator 轉綠燈。'
      };
    }

    if (!airlockOpen) {
      return {
        pass: false,
        error: '警報已解除，很棒！但還沒開門。請到上方 2D 網頁點擊「開啟氣閘」，看 #airlock-door 滑開後再提交。'
      };
    }

    return {
      pass: true,
      data: { disarmed, airlockOpen, stars: 2, fromCode: false },
      feedback: `2D 網頁修復成功！你親手接好 addEventListener、親手點擊觸發，#status-indicator 轉綠、#airlock-door 滑開——這就是 JS 操控 DOM 的完整流程！（2星：表單模式上限，切「寫碼」手寫接線拿 3 星）`
    };
  }
};
