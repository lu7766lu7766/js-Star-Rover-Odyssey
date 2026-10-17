import { describe, it, expect } from 'vitest';
import { instrumentForTrace } from '../src/utils/codeTracer.js';
import { runStudentCode, createTraceRecorder, STUDENT_CODE_LINE_OFFSET } from '../src/sandbox/gameApi.js';
import { TRACE_FN, SAFE_GET_FN } from '../src/sandbox/protocol.js';
import { extractStudentLine } from '../src/utils/errorTranslator.js';
import { LEVEL_1_STARTER_CODE } from '../src/levels/level-1.js';
import { LEVEL_3_STARTER_CODE } from '../src/levels/level-3.js';
import { LEVEL_4_STARTER_CODE } from '../src/levels/level-4.js';
import { LEVEL_9_STARTER_CODE } from '../src/levels/level-9.js';

/** 插樁後執行，回傳每一步的行號與追蹤器 */
function trace(code, globals = {}) {
  const inst = instrumentForTrace(code);
  expect(inst).not.toBe(null);
  const calls = [];
  const tracer = createTraceRecorder({ calls, hiddenValues: Object.values(globals) });
  let error = null;
  try {
    runStudentCode(inst.code, { ...globals, [TRACE_FN]: tracer.hook, [SAFE_GET_FN]: tracer.safeGet });
  } catch (e) {
    error = e;
  }
  return { lines: tracer.steps.map((s) => s.line), steps: tracer.steps, inst, error };
}

describe('逐行追蹤插樁', () => {
  it('不改變行數，錯誤行號照舊', () => {
    const code = 'let a = 1;\nlet b = 2;\nlet c = missing + 1;';
    const { inst, error } = trace(code);
    expect(inst.code.split('\n').length).toBe(3);
    expect(extractStudentLine(error.stack, STUDENT_CODE_LINE_OFFSET, 3)).toBe(3);
  });

  it('依序記下直線程式的每一行與變數值', () => {
    const { lines, steps } = trace('let a = 1;\nlet b = a + 1;\na = b * 10;\nlet c = a;');
    expect(lines).toEqual([1, 2, 3, 4]);
    // 第 3 行執行「前」a 還是 1；第 4 行執行前 a 已經變成 20
    expect(steps[2].vars.find((v) => v.name === 'a').display).toBe('1');
    expect(steps[3].vars.find((v) => v.name === 'a').display).toBe('20');
    // 還沒宣告的 c 不會出現在盒子裡
    expect(steps[0].vars.map((v) => v.name)).not.toContain('c');
  });

  it('if / else if / else 只走進符合的分支', () => {
    const code = [
      'function pick(d) {',
      '  if (d < 5) {',
      "    return 'STOP';",
      '  } else if (d < 15) {',
      "    return 'SLOW';",
      '  } else {',
      "    return 'FULL';",
      '  }',
      '}',
      'pick(10);'
    ].join('\n');
    expect(trace(code).lines).toEqual([10, 2, 4, 5]);
  });

  it('沒有大括號的 if 主體也追得到', () => {
    const code = "function f(x) {\n  if (x) return 'yes';\n  return 'no';\n}\nf(true);\nf(false);";
    // if 和 return 在同一行，連續兩步會合併成一步
    expect(trace(code).lines).toEqual([5, 2, 6, 2, 3]);
  });

  it('for 迴圈每一圈都會回到迴圈那一行', () => {
    const code = 'let sum = 0;\nfor (let i = 0; i < 3; i++) {\n  sum += i;\n}\nlet done = sum;';
    const { lines, steps } = trace(code);
    expect(lines).toEqual([1, 2, 3, 2, 3, 2, 3, 5]);
    // 第三圈時 i 是 2
    expect(steps[5].vars.find((v) => v.name === 'i').display).toBe('2');
  });

  it('注入的 API 物件與函式不會出現在變數盒子', () => {
    const rover = { setup: () => {} };
    const { steps } = trace('let name = "a";\nrover.setup(name);', { rover });
    expect(steps[1].vars).toEqual([{ name: 'name', type: 'string', display: '"a"' }]);
  });

  it('超過上限就停止記錄並標記', () => {
    const inst = instrumentForTrace('let n = 0;\nwhile (n < 1000) {\n  n++;\n}');
    const tracer = createTraceRecorder({ limit: 50 });
    runStudentCode(inst.code, { [TRACE_FN]: tracer.hook, [SAFE_GET_FN]: tracer.safeGet });
    expect(tracer.steps.length).toBe(50);
    expect(tracer.truncated).toBe(true);
  });

  it('編譯不過的程式碼不插樁', () => {
    expect(instrumentForTrace('let a = (1;')).toBe(null);
    expect(instrumentForTrace('')).toBe(null);
  });

  it('所有關卡的範例解答都能插樁且可編譯', () => {
    const filled = [
      LEVEL_1_STARTER_CODE.replace('___', '"a"').replace('___', '90').replace('___', 'true'),
      LEVEL_3_STARTER_CODE.replace('___', '5').replace('___', '15'),
      LEVEL_4_STARTER_CODE.replaceAll('___', '2'),
      LEVEL_9_STARTER_CODE.replace('___', "'jump'").replace('___', "'low'").replace('___', "'slide'")
    ];
    for (const code of filled) {
      const inst = instrumentForTrace(code);
      expect(inst).not.toBe(null);
      expect(inst.code.split('\n').length).toBe(code.split('\n').length);
    }
  });
});

describe('逐行追蹤時間表', async () => {
  const { buildTraceSchedule } = await import('../src/stores/levelStore.js');

  it('沒有動作對齊時，每步固定間隔', () => {
    const steps = [{ calls: 0 }, { calls: 0 }, { calls: 1 }];
    expect(buildTraceSchedule(steps, { intervalMs: 100 })).toEqual([0, 100, 200]);
  });

  it('迷宮：發出第 k 個動作的那一步，在 3D 開始第 k 個動作時亮起', () => {
    // 迴圈判斷(2) → 前進(3) → 迴圈判斷(2) → 前進(3) → 動畫結束後的程式(6)
    const steps = [
      { line: 2, calls: 0 }, { line: 3, calls: 0 },
      { line: 2, calls: 1 }, { line: 3, calls: 1 },
      { line: 6, calls: 2 }
    ];
    const t = buildTraceSchedule(steps, { actionMs: 400, intervalMs: 300 });
    expect(t).toEqual([0, 120, 280, 400, 800]);
    // 時間表必須嚴格遞增，每一步才都看得到
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
  });
});

describe('插樁不改變程式行為', async () => {
  const { createGameApi } = await import('../src/sandbox/gameApi.js');
  const { ALL_LEVELS } = await import('../src/levels/index.js');

  /** 執行並回傳 API 呼叫紀錄與錯誤訊息（有些範例只是示意、本來就跑不動，兩邊要錯得一樣） */
  async function runAndRecord(code, withTrace) {
    const calls = [];
    const api = createGameApi({ calls });
    const globals = { ...api, console: { log() {}, warn() {}, error() {}, info() {} } };
    if (withTrace) {
      const tracer = createTraceRecorder({ calls, hiddenValues: Object.values(api) });
      globals[TRACE_FN] = tracer.hook;
      globals[SAFE_GET_FN] = tracer.safeGet;
    }
    const inst = withTrace ? instrumentForTrace(code) : { code };
    expect(inst).not.toBe(null);
    let error = null;
    try {
      await runStudentCode(inst.code, globals);
    } catch (e) {
      error = `${e.name}: ${e.message}`;
    }
    await new Promise((r) => setTimeout(r, 0));
    return { calls: JSON.parse(JSON.stringify(calls)), error };
  }

  // 第 7 站（DOM）需要 Mock DOM，另外測
  const levels = ALL_LEVELS.filter((l) => l.id !== 6 && l.jsCodeExample);
  for (const level of levels) {
    it(`第 ${level.id} 號關卡的範例解答：插樁前後 API 呼叫與錯誤完全一樣`, async () => {
      const plain = await runAndRecord(level.jsCodeExample, false);
      const traced = await runAndRecord(level.jsCodeExample, true);
      expect(traced).toEqual(plain);
    });
  }
});
