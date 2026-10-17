/**
 * Star Rover Odyssey - 排排看（Parsons 題）
 *
 * 把打亂的程式碼行排回正確順序。solution 是一串「區塊」：
 * - 字串：這一行必須出現在這個位置
 * - 字串陣列：這幾行可以任意順序（例如互不相干的三個 let 宣告）
 * distractors 是用不到的陷阱行（例如 "true" 多了引號）。
 */

/** 正確答案總共幾行 */
export function solutionLength(solution) {
  return solution.reduce((n, block) => n + (Array.isArray(block) ? block.length : 1), 0);
}

/**
 * 檢查學生排出來的順序。
 * @param {(string|string[])[]} solution
 * @param {string[]} answer 學生排好的每一行
 * @param {string[]} [distractors]
 * @returns {{ ok: boolean, reason?: 'empty'|'trap'|'wrong'|'missing'|'extra', wrongAt?: number }}
 *   wrongAt：第一個不對的位置（0 起算）
 */
export function checkParsons(solution, answer, distractors = []) {
  if (answer.length === 0) return { ok: false, reason: 'empty' };

  const trapAt = answer.findIndex((line) => distractors.includes(line) && !solution.flat().includes(line));
  if (trapAt !== -1) return { ok: false, reason: 'trap', wrongAt: trapAt };

  let pos = 0;
  for (const block of solution) {
    // 同一區塊內順序不限：配對到一行就從待配對清單移除，直到這個區塊配完
    const pending = Array.isArray(block) ? [...block] : [block];
    while (pending.length > 0) {
      if (pos >= answer.length) return { ok: false, reason: 'missing' };
      const idx = pending.indexOf(answer[pos]);
      if (idx === -1) return { ok: false, reason: 'wrong', wrongAt: pos };
      pending.splice(idx, 1);
      pos++;
    }
  }
  if (answer.length > pos) return { ok: false, reason: 'extra', wrongAt: pos };
  return { ok: true };
}

/** 洗牌（Fisher–Yates）；洗出來剛好是正確順序就再洗一次 */
export function shuffleLines(lines, random = Math.random) {
  const out = [...lines];
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.some((line, i) => line !== lines[i])) break;
  }
  return out;
}
