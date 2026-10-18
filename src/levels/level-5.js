/**
 * Level 5: 深空普查
 * 核心概念：物件屬性（obj.prop）、函式參數與回傳值、同一個函式重複使用
 *
 * 三顆星距離都不一樣，range 寫死一定會有星體失敗；
 * 驗證時還會拿學生的 scanPlanet 去掃隱藏星系（見 sandbox/gameApi.js 的 runHiddenScanSurvey），
 * 只有真的用 planet.distance 算的函式才過得了。
 */

import {
  VISIBLE_PLANETS,
  RANGE_MARGIN,
  HIGH_RES_DISTANCE,
  describePulseFailure
} from '../game/sim/scanner.js';
import { codeMatches } from '../utils/codeAnalysis.js';

export const LEVEL_5_STARTER_CODE = `// 深空普查：雷達在迷霧裡偵測到 3 顆隱藏星體
const planetA = { name: "Kepler-A", distance: 8 };
const planetB = { name: "Kepler-B", distance: 14 };
const planetC = { name: "Kepler-C", distance: 21 };

// 掃描一顆星體：半徑 = 星體距離 + 2（太小掃不到，太大會過熱）
function scanPlanet(planet) {   // @param {Object} planet 要掃描的星體物件
  const params = {
    target: planet.name,
    range: ___ + 2,   // @type {number} 星體的距離（從 planet 物件裡讀）
    mode: "NORMAL"
  };
  if (planet.distance > 15) {
    params.mode = ___;   // @type {"HIGH" | "NORMAL"} 遠距離星體的解析度
  }
  return scanner.pulse(params);   // 回傳掃描報告 { target, found, coords }
}

const reportA = scanPlanet(planetA);
const reportB = scanPlanet(___);   // @type {Object} 要掃描的星體物件
const reportC = ___;   // @type {Object} 呼叫 scanPlanet 掃描 C 星，存下報告

rover.flyTo(___);   // @type {Object} C 星報告裡的座標
`;

const PLANET_C = VISIBLE_PLANETS[VISIBLE_PLANETS.length - 1];

/** 半徑類失敗算第 0 項要求，解析度類算第 1 項，其他（目標錯誤）算第 2 項 */
const REQ_BY_STATUS = {
  BAD_RANGE: 0,
  TOO_SHORT: 0,
  OVERHEAT: 0,
  BAD_MODE: 1,
  LOW_RES: 1,
  OVEREXPOSED: 1,
  BAD_PARAMS: 2,
  NO_TARGET: 2
};

const sameCoords = (a, b) => Boolean(a && b) && a.x === b.x && a.z === b.z;

export default {
  id: 5,
  title: '深空普查',
  subtitle: '物件屬性與函式重複使用',
  // 一句話任務目標（任務欄最上方）
  goal: '寫一個 scanPlanet 函式，掃描 3 顆隱藏星體，再飛往最遠的 C 星',
  conceptTitle: '寫一次函式，換不同的物件就能一直用',
  // 通關後的出場券：一題快速檢核
  quiz: {
    question: '執行後 result 是多少？',
    code: `function scanRange(planet) {
  return planet.distance + 2;
}
const result = scanRange({ name: "Vega", distance: 10 });`,
    options: ['12', '10', '"Vega"'],
    answer: 0,
    explain: '呼叫時把 { name: "Vega", distance: 10 } 交給參數 planet，planet.distance 讀出 10，回傳 10 + 2 = 12。'
  },
  concepts: ['物件屬性 (obj.prop)', '函式參數 (Parameter)', '回傳值 (Return Value)', '同一個函式重複呼叫'],
  description: `探測船進入迷霧星區，雷達偵測到 3 顆隱藏星體 Kepler-A、B、C，每顆星都是一個物件，記著名字 name 和距離 distance。掃描脈衝的半徑 range 至少要等於星體距離才碰得到它，但最多只能比距離多 ${RANGE_MARGIN}，不然雷達會過熱；距離超過 ${HIGH_RES_DISTANCE} 的星體要切 "HIGH" 解析度，近的用 "HIGH" 反而會過曝。三顆星的距離都不一樣，所以不能把數字寫死——請完成 scanPlanet(planet) 函式，讓它從 planet 物件讀出距離、算出參數，再分別掃描三顆星。scanner.pulse 會回傳一份掃描報告，掃到的話座標就在報告的 coords 裡，最後把 C 星的座標交給 rover.flyTo 出發！小心：系統還會拿你的 scanPlanet 去掃幾個沒公開的隱藏星系，只對這三顆星有效的寫法過不了。`,
  targetRequirements: [
    '掃描半徑：range 用 planet.distance 算出來（距離 + 2）',
    `解析度：距離超過 ${HIGH_RES_DISTANCE} 的星體，把 params.mode 改成 "HIGH"`,
    '呼叫 scanPlanet 三次，把 Kepler-A、B、C 都掃到',
    '把 C 星報告裡的座標 reportC.coords 交給 rover.flyTo',
    '隱藏星系考驗：同一個 scanPlanet 換一組星體也要全部掃到'
  ],
  controlType: 'module-object',
  hints: [
    '提示 1【讀物件屬性】：planet 是一個物件，用「物件.屬性」讀出裡面的值：planet.name 是名字、planet.distance 是距離。函式裡要用參數 planet，不要寫 planetA——這樣同一個函式才能掃每一顆星。',
    '提示 2【呼叫函式】：呼叫寫成「函式名(要交給它的東西)」：scanPlanet(planetB) 會把 planetB 交給參數 planet。reportC 那一行要自己寫出完整的呼叫，把回傳的報告存起來。',
    '提示 3【回傳值】：scanPlanet 回傳的報告是一個物件 { target, found, coords }，座標在它的 coords 屬性裡，所以要寫 rover.flyTo(reportC.coords)。想看報告長什麼樣子，可以加一行 console.log(reportC)。'
  ],
  jsCodeExample: `// 💡 JavaScript 對照：物件裝資料，函式寫一次、用很多次
const planetA = { name: "Kepler-A", distance: 8 };
const planetB = { name: "Kepler-B", distance: 14 };
const planetC = { name: "Kepler-C", distance: 21 };

function scanPlanet(planet) {        // planet 是參數：每次呼叫換成不同的星
  const params = {
    target: planet.name,              // 物件.屬性：讀出名字
    range: planet.distance + 2,       // 讀出距離再 + 2
    mode: "NORMAL"
  };
  if (planet.distance > 15) {
    params.mode = "HIGH";             // 也可以改寫物件的屬性
  }
  return scanner.pulse(params);       // 把報告交回給呼叫的人
}

const reportA = scanPlanet(planetA);  // planet = planetA
const reportB = scanPlanet(planetB);  // planet = planetB
const reportC = scanPlanet(planetC);  // planet = planetC

console.log(reportC);                 // { target: "Kepler-C", found: true, coords: {...} }
rover.flyTo(reportC.coords);          // 回傳值的屬性，接著拿去用`,
  conceptExplanation: `**物件 (Object)** 把相關的資料裝在一起，用 \`物件.屬性\` 讀出來，例如 \`planet.distance\`。**函式 (Function)** 寫一次，每次呼叫時把不同的東西交給參數：\`scanPlanet(planetA)\` 時 planet 就是 planetA，\`scanPlanet(planetC)\` 時就是 planetC。函式用 **return** 把結果交回來，存進變數後還能繼續用，例如 \`reportC.coords\`。這就是 3D 裡同一個函式打出三道大小不同的脈衝的原因。`,
  starterCode: LEVEL_5_STARTER_CODE,
  validate: (runResult) => {
    const calls = Array.isArray(runResult?.apiCalls) ? runResult.apiCalls : [];
    const code = runResult?.code || '';
    const fail = (reqIndex, error) => ({ pass: false, reqIndex, error });

    const pulses = calls
      .filter((c) => c.api === 'scanner.pulse')
      .map((c) => ({ status: c.status, distance: c.distance, params: c.args?.[0] || {} }));
    if (pulses.length === 0) {
      return fail(2, '沒有偵測到任何掃描脈衝！scanPlanet 裡要 return scanner.pulse(params)，並用 scanPlanet(planetA) 這樣的寫法呼叫它。');
    }

    // 1. 參數物件本身有問題（不是物件、target 找不到星）
    const badTarget = pulses.find((p) => p.status === 'BAD_PARAMS' || p.status === 'NO_TARGET');
    if (badTarget) return fail(2, describePulseFailure(badTarget));

    // 2. 三顆星依序檢查：有沒有掃、掃的參數對不對
    for (const planet of VISIBLE_PLANETS) {
      const mine = pulses.filter((p) => p.params.target === planet.name);
      if (mine.length === 0) {
        const varName = `planet${planet.name.slice(-1)}`;
        return fail(2, `還沒掃描 ${planet.name}！要呼叫 scanPlanet(${varName})，把 ${varName} 交給函式。`);
      }
      if (!mine.some((p) => p.status === 'OK')) {
        const last = mine[mine.length - 1];
        return fail(REQ_BY_STATUS[last.status] ?? 2, describePulseFailure(last));
      }
    }

    // 3. 用回傳的報告出發
    const flights = calls.filter((c) => c.api === 'rover.flyTo');
    if (flights.length === 0) {
      return fail(3, '三顆星都掃到了，但探測船還沒出發！最後要呼叫 rover.flyTo(reportC.coords)。');
    }
    const dest = flights[flights.length - 1].args?.[0];
    if (dest && typeof dest === 'object' && 'coords' in dest) {
      return fail(3, 'rover.flyTo 收到的是整份報告，導航只要座標。座標在報告的 coords 屬性裡：rover.flyTo(reportC.coords)。');
    }
    if (!sameCoords(dest, PLANET_C.coords)) {
      const other = VISIBLE_PLANETS.find((p) => sameCoords(dest, p.coords));
      if (other) {
        return fail(3, `這是 ${other.name} 的座標！任務要飛往最遠的 ${PLANET_C.name}，要用 reportC.coords。`);
      }
      return fail(3, `rover.flyTo 收到的是 ${JSON.stringify(dest) ?? 'undefined'}，不是座標。先用 const reportC = scanPlanet(planetC) 存下報告，再把 reportC.coords 交給導航。`);
    }

    // 4. 隱藏星系：同一個 scanPlanet 換一組星體
    const survey = calls.find((c) => c.api === 'scanner.hiddenSurvey');
    if (!survey) {
      return fail(4, '找不到 scanPlanet 函式！函式名稱要叫 scanPlanet，系統才能拿它去考隱藏星系。');
    }
    for (const system of survey.systems || []) {
      const bad = system.planets.find((p) => !p.ok);
      if (!bad) continue;
      let reason;
      if (bad.error) {
        reason = `執行出錯：${bad.error}`;
      } else if (bad.pulses.length === 0) {
        reason = 'scanPlanet 沒有發出任何脈衝';
      } else {
        const last = bad.pulses[bad.pulses.length - 1];
        reason = last.params.target === bad.name
          ? describePulseFailure(last)
          : `脈衝瞄準的是 ${JSON.stringify(last.params.target)}，不是這顆星。target 要寫 planet.name`;
      }
      return fail(4, `訓練星系過關了，但隱藏星系的 ${bad.name}（距離 ${bad.distance}）失敗：${reason} 你的函式是不是只對 Kepler 三顆星有效？要讀參數 planet 的屬性。`);
    }

    // 星級：每顆星一發就中（不浪費能源）、用 console.log 看過回傳的報告
    const noWaste = pulses.length === VISIBLE_PLANETS.length;
    const logsReport = codeMatches(code, /console\.log\s*\([^;\n]*(report|\.coords|\.found)/);
    const stars = 1 + (noWaste ? 1 : 0) + (logsReport ? 1 : 0);
    const tips = [];
    if (!noWaste) tips.push(`每顆星只掃一次（這次發了 ${pulses.length} 發脈衝）`);
    if (!logsReport) tips.push('用 console.log(reportC) 看看回傳的報告長什麼樣子');
    const suffix = stars === 3
      ? '（3星：一個函式掃遍所有星系，還看懂了回傳的報告，完美！）'
      : `（${stars}星：想拿更高星等，試試：${tips.join('；')}）`;

    return {
      pass: true,
      data: { stars, pulses: pulses.length },
      feedback: `深空普查完成！同一個 scanPlanet 掃到 Kepler-A、B、C 和所有隱藏星系，探測船正飛往 ${PLANET_C.name}！${suffix}`
    };
  }
};
