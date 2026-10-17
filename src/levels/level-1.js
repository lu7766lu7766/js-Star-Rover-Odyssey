/**
 * Level 1: 探測船通電自檢
 * 核心概念：變數宣告與基礎資料型態 (Variables & Data Types: String, Number, Boolean)
 */

export const LEVEL_1_STARTER_CODE = `// 探測船通電自檢
let roverName = ___;      // @type {string} 探測船代號
let powerLevel = ___;     // @type {number} 主系統輸出功率
let shieldActive = ___;   // @type {boolean} 量子防護力場開關

rover.setup(roverName, powerLevel, shieldActive);
`;

export default {
  id: 1,
  title: '探測船通電自檢',
  subtitle: '變數宣告與資料型態',
  // 一句話任務目標（任務欄最上方）
  goal: '幫探測船宣告 3 個變數：名字、功率、防護罩開關',
  conceptTitle: '變數是儲存資料的容器：let 與三大基礎型態',
  // 通關後的出場券：一題快速檢核
  quiz: {
    question: '這樣寫的話，shieldActive 是什麼型態？',
    code: 'let shieldActive = "true";',
    options: ['布林 Boolean', '字串 String', '數字 Number'],
    answer: 1,
    explain: '加了引號就變成文字（字串）。布林值 true / false 不能加引號。'
  },
  // 暖身排排看：跟本關觀念相同、但不是本關答案的小題目
  parsons: {
    prompt: '宣告船名（字串）、燃料 75（數字）、準備好了（布林 true），最後把三個值印出來。',
    solution: [
      [
        'let shipName = "星塵號";',
        'let fuel = 75;',
        'let isReady = true;'
      ],
      'console.log(shipName, fuel, isReady);'
    ],
    distractors: ['let isReady = "true";'],
    explain: '三個 let 誰先誰後都可以，但一定要在 console.log 之前宣告。"true" 加了引號就變成字串，不是布林值。'
  },
  concepts: ['變數宣告 (let)', '字串 (String)', '數值 (Number)', '布林值 (Boolean)'],
  description: `歡迎來到奧德賽基地！全新出廠的探測船目前靜止在整備台，系統記憶體處於未配置狀態。請為探測船宣告並初始化 3 個核心狀態變數：設定探測船代號 (字串 String)、調整主系統輸出功率 (數值 Number) 並啟動量子防護力場 (布林值 Boolean)，完成全艦開機通電自檢！`,
  targetRequirements: [
    '宣告 roverName (字串)：為探測船命名 (不可留空或為預設值，字串前後要加引號)',
    '宣告 powerLevel (數值)：調校系統輸出功率至安全標準 (80% ~ 100%，直接寫數字，不加引號)',
    '宣告 shieldActive (布林值)：啟動防護力場開關 (必須為 true，不加引號，加引號會變成字串)',
    '確認三大變數型態各不同且寫法正確，點擊「執行 JS 程式碼」喚醒探測船'
  ],
  controlType: 'variable-declaration',
  initialVariables: {
    roverName: '',
    powerLevel: 0,
    shieldActive: false
  },
  hints: [
    '提示 1【觀念引導】：變數就像貼有標籤的收納盒。宣告變數使用 let，例如 let roverName = "奧德賽號"。',
    '提示 2【型態觀察】：JavaScript 的資料型態包括文字字串 (用引號包覆)、數值 (直接寫數字) 與布林值 (true 或 false)。',
    '提示 3【任務重點】：探測船需要足夠的能源 (至少 80%)，且在深空航行時必須開啟防護罩 (shieldActive 設為 true) 才能通過安全檢測！'
  ],
  jsCodeExample: `// 💡 JavaScript 對照：宣告變數並賦予初始值
// 使用 let 關鍵字建立變數，等號 = 表示賦值

let roverName = "奧德賽號";   // 1. 字串 (String)：用引號包裹的文字
let powerLevel = 100;         // 2. 數值 (Number)：數值計算與計量
let shieldActive = true;      // 3. 布林值 (Boolean)：只有 true 或 false

// 將變數傳入探測船自檢系統
rover.systemCheck({ roverName, powerLevel, shieldActive });`,
  conceptExplanation: `**變數 (Variable)** 是程式設計中最基礎也最重要的觀念。它就像電腦記憶體中的「有名字的抽屜」，讓我們可以把字串（文字）、數值（數字）、布林（真/假開關）等資料存起來，隨時在後續的程式邏輯中使用與修改。`,
  starterCode: LEVEL_1_STARTER_CODE,
  validate: (runResult) => {
    // 新鏈路：Worker 真跑 rover.setup(name, battery, isActive) 的 trace
    if (runResult.apiCalls && Array.isArray(runResult.apiCalls)) {
      const setups = runResult.apiCalls.filter((c) => c.api === 'rover.setup');
      if (setups.length === 0) {
        return {
          pass: false,
          reqIndex: 3,
          error: '沒有偵測到 rover.setup(...)！請宣告三個變數並呼叫 rover.setup(roverName, powerLevel, shieldActive)。'
        };
      }
      const [roverName, powerLevel, shieldActive] = setups[setups.length - 1].args;
      const code = runResult.code || '';

      const trimmedName = String(roverName ?? '').trim();
      if (!trimmedName || trimmedName === '未命名' || trimmedName === 'UNKNOWN') {
        return {
          pass: false,
          reqIndex: 0,
          error: '探測船未命名！roverName 必須是帶名字的字串（例如 "奧德賽號"），不能空字串。',
          details: { field: 'roverName', current: trimmedName }
        };
      }
      if (typeof roverName !== 'string') {
        return {
          pass: false,
          reqIndex: 0,
          error: `型態錯誤！roverName 必須是字串 String（記得加引號），你傳入的是 ${typeof roverName}。`,
          details: { field: 'roverName', current: roverName }
        };
      }

      const numPower = Number(powerLevel);
      if (typeof powerLevel === 'boolean' || isNaN(numPower) || numPower < 80) {
        return {
          pass: false,
          reqIndex: 1,
          error: `能源不足！目前 powerLevel 為 ${String(powerLevel)}，系統最低啟動門檻為 80%。請傳入 80~100 的數值！`,
          details: { field: 'powerLevel', current: powerLevel }
        };
      }
      if (numPower > 100) {
        return {
          pass: false,
          reqIndex: 1,
          error: `電壓超載！目前 powerLevel 為 ${numPower}%，超過反應爐額定上限 (100%)。`,
          details: { field: 'powerLevel', current: numPower }
        };
      }

      if (shieldActive !== true) {
        return {
          pass: false,
          reqIndex: 2,
          error: `防護力場未啟動！shieldActive 必須是布林值 true（不加引號），你傳入的是 ${JSON.stringify(shieldActive)}。`,
          details: { field: 'shieldActive', current: shieldActive }
        };
      }

      // 星級：有沒有真的用 let 宣告三個變數（而非直接塞字面值進 setup）
      const lets = ['roverName', 'powerLevel', 'shieldActive'].filter((v) =>
        new RegExp(`let\\s+${v}\\b`).test(code)
      ).length;
      let stars, suffix;
      if (lets >= 3) {
        stars = 3;
        suffix = '（3星：三個變數都用 let 宣告，完美！）';
      } else if (lets >= 1) {
        stars = 2;
        suffix = `（2星：只用 let 宣告了 ${lets}/3 個變數，把三個值都存進變數再傳入拿 3 星！）`;
      } else {
        stars = 1;
        suffix = '（1星：值都對但沒用 let 宣告變數，直接塞字面值進去的！用 let 存起來再傳入拿 3 星！）';
      }

      return {
        pass: true,
        feedback: `通電自檢全部通過！探測船「${trimmedName}」系統功率已達 ${numPower}%，電漿防護罩成功激活！${suffix}`,
        data: { roverName: trimmedName, powerLevel: numPower, shieldActive: true, stars, fromCode: true }
      };
    }

    const vars = runResult.variables || runResult || {};
    const { roverName = '', powerLevel = 0, shieldActive = false } = vars;

    // 1. Check roverName (String)
    const trimmedName = String(roverName).trim();
    if (!trimmedName || trimmedName === '未命名' || trimmedName === 'UNKNOWN') {
      return {
        pass: false,
        error: '探測船未命名！請在 roverName 輸入有效的船艦代號 (例如 "奧德賽號"、"星馳號")。',
        details: { field: 'roverName', current: trimmedName }
      };
    }

    // 2. Check powerLevel (Number)
    const numPower = Number(powerLevel);
    if (isNaN(numPower) || numPower < 80) {
      return {
        pass: false,
        error: `能源不足！目前 powerLevel 僅為 ${numPower}%，系統最低啟動門檻為 80%。請調高功率數值！`,
        details: { field: 'powerLevel', current: numPower, minRequired: 80 }
      };
    }

    if (numPower > 100) {
      return {
        pass: false,
        error: `電壓超載！目前 powerLevel 為 ${numPower}%，超過反應爐額定上限 (100%)。請避免設備過熱！`,
        details: { field: 'powerLevel', current: numPower, maxLimit: 100 }
      };
    }

    // 3. Check shieldActive (Boolean)
    if (shieldActive !== true) {
      return {
        pass: false,
        error: '防護力場未啟動！深空充滿宇宙射線，shieldActive 必須設定為 true (布林值) 才能通過安全驗證。',
        details: { field: 'shieldActive', current: shieldActive }
      };
    }

    return {
      pass: true,
      feedback: `通電自檢全部通過！探測船「${trimmedName}」系統功率已達 ${numPower}%，電漿防護罩成功激活，全艦進入啟航就緒狀態！（2星：表單模式上限，切「寫碼」用 let 宣告拿 3 星）`,
      data: {
        roverName: trimmedName,
        powerLevel: numPower,
        shieldActive: true,
        stars: 2,
        fromCode: false
      }
    };
  }
};
