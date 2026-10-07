/**
 * Level 7: 無人機編隊
 * 核心概念：陣列與綜合應用 (Arrays & Iteration)
 */

export const LEVEL_7_STARTER_CODE = `// 巡邏編隊無人機清單 (陣列內包含 4 架無人機物件)
const drones = [
  { id: "DRONE-01", name: "游隼號", battery: 85, model: "Recon-X" },
  { id: "DRONE-02", name: "夜梟號", battery: 15, model: "Stealth-V" },
  { id: "DRONE-03", name: "海鵰號", battery: 92, model: "Heavy-T" },
  { id: "DRONE-04", name: "雀鷹號", battery: 12, model: "Scout-M" }
];

// 遍歷編隊並指派任務指令
drones.forEach((drone) => {   // @param {Object} drone 無人機物件
  if (drone.battery < ___) {   // @type {number} 低電量門檻
    drone.order = ___;   // @type {"RETURN_BASE" | "PATROL"} 低電量指令
  } else {
    drone.order = ___;   // @type {"RETURN_BASE" | "PATROL"} 高電量指令
  }
});

droneFleet.deploy(drones);
`;

export default {
  id: 7,
  title: '無人機編隊',
  subtitle: '陣列與批次處理',
  conceptTitle: '批次管理成批資料：陣列與迭代',
  concepts: ['陣列 (Array [])', '資料遍歷 (forEach)', '條件篩選 (filter)'],
  description: `巡邏編隊由 4 架不同型號的偵查無人機組成，程式碼中已宣告無人機陣列 (const drones = [...])。請使用 forEach 遍歷陣列中的每架無人機，設定安全電量判斷閾值（< 20%，門檻填純數字，不加引號）：讓低電量無人機優先「返航充電」，高電量無人機出發「執行巡邏」，防止無人機在深空因電力耗盡而墜毀！指令只能填英文："RETURN_BASE"＝返航充電 / "PATROL"＝空域巡邏（字串前後加引號，填中文一定失敗）。`,
  targetRequirements: [
    '檢視程式碼中的無人機陣列 (const drones = [...])',
    '設定低電量防護閾值為 20%（門檻填數字，不加引號）',
    '低電量無人機判定執行「返航充電 (RETURN_BASE)」（英文大寫字串，加引號，不可填中文）',
    '高電量無人機判定執行「空域巡邏 (PATROL)」（英文大寫字串，加引號，不可填中文）',
    '呼叫 droneFleet.deploy(drones) 啟動編隊，確認全員零損傷安全回傳數據'
  ],
  controlType: 'array-fleet',
  dronesData: [
    { id: 'DRONE-01', name: '游隼號', battery: 85, model: 'Recon-X' },
    { id: 'DRONE-02', name: '夜梟號', battery: 15, model: 'Stealth-V' },
    { id: 'DRONE-03', name: '海鵰號', battery: 92, model: 'Heavy-T' },
    { id: 'DRONE-04', name: '雀鷹號', battery: 12, model: 'Scout-M' }
  ],
  hints: [
    '提示 1【陣列宣告與走訪】：程式碼開頭已宣告 const drones = [...] 陣列存放 4 架無人機物件。我們可以使用 forEach 迴圈逐一走訪每架無人機並檢查其屬性。',
    '提示 2【無人機電量觀察】：請觀察程式碼中 const drones 陣列，夜梟號 (15%) 與雀鷹號 (12%) 的電量低於 20%，若直接指派巡邏將因電量耗盡墜毀。',
    '提示 3【引導式思考】：安全閾值應該設定在多少百分比（< 20），才能正確分流出低電量無人機執行「返航充電 ("RETURN_BASE")」，並讓高電量無人機出發「空域巡邏 ("PATROL")」？'
  ],
  jsCodeExample: `// 💡 JavaScript 對照：使用陣列與 forEach 逐一處理無人機
const drones = [
  { id: "DRONE-01", name: "游隼號", battery: 85, model: "Recon-X" },
  { id: "DRONE-02", name: "夜梟號", battery: 15, model: "Stealth-V" },
  { id: "DRONE-03", name: "海鵰號", battery: 92, model: "Heavy-T" },
  { id: "DRONE-04", name: "雀鷹號", battery: 12, model: "Scout-M" }
];

// 遍歷陣列中的每一個物件
drones.forEach((drone) => {
  if (drone.battery < 20) {
    drone.order = "RETURN_BASE";
    console.log(\`\${drone.name} 電量偏低 (\${drone.battery}%)，已返航！\`);
  } else {
    drone.order = "PATROL";
    console.log(\`\${drone.name} 狀態良好 (\${drone.battery}%)，出發巡邏！\`);
  }
});

droneFleet.deploy(drones);`,
  conceptExplanation: `當我們需要管理多筆同類型的資料（例如全班學生成績、遊戲中的眾多敵人物件）時，會使用**陣列 (Array)**。陣列就像一排置物櫃，可以用 \`[0], [1], [2]...\` 依序索引，也能透過 \`forEach\` 快速對每一筆資料執行相同的邏輯判斷。`,
  starterCode: LEVEL_7_STARTER_CODE,
  validate: (runResult) => {
    // 新鏈路：Worker 真跑 forEach + droneFleet.deploy(list) 的 trace
    if (runResult.apiCalls && Array.isArray(runResult.apiCalls)) {
      const calls = runResult.apiCalls.filter((c) => c.api === 'droneFleet.deploy');
      if (calls.length === 0) {
        return {
          pass: false,
          error: '沒有偵測到 droneFleet.deploy(...)！請走訪 drones 陣列、逐架指派 order 後呼叫 droneFleet.deploy(drones)。'
        };
      }
      const list = calls[calls.length - 1].args[0];
      const code = runResult.code || '';
      if (!Array.isArray(list) || list.length === 0) {
        return {
          pass: false,
          error: 'deploy 收到的是空陣列！請把指派好 order 的無人機陣列傳入 droneFleet.deploy(...)。'
        };
      }
      for (const d of list) {
        const order = d.order ?? d.status;
        const expected = Number(d.battery) < 20 ? 'RETURN_BASE' : 'PATROL';
        if (!order) {
          return {
            pass: false,
            error: `【${d.name || d.id || '未知無人機'}】沒有 order！請用 forEach 逐架判斷 battery 並指派 "RETURN_BASE" 或 "PATROL"。`
          };
        }
        if (order !== expected) {
          const why = expected === 'RETURN_BASE'
            ? `電量僅 ${d.battery}%（< 20%），派去巡邏會在半途斷電墜毀！`
            : `電量有 ${d.battery}%，應該出發巡邏防守空域！`;
          return {
            pass: false,
            error: `【${d.name || d.id}】指派錯誤：給了【${order}】，正確應為【${expected}】。${why}`
          };
        }
      }

      // 星級：有沒有用迭代（而非手寫 4 筆指派）
      const hasForEach = code.includes('forEach') || code.includes('filter') || code.includes('.map(');
      const hasFor = /for\s*\(/.test(code);
      let stars, suffix;
      if (hasForEach) {
        stars = 3;
        suffix = '（3星：用 forEach/filter 批次處理，完美！）';
      } else if (hasFor) {
        stars = 2;
        suffix = '（2星：過關！改用 forEach/filter 更符合陣列批次精神，拿 3 星！）';
      } else {
        stars = 1;
        suffix = '（1星：一架一架手寫指派也能過，但 40 架時怎麼辦？用 forEach 拿 3 星！）';
      }
      return {
        pass: true,
        data: { deployed: list.length, fleet: list, stars, fromCode: true },
        feedback: `編隊調度大獲全勝！${list.length} 架無人機全員正確分流，零損傷安全回傳數據！${suffix}`
      };
    }

    const fleetConfig = runResult.fleetConfig || {};
    const { batteryThreshold = 20, lowBatteryAction, normalBatteryAction, dispatched = false } = fleetConfig;

    if (!dispatched) {
      return {
        pass: false,
        error: '邏輯已配置，但尚未點擊「執行編隊派遣」按鈕以派發任務！'
      };
    }

    if (batteryThreshold < 16) {
      return {
        pass: false,
        error: `安全閾值設為 ${batteryThreshold}% 過低！夜梟號 (15%) 未被攔截而出勤，在半途中斷電墜毀！安全閾值應設為 20%。`
      };
    }

    if (lowBatteryAction !== 'RETURN_BASE') {
      return {
        pass: false,
        error: '低電量無人機的處置行為必須為「返航充電」，不可安排其他任務！'
      };
    }

    if (normalBatteryAction !== 'PATROL') {
      return {
        pass: false,
        error: '電量充足的無人機應分派執行「空域巡邏」以防守空域！'
      };
    }

    return {
      pass: true,
      data: { batteryThreshold, lowBatteryAction, normalBatteryAction, stars: 2, fromCode: false },
      feedback: `編隊調度大獲全勝！游隼號與海鵰號完成全域巡邏，低電量的夜梟號與雀鷹號安全回塢充滿能源！（2星：表單模式上限，切「寫碼」用 forEach 拿 3 星）`
    };
  }
};
