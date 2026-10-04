/**
 * Level 9: 太空站跑酷（課程順序位於第 3 關與第 4 關之間，見 levels/index.js）
 * 核心概念：條件判斷實戰（if / else if / else）、字串比較 ===、邏輯或 ||、
 *          「換一張地圖也能通關」的通用邏輯
 *
 * 注意：id 是穩定的資料鍵（存檔、驗證、場景都靠它），不代表課程順序；
 * 學生看到的關卡編號請用 getLevelNumber(id)。
 */

import { PARKOUR_COURSES, describeFailure } from '../game/sim/parkour.js';
import { codeMatches } from '../utils/codeAnalysis.js';

export const LEVEL_9_STARTER_CODE = `// 太空站跑酷：自動決策
// ahead 是「前方一格」的地形：'ground' | 'gap' | 'low' | 'high' | 'finish'
// 動作只有三種：'run' | 'jump' | 'slide'
function decide(ahead) {   // @param {string} ahead 前方一格的地形
  if (ahead === 'gap') {
    return ___;   // @type {string} 缺口要怎麼通過？
  } else if (ahead === ___) {   // @type {string} 低矮障礙的地形名稱
    return 'jump';
  } else if (ahead === 'high') {
    return ___;   // @type {string} 高空橫桿要怎麼通過？
  } else {
    return 'run';
  }
}

runner.setAutoRun(decide);
`;

export default {
  id: 9,
  title: '太空站跑酷',
  subtitle: '條件判斷實戰 if / else if',
  conceptTitle: '讓程式即時做決策：看見前方地形，選擇正確動作',
  concepts: ['else if 多分支', '字串比較 ===', '邏輯或 ||', '通用邏輯（換地圖也能過）'],
  description: `廢棄太空站的緊急撤離通道啟動了！探測車要穿過一段充滿陷阱的走廊，抵達終點的逃生艙。每一步探測車都會偵測「前方一格」的地形（ahead），你要寫出決策函式 decide(ahead)，回傳要做的動作：平地用 'run' 前進、缺口與低矮障礙要 'jump' 跳過、高空橫桿要 'slide' 滑過。注意：每種地形只有一個正確動作，做錯就會摔倒！完成後用 runner.setAutoRun(decide) 註冊，探測車就會自動跑完整條賽道。但小心——系統還會把你的程式丟到 3 條沒公開的新賽道考驗，只會背「第幾步要跳」是過不了的，必須根據眼前的地形做決定！`,
  targetRequirements: [
    "補完 decide(ahead)：ahead === 'gap' 時回傳 'jump'（動作是字串，要加引號）",
    "補完低矮障礙的判斷：地形名稱是字串（要加引號），一樣回傳 'jump'",
    "補完高空橫桿：ahead === 'high' 時回傳 'slide'",
    "其他地形（平地與終點）回傳 'run'",
    '用 runner.setAutoRun(decide) 註冊函式，並通過訓練場與 3 條隱藏賽道'
  ],
  controlType: 'parkour',
  hints: [
    "提示 1【看懂函式】：decide(ahead) 每一步都會被呼叫一次，ahead 就是前方一格的地形字串。if / else if 從上到下檢查，第一個成立的分支會 return 動作，後面的就不會執行。",
    "提示 2【對照表】：'ground' → 'run'；'gap' → 'jump'；'low' → 'jump'；'high' → 'slide'；'finish' → 'run'。字串比較要用 ===，兩邊的字串都要加引號。",
    "提示 3【進階寫法】：缺口和低矮障礙的動作一樣，可以用邏輯或 || 合併成一個條件：if (ahead === 'gap' || ahead === 'low')。想知道每一步發生什麼事，也可以在 decide 裡用 console.log 印出 ahead 與你的選擇。"
  ],
  jsCodeExample: `// 💡 JavaScript 對照：用條件判斷讓程式即時決策
function decide(ahead) {
  // || 讓兩種地形共用同一個動作
  if (ahead === 'gap' || ahead === 'low') {
    return 'jump';   // 跳過去
  } else if (ahead === 'high') {
    return 'slide';  // 滑過去
  } else {
    return 'run';    // 平地與終點直接跑
  }
}

runner.setAutoRun(decide);`,
  conceptExplanation: `**條件判斷 (if / else if / else)** 讓程式根據「現在看到的情況」做出不同反應。跑酷關的重點是：你寫的不是「第 3 步跳、第 5 步滑」這種死背的流程，而是一套**通用規則**——不管賽道怎麼排列，只要照著眼前的地形判斷就能過關。這正是程式比手動操作強大的地方：規則寫對一次，換多少張地圖都適用。字串比較用 \`===\`（三個等號，嚴格相等），多個條件可以用 \`||\`（或）合併。`,
  starterCode: LEVEL_9_STARTER_CODE,
  validate: (runResult) => {
    const apiCalls = runResult.apiCalls || [];
    const code = runResult.code || '';
    const call = apiCalls.find((c) => c.api === 'runner.setAutoRun');

    if (!call || !call.isFunction) {
      return {
        pass: false,
        error: '沒有偵測到 runner.setAutoRun(函式)！請定義 decide(ahead) 並用 runner.setAutoRun(decide) 註冊。'
      };
    }

    const runs = call.runs || [];
    // 賽道依 PARKOUR_COURSES 的順序檢查：先訓練場，再隱藏賽道
    const ordered = PARKOUR_COURSES.map((course) => ({
      course,
      run: runs.find((r) => r.courseId === course.id)
    }));

    const toTrace = (run) =>
      (run?.frames || []).map((f) => ({
        tick: f.tick,
        ahead: f.ahead,
        action: f.action,
        ok: f.ok,
        reason: f.reason
      }));

    for (const { course, run } of ordered) {
      if (!run) {
        return {
          pass: false,
          error: `系統沒有取得【${course.name}】的跑步紀錄，請重新執行。`
        };
      }
      if (!run.finished) {
        const detail = describeFailure(run.fail, run.error);
        const hiddenNote = course.visible
          ? ''
          : '\n💡 訓練場能過、換賽道卻失敗，代表規則少考慮了某種地形，或是用了只適用單一賽道的寫法。';
        return {
          pass: false,
          failReason: run.fail?.reason || 'ERROR',
          error: `【${course.name}】${detail}${hiddenNote}`,
          data: {
            courseId: course.id,
            courseName: course.name,
            tiles: course.tiles,
            trace: toTrace(run),
            failTick: run.fail?.tick ?? null
          }
        };
      }
    }

    // 星級：1 通關；+1 用 || 合併相同動作的條件；+1 用 console.log 追蹤決策（除錯習慣）
    const usesOr = codeMatches(code, /\|\|/);
    const usesLog = codeMatches(code, /console\.log\s*\(/);
    const stars = 1 + (usesOr ? 1 : 0) + (usesLog ? 1 : 0);

    const visibleRun = ordered[0].run;
    const coursesPassed = ordered.length;
    const tips = [];
    if (!usesOr) tips.push("用 || 把 'gap' 與 'low' 合併成一個條件");
    if (!usesLog) tips.push('在 decide 裡用 console.log 印出 ahead 與選擇');
    const suffix = stars === 3
      ? '（3星：邏輯或合併條件 + console.log 追蹤，工程師等級的寫法！）'
      : `（${stars}星：想拿更高星等，試試：${tips.join('；')}）`;

    return {
      pass: true,
      data: {
        stars,
        fromCode: true,
        coursesPassed,
        courseId: 'A',
        courseName: ordered[0].course.name,
        tiles: ordered[0].course.tiles,
        trace: toTrace(visibleRun),
        usesOr,
        usesLog
      },
      feedback: `跑酷成功！探測車通過了訓練場與 ${coursesPassed - 1} 條隱藏賽道，你的決策規則是真正「通用」的！${suffix}`
    };
  }
};
