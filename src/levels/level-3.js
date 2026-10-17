/**
 * Level 3: 隕石避障
 * 核心概念：條件判斷 (Conditionals - if / else if / else)
 */

export const LEVEL_3_STARTER_CODE = `// 隕石避障：自動導航
function autoPilot(distance) {   // @param {number} distance 即時距離
  if (distance < ___) {
    return 'STOP';
  } else if (distance < ___) {
    return 'SLOW_DOWN';
  } else {
    return 'FULL_SPEED';
  }
}

rover.setAutoPilot(autoPilot);
`;

export default {
  id: 3,
  title: '隕石避障',
  subtitle: '條件判斷',
  // 一句話任務目標（任務欄最上方）
  goal: '寫出自動導航：太近就停、有點近就減速、很遠就全速前進',
  conceptTitle: '讓程式依不同情況做決定：if / else',
  // 通關後的出場券：一題快速檢核
  quiz: {
    question: 'distance 是 5 的時候，會回傳什麼？',
    code: `if (distance < 5) {
  return 'STOP';
} else if (distance < 15) {
  return 'SLOW_DOWN';
} else {
  return 'FULL_SPEED';
}`,
    options: ['STOP', 'SLOW_DOWN', 'FULL_SPEED'],
    answer: 1,
    explain: '5 < 5 不成立（5 沒有小於 5），所以往下檢查 5 < 15，成立 → SLOW_DOWN。'
  },
  concepts: ['條件判斷', '邏輯比較 (<, <=, >)', '分支決策'],
  description: `前方進入密集小行星亂石流！雷達感測器會持續回傳與前方隕石的「即時距離」。請為探測船的自動導航系統設定條件邏輯，根據距離做出正確的安全決策：極度接近時緊急煞停、近距離時減速觀察、遠距離時全速巡航。`,
  targetRequirements: [
    '設定條件 1：若距離 < 5，執行「停止 (STOP)」避免撞毀（門檻填數字，不加引號）',
    '設定條件 2：若距離 < 15，執行「減速巡航 (SLOW_DOWN)」謹慎通過（門檻填數字，不加引號）',
    '設定預設分支 (否則)：執行「全速前進 (FULL_SPEED)」維持前進動能（回傳值為固定的英文大寫字串，要加引號，不可填中文或修改單字）'
  ],
  controlType: 'condition-builder',
  conditionRules: {
    rule1: { threshold: 5, action: '' },
    rule2: { threshold: 15, action: '' },
    fallbackAction: ''
  },
  availableActions: [
    { id: 'STOP', label: '停止避碰 (STOP)', tag: 'danger' },
    { id: 'SLOW_DOWN', label: '減速慢行 (SLOW_DOWN)', tag: 'warning' },
    { id: 'FULL_SPEED', label: '全速前進 (FULL_SPEED)', tag: 'success' }
  ],
  testDistances: [3, 10, 22],
  hints: [
    '提示 1【條件判斷觀念】：if (條件) { 行為 } 會先檢查第一個分支。如果條件成立就執行動作，後續的 else if 與 else 就不會再觸發。',
    '提示 2【雷達分區觀察】：障礙物雷達區分三層：極度接近區 (距離 < 5)、警戒緩衝區 (距離 < 15) 與開闊航道 (距離 >= 15)。',
    '提示 3【引導式思考】：越靠近隕石越危險。思考：在第一道防線 (距離 < 5) 應該執行什麼動作才能避免撞毀？當前方開闊遠離障礙時，最後的 else 預設分支應該保持什麼速度？'
  ],
  jsCodeExample: `// 💡 JavaScript 對照：多重條件判斷
function autoPilotDecision(distance) {
  if (distance < 5) {
    // 距離極近：緊急停止
    return 'STOP';
  } else if (distance < 15) {
    // 距離接近：減速巡航
    return 'SLOW_DOWN';
  } else {
    // 安全開闊：全速前進
    return 'FULL_SPEED';
  }
}`,
  conceptExplanation: `**條件判斷 (Conditional)** 是程式具備「智慧」的基石。透過 \`if\`、\`else if\` 與 \`else\`，電腦能檢視環境數據（例如距離、電量、分數），並根據比較的結果自動走進不同的處理分支，做出最佳反應。`,
  starterCode: LEVEL_3_STARTER_CODE,
  validate: (runResult) => {
    // 新鏈路：Worker 真跑 rover.setAutoPilot(autoPilot) 的 trace
    if (runResult.apiCalls && Array.isArray(runResult.apiCalls)) {
      const call = runResult.apiCalls.find((c) => c.api === 'rover.setAutoPilot');
      if (!call || !call.isFunction) {
        return {
          pass: false,
          error: '沒有偵測到 rover.setAutoPilot(函式)！請定義 autoPilot(distance) 並註冊。'
        };
      }
      if (call.fnError) {
        return {
          pass: false,
          error: `自動導航函式執行出錯：${call.fnError}。請檢查 return 值是否為 'STOP' / 'SLOW_DOWN' / 'FULL_SPEED' 字串。`
        };
      }
      const r = call.testResults || {};
      const visible = [
        { dist: 3, expected: 'STOP', reason: '距離 3（極近距離），應緊急煞停避免撞擊！', reqIndex: 0 },
        { dist: 10, expected: 'SLOW_DOWN', reason: '距離 10（警戒範圍），應減速巡航謹慎通過！', reqIndex: 1 },
        { dist: 20, expected: 'FULL_SPEED', reason: '距離 20（安全距離），應全速前進！', reqIndex: 2 }
      ];
      for (const test of visible) {
        if (r[test.dist] !== test.expected) {
          return {
            pass: false,
            reqIndex: test.reqIndex,
            error: `在測距為 ${test.dist} 單位時，探測船選擇了【${r[test.dist] ?? '未定義'}】，但正確行為應為【${test.expected}】。原因：${test.reason}`,
            details: { dist: test.dist, actual: r[test.dist], expected: test.expected }
          };
        }
      }
      // 隱藏邊界：驗 </<=（5 應為 SLOW_DOWN、15 應為 FULL_SPEED）
      const hidden = [
        { dist: 5, expected: 'SLOW_DOWN' },
        { dist: 7, expected: 'SLOW_DOWN' },
        { dist: 15, expected: 'FULL_SPEED' },
        { dist: 30, expected: 'FULL_SPEED' }
      ];
      const missed = hidden.filter((t) => r[t.dist] !== t.expected);
      if (missed.length > 0) {
        const m = missed[0];
        return {
          pass: true,
          data: { testResults: r, stars: 2, fromCode: true, hiddenMiss: m },
          feedback: `基本情境全對、予以通關（2星）！但邊界沒過：在距離 ${m.dist} 時你的函式回傳【${r[m.dist] ?? '未定義'}】，正確應為【${m.expected}】。想想該用 < 還是 <=？修好邊界拿 3 星！`
        };
      }
      return {
        pass: true,
        data: { testResults: r, stars: 3, fromCode: true },
        feedback: `避障邏輯全數通過（含 5/15 邊界隱藏測試）！探測船完美穿越隕石帶！（3星）`
      };
    }

    const rules = runResult.rules || {};
    const { rule1Threshold, rule1Action, rule2Threshold, rule2Action, fallbackAction } = rules;

    // Simulation helper based on user input rules
    function evaluate(dist) {
      if (dist < rule1Threshold) return rule1Action;
      if (dist < rule2Threshold) return rule2Action;
      return fallbackAction;
    }

    const testCases = [
      { dist: 3, expected: 'STOP', reason: '距離 3（極近距離），應緊急煞停避免撞擊！' },
      { dist: 10, expected: 'SLOW_DOWN', reason: '距離 10（警戒範圍），應減速巡航謹慎通過！' },
      { dist: 22, expected: 'FULL_SPEED', reason: '距離 22（安全距離），應全速前進！' }
    ];

    for (const test of testCases) {
      const actual = evaluate(test.dist);
      if (actual !== test.expected) {
        return {
          pass: false,
          error: `在測距為 ${test.dist} 單位時，探測船選擇了【${actual || '未指定'}】，但正確行為應為【${test.expected}】。原因：${test.reason}`,
          details: { dist: test.dist, actual, expected: test.expected }
        };
      }
    }

    return {
      pass: true,
      data: { rules, stars: 2, fromCode: false },
      feedback: `避障邏輯測試全數通過！探測船在所有測距情境（3、10、22 單位）皆做出完美決策，順利穿越隕石帶！（2星：積木模式上限，切「寫碼」通過隱藏邊界拿 3 星）`
    };
  }
};
