/**
 * Star Rover Odyssey - 逐行執行追蹤（插樁）
 *
 * 在學生程式碼的每個敘述前插入 `__srT(行號, 取變數函式)`，
 * Worker 執行時就能記下「依序跑過哪幾行、當時變數是多少」，
 * 讓編輯器逐行亮起、學生可以一步一步重播。
 *
 * 規則：
 * - 只在同一行插入、不加換行，錯誤堆疊的行號完全不變。
 * - 位於 Script / Block / switch 主體裡的敘述：前面加 `;__srT(...);`
 * - 直接當作 if / for / while 主體的單一敘述（含 else if）：用 `{__srT(...); 原敘述}` 包起來
 * - for / while 的 { } 主體開頭再記一次迴圈那一行，每一圈都看得到「回到迴圈判斷」
 * - 插樁後編譯不過就放棄插樁，照原樣執行（不影響學生）
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import { TRACE_FN, SAFE_GET_FN } from '../sandbox/protocol.js';

const STATEMENTS = new Set([
  'VariableDeclaration',
  'ExpressionStatement',
  'IfStatement',
  'ReturnStatement',
  'ForStatement',
  'WhileStatement',
  'DoStatement',
  'BreakStatement',
  'ContinueStatement',
  'ThrowStatement',
  'TryStatement',
  'SwitchStatement'
]);
const CONTAINERS = new Set(['Script', 'Block', 'SwitchBody']);
const BODY_SLOTS = new Set(['IfStatement', 'ForStatement', 'WhileStatement', 'DoStatement', 'LabeledStatement']);
const LOOPS = new Set(['ForStatement', 'WhileStatement']);

function lineStarts(code) {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function lineAt(starts, pos) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function compiles(code) {
  try {
    // 只編譯不執行；跟 Worker 一樣用嚴格模式
    // eslint-disable-next-line no-new-func
    new Function(`"use strict";\n${code}`);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * @param {string} code 學生原始程式碼
 * @returns {{ code: string, names: string[] } | null} 插樁後的程式碼；無法插樁時回傳 null
 */
export function instrumentForTrace(code) {
  if (typeof code !== 'string' || !code.trim() || !compiles(code)) return null;

  const tree = javascriptLanguage.parser.parse(code);
  const starts = lineStarts(code);
  const names = [];
  // order：同一個位置要出現的先後（小的在前）：收尾 } → 迴圈行 → 敘述追蹤
  const inserts = []; // { pos, text, order }

  // 第一輪：蒐集變數名稱（函式名稱不算，盒子裡只看資料）
  tree.iterate({
    enter(node) {
      if (node.type.isError) return false;
      if (node.name === 'VariableDefinition') {
        const parent = node.node.parent?.name;
        const name = code.slice(node.from, node.to);
        if (parent !== 'FunctionDeclaration' && parent !== 'ClassDeclaration' && !name.startsWith('__sr') && !names.includes(name)) {
          names.push(name);
        }
      }
      return undefined;
    }
  });

  const getter = names.length > 0
    ? `()=>({${names.map((n) => `${n}:${SAFE_GET_FN}(()=>${n})`).join(',')}})`
    : 'null';
  const call = (line) => `${TRACE_FN}(${line},${getter});`;

  // 第二輪：決定插入點
  tree.iterate({
    enter(node) {
      if (!STATEMENTS.has(node.name)) return undefined;
      const parent = node.node.parent;
      const line = lineAt(starts, node.from);
      if (parent && CONTAINERS.has(parent.name)) {
        inserts.push({ pos: node.from, text: `;${call(line)}`, order: 2 });
      } else if (parent && BODY_SLOTS.has(parent.name)) {
        inserts.push({ pos: node.from, text: `{${call(line)}`, order: 2 });
        inserts.push({ pos: node.to, text: '}', order: 0 });
      }
      // 迴圈每一圈開頭，再亮一次迴圈那一行
      if (LOOPS.has(node.name)) {
        const body = node.node.lastChild;
        if (body && body.name === 'Block') {
          inserts.push({ pos: body.from + 1, text: call(line), order: 1 });
        }
      }
      return undefined;
    }
  });

  // 從後往前插，前面的位置才不會跑掉。
  // 同一位置後插入的文字會排在前面，所以 order 大的先插
  inserts.sort((a, b) => b.pos - a.pos || b.order - a.order);
  let out = code;
  for (const ins of inserts) {
    out = out.slice(0, ins.pos) + ins.text + out.slice(ins.pos);
  }

  if (!compiles(out)) return null;
  return { code: out, names };
}
