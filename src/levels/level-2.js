/**
 * Level 2: 能源補給站
 * 核心概念：變數與參數 (Variables & Parameters)
 */

export const LEVEL_2_STARTER_CODE = `// 能源補給站
let initialFuel = 300;   // @type {number} 初始燃料
const burnRate = 30;    // @type {number} 每次消耗
const count = 8;       // @type {number} 推進次數
const speed = 3;       // @type {number} 推力速度

// 推進計算
let totalBurn = ___; // @type {number} 總消耗
let remainingFuel = ___; // @type {number} 剩餘燃料
let distance = ___;  // @type {number} 總位移

rover.approachStation({ distance, speed, remainingFuel });
`;

export default {
  id: 2,
  title: '能源補給站',
  subtitle: '變數與參數',
  conceptTitle: '變數保存資料，參數決定行為',
  concepts: ['變數宣告 (let/const)', '函式傳參', '數值運算'],
  description: `探測船需要進行長途軌道轉移以抵達距離 24 單位的懸浮能源站！系統已預先配置好推進參數（初始燃料 300、每次消耗 30、推進次數 8、推力速度 3）。請運用這四個變數名稱進行四則運算，補齊下方「推進計算」中的空格（___）：依序算出推進總消耗 (totalBurn)、剩餘燃料 (remainingFuel) 與推進總位移 (distance)，並呼叫 rover.approachStation({ distance, speed, remainingFuel }) 讓探測船平穩安全著陸！`,
  targetRequirements: [
    '補齊 totalBurn 算式：每次消耗 × 推進次數 (burnRate * count)',
    '補齊 remainingFuel 算式：初始燃料 - 總消耗 (initialFuel - totalBurn)',
    '補齊 distance 算式：推進次數 × 推力速度 (count * speed)',
    '呼叫 rover.approachStation({ distance, speed, remainingFuel }) 平穩著陸'
  ],
  controlType: 'parameter-adjuster',
  initialParams: {
    initialFuel: 150,
    burnPerThrust: 30,
    thrustCount: 3,
    speed: 2
  },
  paramRanges: {
    initialFuel: { min: 100, max: 500, step: 20, unit: '單位' },
    burnPerThrust: { min: 10, max: 50, step: 5, unit: '單位/次' },
    thrustCount: { min: 1, max: 12, step: 1, unit: '次' },
    speed: { min: 1, max: 6, step: 1, unit: '米/次' }
  },
  hints: [
    '提示 1【變數四則運算】：在 JavaScript 中，變數名稱可以直接參與運算。例如推進次數與每次消耗相乘：「burnRate * count」或「count * burnRate」。',
    '提示 2【剩餘燃料】：剩餘燃料 remainingFuel 等於「初始燃料 減去 推進總消耗」，也就是「initialFuel - totalBurn」。',
    '提示 3【推進總位移】：航行距離 distance 等於「推進次數 乘以 推力速度」，也就是「count * speed」（8 × 3 = 24 單位，剛好抵達能源站！）。'
  ],
  jsCodeExample: `// 💡 JavaScript 對照：利用變數進行運算，再傳入函式當作參數
let initialFuel = 300;     // 初始燃料變數
const burnRate = 30;       // 每次推進消耗
const count = 8;           // 推進次數
const speed = 3;           // 推力速度

// 計算推進總消耗、剩餘燃料與總位移
let totalBurn = burnRate * count;           // 30 * 8 = 240
let remainingFuel = initialFuel - totalBurn; // 300 - 240 = 60
let distance = count * speed;               // 8 * 3 = 24

// 將計算好的參數傳入推進控制函式
rover.approachStation({ distance, speed, remainingFuel });`,
  conceptExplanation: `在程式中，**變數 (Variable)** 就像貼有標籤的收納盒，用來暫存各種類型的資料（例如燃料量、速度）。而當我們呼叫功能時，傳入的數值稱為**參數 (Argument / Parameter)**，它會直接影響函式內部的運算結果與角色的物理行為。`,
  starterCode: LEVEL_2_STARTER_CODE,
  validate: (runResult) => {
    // 新鏈路：Worker 真跑 rover.approachStation({ distance, speed, remainingFuel })
    if (runResult.apiCalls && Array.isArray(runResult.apiCalls)) {
      const calls = runResult.apiCalls.filter((c) => c.api === 'rover.approachStation');
      if (calls.length === 0) {
        return {
          pass: false,
          error: '沒有偵測到 rover.approachStation(...)！請算出 distance / remainingFuel 並呼叫 rover.approachStation({ distance, speed, remainingFuel })。'
        };
      }
      const plan = calls[calls.length - 1].args[0] || {};
      const code = runResult.code || '';
      const targetDistance = 24;
      const totalDistance = Number(plan.distance);
      const speed = Number(plan.speed);
      const remainingFuel = Number(plan.remainingFuel);

      if (!Number.isFinite(totalDistance) || !Number.isFinite(speed) || !Number.isFinite(remainingFuel)) {
        return {
          pass: false,
          error: `參數缺失或不是數字！請傳入 { distance, speed, remainingFuel } 三個數值（收到 ${JSON.stringify(plan)}）。`
        };
      }
      if (remainingFuel < 0) {
        return {
          pass: false,
          error: `燃料耗盡！剩餘燃料為 ${remainingFuel} 單位（總消耗超過初始燃料），推進器在半空中熄火！`
        };
      }
      if (totalDistance < targetDistance) {
        return {
          pass: false,
          error: `推力不足！目前總位移僅 ${totalDistance} 單位，尚未到達距離 ${targetDistance} 的補給平台。`
        };
      }
      if (totalDistance > targetDistance) {
        return {
          pass: false,
          error: `推力過多！總位移 ${totalDistance} 單位衝過了補給平台 (${targetDistance} 單位)！`
        };
      }
      if (speed > 3) {
        return {
          pass: false,
          error: `著陸速度過猛！目前速度為 ${speed}（安全上限為 3），探測船劇烈撞擊停機坪！請降低速度並增加次數。`
        };
      }

      // 星級：有沒有用變數 + * 運算（而非手算好數字硬塞）
      const decls = (code.match(/(let|const)\s+\w+/g) || []).length;
      const usesMult = code.includes('*');
      let stars, suffix;
      if (decls >= 4 && usesMult) {
        stars = 3;
        suffix = '（3星：用變數 + * 乘法算出結果，完美！）';
      } else if (decls >= 2) {
        stars = 2;
        suffix = '（2星：值都對，但多用幾個變數 + * 來算，不要手算硬塞，拿 3 星！）';
      } else {
        stars = 1;
        suffix = '（1星：直接硬塞算好的數字！用 let/const + * 自己算拿 3 星！）';
      }
      return {
        pass: true,
        data: { remainingFuel, totalDistance, speed, stars, fromCode: true },
        feedback: `著陸大成功！推進總位移精準達到 24 單位，剩餘燃料 ${remainingFuel} 單位，平穩降落能源補給平台！${suffix}`
      };
    }

    const params = runResult.params || {};
    const { initialFuel = 0, burnPerThrust = 0, thrustCount = 0, speed = 0 } = params;

    const totalConsumption = burnPerThrust * thrustCount;
    const remainingFuel = initialFuel - totalConsumption;
    const totalDistance = thrustCount * speed;
    const targetDistance = 24;

    if (totalConsumption > initialFuel) {
      return {
        pass: false,
        error: `燃料耗盡！總消耗 ${totalConsumption} 單位大於初始燃料 ${initialFuel} 單位，推進器在半空中熄火！`,
        details: { remainingFuel, totalDistance }
      };
    }

    if (totalDistance < targetDistance) {
      return {
        pass: false,
        error: `推力不足！目前總位移僅 ${totalDistance} 單位，尚未到達距離 ${targetDistance} 的補給平台。`,
        details: { remainingFuel, totalDistance }
      };
    }

    if (totalDistance > targetDistance) {
      return {
        pass: false,
        error: `推力過多！總位移 ${totalDistance} 單位衝過了補給平台 (${targetDistance} 單位)！`,
        details: { remainingFuel, totalDistance }
      };
    }

    if (speed > 3) {
      return {
        pass: false,
        error: `著陸速度過猛！目前速度為 ${speed}（安全上限為 3），探測船劇烈撞擊停機坪！請降低推力速度並增加次數。`,
        details: { remainingFuel, totalDistance, speed }
      };
    }

    return {
      pass: true,
      data: { remainingFuel, totalDistance, speed, stars: 2, fromCode: false },
      feedback: `著陸大成功！推進總位移精準達到 24 單位，剩餘燃料 ${remainingFuel} 單位，平穩降落能源補給平台！（2星：滑桿模式上限，切「寫碼」用變數 + * 自己算拿 3 星）`
    };
  }
};
