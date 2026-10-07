/**
 * Level 5: 模組裝載
 * 核心概念：函式呼叫與物件參數 (Functions & Object Arguments: f(x))
 */

export const AVAILABLE_METHODS = [
  {
    id: 'activateScan',
    name: 'activateScan',
    label: '廣域掃描 (Wide Scan)',
    signature: 'activateScan(scanParams)',
    description: '釋放環狀廣域脈衝，一次普查整片空域，是本任務唯一能覆蓋所有隱藏天體的方法',
    returns: '"SCAN_COMPLETE"',
    usesParams: ['range', 'mode']
  },
  {
    id: 'focusScan',
    name: 'focusScan',
    label: '集束掃描 (Focus Scan)',
    signature: 'focusScan(scanParams)',
    description: '發射集束直線波，一次只能解析單顆指定目標，無法完成全空域普查',
    returns: '"PARTIAL_SINGLE"',
    usesParams: ['target', 'power']
  },
  {
    id: 'pingEcho',
    name: 'pingEcho',
    label: '短促回波 (Ping Echo)',
    signature: 'pingEcho(scanParams)',
    description: '發出短促回波，只能看到近距離殘影，遠端天體完全收不到訊號',
    returns: '"PARTIAL_NEAR"',
    usesParams: ['duration']
  }
];

export const INITIAL_METHOD_CALL = {
  methodId: 'pingEcho',
  params: {
    range: 10,
    mode: 'NORMAL',
    target: 'NEAR-01',
    power: 50,
    duration: 1
  }
};

export const LEVEL_5_STARTER_CODE = `// 模組裝載
const scanParams = {
  range: ___,      // @type {number} 掃描半徑
  mode: ___        // @type {"HIGH" | "NORMAL"} 解析度
};

const scanModule = {
  name: ___,       // @type {"activateScan" | "focusScan" | "pingEcho"} 掃描方法
  range: scanParams.range,
  mode: scanParams.mode,
  activate: function() {
    return ___;    // @type {"SCAN_COMPLETE" | "PARTIAL_SINGLE" | "PARTIAL_NEAR"} 掃描回傳值
  }
};

rover.installModule(scanModule);
`;

export default {
  id: 5,
  title: '模組裝載',
  subtitle: '函式呼叫與物件參數',
  conceptTitle: '函式是動詞，物件是受詞：f(x)',
  concepts: ['函式定義與呼叫 (Function Call)', '物件作為參數 (Object Argument)', '回傳值 (Return Value)'],
  description: `探測船進入未探明的迷霧星區，量子掃描雷達已裝配完成。雷達提供三個函式（方法）：廣域掃描 activateScan、集束掃描 focusScan、短促回波 pingEcho。本次任務是全空域普查——所有隱藏天體座標都要解密（最遠天體在 18 單位，需用 "HIGH" 解析度才能解析深空頻譜）。請選對函式，並配好傳入的參數物件 scanParams（範圍 range、解析度 mode），一發完成普查！方法卡上的「回傳」那一行即為成功普查的回傳字串，請整行照抄。填寫時全部填英文：字串加引號，數字不加引號，填中文一定失敗。`,
  targetRequirements: [
    '呼叫正確的函式：activateScan(scanParams)（全空域普查唯一正解）',
    '參數物件設定 range >= 18 單位（覆蓋最遠的隱藏天體）',
    '參數物件設定 mode 為 "HIGH"（解析深空頻譜）',
    '理解回傳值：只有 activateScan 回傳 "SCAN_COMPLETE"，其餘兩個函式只回傳部分結果'
  ],
  controlType: 'module-object',
  availableMethods: AVAILABLE_METHODS,
  initialMethodCall: INITIAL_METHOD_CALL,
  // 舊存檔相容：過去以 moduleConfig 儲存的進度會被遷移為 methodCall
  initialVariables: INITIAL_METHOD_CALL,
  hints: [
    '提示 1【函式觀念】：函式是「動詞」，物件是「受詞」。呼叫寫成 f(x)：f 是要做的事，x 是做事用的原料包。本關的三個 f 行為完全不同，先讀方法卡再選！',
    '提示 2【方法選型】：任務是「全空域普查」。集束掃描一次只看一顆星、短促回波只看得到近距離，哪一個函式才是為普查設計的？',
    '提示 3【參數物件】：選對函式後，傳入的 scanParams 物件還要合格：range 覆蓋半徑 >= 18、mode 切到 HIGH，執行鈕會即時顯示你正在呼叫的完整算式！'
  ],
  jsCodeExample: `// 💡 JavaScript 對照：函式是動詞，物件是原料包
const scanParams = {
  range: 20,      // 掃描半徑
  mode: "HIGH"    // 解析度
};

// ✅ 正解：廣域普查，一發覆蓋全空域
activateScan(scanParams);   // 回傳 "SCAN_COMPLETE"

// ❌ 集束波：一次只能解析單顆目標
focusScan(scanParams);      // 回傳 "PARTIAL_SINGLE"

// ❌ 短促回波：只能看到近距離殘影
pingEcho(scanParams);       // 回傳 "PARTIAL_NEAR"`,
  conceptExplanation: `**函式 (Function)** 是程式的「動詞」，負責做事；**物件 (Object)** 常被當成「一包參數」傳進函式，寫成 \`f(x)\`。同一個原料包傳給不同的函式，結果完全不同——選對函式跟配對參數一樣重要。這就是本關 3D 裡三種波型看起來完全不一樣的原因。`,
  starterCode: LEVEL_5_STARTER_CODE,
  validate: (runResult) => {
    // 新鏈路：Worker 真跑 rover.installModule(moduleObj) 的 trace
    if (runResult.apiCalls && Array.isArray(runResult.apiCalls)) {
      const calls = runResult.apiCalls.filter((c) => c.api === 'rover.installModule');
      if (calls.length === 0) {
        return {
          pass: false,
          error: '沒有偵測到 rover.installModule(...)！請定義 scanModule 物件並呼叫 rover.installModule(scanModule)。'
        };
      }
      const mod = calls[calls.length - 1].args[0] || {};
      const code = runResult.code || '';

      if (!mod.hasActivate) {
        return {
          pass: false,
          error: 'scanModule 缺少 activate 函式！模組必須有 activate 方法（function），回傳普查結果字串。'
        };
      }
      if (mod.activateError) {
        return {
          pass: false,
          error: `activate() 執行出錯：${mod.activateError}。請檢查函式內容。`
        };
      }
      if (mod.name !== 'activateScan') {
        const got = mod.name ?? '未命名';
        const hint = mod.name === 'focusScan'
          ? 'focusScan 是集束直線波，一次只能解析單顆指定目標，無法完成「全空域普查」。'
          : 'pingEcho 是短促回波，只能看到近距離殘影，遠端天體完全收不到訊號。';
        return {
          pass: false,
          error: `方法選型錯誤！你裝載的是【${got}】。${hint}請改用 activateScan。`,
          details: { methodId: mod.name, expected: 'activateScan' }
        };
      }
      const numRange = Number(mod.range);
      if (isNaN(numRange) || numRange < 18) {
        return {
          pass: false,
          error: `參數不足！目前 range 為 ${mod.range} 單位，最遠的隱藏天體位於 18 單位處，請將半徑調至 18 或以上！`
        };
      }
      if (mod.mode !== 'HIGH') {
        return {
          pass: false,
          error: `參數不足！目前 mode 為 ${JSON.stringify(mod.mode)}，請切換為 "HIGH" 才能解析星圖深空頻譜。`
        };
      }
      if (mod.activateResult !== 'SCAN_COMPLETE') {
        return {
          pass: false,
          error: `回傳值錯誤！activate() 回傳了 ${JSON.stringify(mod.activateResult)}，全空域普查成功必須回傳 "SCAN_COMPLETE"。`
        };
      }

      // 星級：物件是否具名宣告 + 是否用 function/return
      const hasNamedObject = /(let|const)\s+\w+\s*=\s*\{/.test(code);
      const hasFunction = /function|=>/.test(code);
      let stars, suffix;
      if (hasNamedObject && hasFunction) {
        stars = 3;
        suffix = '（3星：物件具名宣告 + 方法回傳，完美！）';
      } else if (hasFunction) {
        stars = 2;
        suffix = '（2星：把參數包成具名的 scanParams 物件再傳入，拿 3 星！）';
      } else {
        stars = 1;
        suffix = '（1星：過關但物件/方法結構鬆散，用 const 包好物件 + function 回傳拿 3 星！）';
      }
      return {
        pass: true,
        data: { methodId: 'activateScan', range: numRange, mode: 'HIGH', returns: 'SCAN_COMPLETE', stars, fromCode: true },
        feedback: `深空普查大獲全勝！activateScan 一發覆蓋 ${numRange} 單位空域，回傳 "SCAN_COMPLETE"，所有隱匿星體座標已全數解密歸檔！${suffix}`
      };
    }

    // 新形狀 { methodCall: { methodId, params } }，相容舊形狀 { moduleConfig: {...} }
    const legacy = runResult.moduleConfig || null;
    const methodCall = runResult.methodCall || runResult || {};
    let { methodId, params = {} } = methodCall;

    if (!methodId && legacy) {
      // 舊存檔遷移：quantum-scanner 視為選對方法，其餘視為選錯方法
      if (legacy.moduleId === 'quantum-scanner' && legacy.isMethodInvoked) {
        methodId = 'activateScan';
        params = { range: legacy.range ?? 0, mode: legacy.mode ?? 'NORMAL' };
      } else if (legacy.moduleId) {
        methodId = 'pingEcho';
        params = { range: legacy.range ?? 0, mode: legacy.mode ?? 'NORMAL' };
      }
    }

    // 1. 先判方法選型（方法錯就不談數值）
    if (methodId === 'focusScan') {
      return {
        pass: false,
        error: '方法選型錯誤！focusScan 是集束直線波，一次只能解析單顆指定目標，無法完成「全空域普查」。請改呼叫 activateScan(scanParams)。',
        details: { methodId, expected: 'activateScan' }
      };
    }

    if (methodId !== 'activateScan') {
      return {
        pass: false,
        error: '方法選型錯誤！pingEcho 是短促回波，只能看到近距離殘影，遠端天體完全收不到訊號。請改呼叫 activateScan(scanParams)。',
        details: { methodId, expected: 'activateScan' }
      };
    }

    // 2. 參數物件完整性
    const { range = 0, mode } = params;
    if (range === undefined || range === null || mode === undefined) {
      return {
        pass: false,
        error: '參數物件不完整！scanParams 必須包含 range（掃描半徑）與 mode（解析度）兩個屬性。',
        details: { params }
      };
    }

    // 3. 參數閾值
    const numRange = Number(range);
    if (isNaN(numRange) || numRange < 18) {
      return {
        pass: false,
        error: `參數不足！目前 scanParams.range 為 ${range} 單位，最遠的隱藏天體位於 18 單位處，請將半徑調至 18 或以上！`,
        details: { range, targetRange: 18 }
      };
    }

    if (mode !== 'HIGH') {
      return {
        pass: false,
        error: '參數不足！請將 scanParams.mode 切換為 "HIGH" 才能解析星圖深空頻譜。'
      };
    }

    return {
      pass: true,
      data: { methodId, range: numRange, mode, returns: 'SCAN_COMPLETE', stars: 2, fromCode: false },
      feedback: `深空普查大獲全勝！activateScan(scanParams) 一發覆蓋 ${numRange} 單位空域，回傳 "SCAN_COMPLETE"，所有隱匿星體座標已全數解密歸檔！（2星：點選模式上限，切「寫碼」自己定義物件 + 方法拿 3 星）`
    };
  }
};
