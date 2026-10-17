import { describe, it, expect } from 'vitest';
import { checkParsons, shuffleLines, solutionLength } from '../src/utils/parsons.js';
import { ALL_LEVELS } from '../src/levels/index.js';

const SOLUTION = [['let a = 1;', 'let b = 2;'], 'let c = a + b;', 'console.log(c);'];

describe('排排看檢查', () => {
  it('同一區塊內可以任意順序', () => {
    expect(checkParsons(SOLUTION, ['let a = 1;', 'let b = 2;', 'let c = a + b;', 'console.log(c);']).ok).toBe(true);
    expect(checkParsons(SOLUTION, ['let b = 2;', 'let a = 1;', 'let c = a + b;', 'console.log(c);']).ok).toBe(true);
  });

  it('跨區塊換位置就不對，並指出第一個錯的位置', () => {
    expect(checkParsons(SOLUTION, ['let a = 1;', 'let c = a + b;', 'let b = 2;', 'console.log(c);']))
      .toEqual({ ok: false, reason: 'wrong', wrongAt: 1 });
  });

  it('少行、多行、用到陷阱行、空白', () => {
    expect(checkParsons(SOLUTION, ['let a = 1;', 'let b = 2;']).reason).toBe('missing');
    expect(checkParsons(SOLUTION, [...SOLUTION.flat(), 'x;']).reason).toBe('extra');
    expect(checkParsons(SOLUTION, ['let a = "1";'], ['let a = "1";'])).toEqual({ ok: false, reason: 'trap', wrongAt: 0 });
    expect(checkParsons(SOLUTION, []).reason).toBe('empty');
  });

  it('洗牌不會剛好是原本的順序', () => {
    let seed = 0;
    const fakeRandom = () => [0.99, 0.99, 0.99, 0.5][seed++ % 4]; // 前幾次洗出原順序，逼它重洗
    const lines = SOLUTION.flat();
    expect(shuffleLines(lines, fakeRandom)).not.toEqual(lines);
    expect(shuffleLines(lines).sort()).toEqual([...lines].sort());
  });
});

/** 區塊內所有排列組合（題目都很短，直接展開） */
function allOrders(solution) {
  const permute = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => permute([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p])));
  return solution.reduce(
    (acc, block) => acc.flatMap((prefix) => (Array.isArray(block) ? permute(block) : [[block]]).map((p) => [...prefix, ...p])),
    [[]]
  );
}

describe('各關暖身題目', () => {
  for (const level of ALL_LEVELS) {
    it(`第 ${level.id} 號關卡：每一種被接受的排法都是合法的 JavaScript`, () => {
      const { solution, distractors } = level.parsons;
      expect(solutionLength(solution)).toBeGreaterThanOrEqual(4);
      for (const order of allOrders(solution)) {
        expect(checkParsons(solution, order, distractors).ok).toBe(true);
        // 只編譯不執行
        expect(() => new Function(`return async () => {\n${order.join('\n')}\n}`)).not.toThrow();
      }
      // 陷阱行不能剛好也是正確答案的一部分
      for (const trap of distractors) expect(solution.flat()).not.toContain(trap);
    });
  }
});
