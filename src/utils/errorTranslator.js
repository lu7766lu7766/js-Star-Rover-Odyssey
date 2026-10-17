/**
 * Star Rover Odyssey - 新手錯誤翻譯
 *
 * 把 JavaScript 原生的英文錯誤（ReferenceError / SyntaxError …）翻成
 * 「白話標題 + 推測原因」，並找出真正出錯的行號，讓零基礎學生看得懂、改得動。
 * 同時偵測注音輸入法最常造成的全形符號（；（）＝「」），並提供一鍵修正。
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import { stripCommentsAndStrings } from './codeAnalysis.js';

/** 錯誤圖鑑：每一種錯誤類型的名稱與圖示（學生收集用） */
export const ERROR_DEX = {
  blank: { name: '空格沒填', icon: '🕳️', tip: '程式碼裡還留著 ___，要換成真正的值' },
  fullwidth: { name: '全形符號陷阱', icon: '🀄', tip: '中文輸入法打出的；（）＝看起來一樣，電腦卻看不懂' },
  'not-defined': { name: '找不到名字', icon: '🔍', tip: '文字忘了加引號，或變數名稱拼錯、大小寫不同' },
  'unclosed-string': { name: '引號沒關好', icon: '✂️', tip: '字串的開頭和結尾都要有引號' },
  'unclosed-bracket': { name: '括號迷路', icon: '🧩', tip: '( ) 和 { } 必須成對出現' },
  'unexpected-token': { name: '文法打結', icon: '🪢', tip: '少了逗號、多了符號，或括號沒成對' },
  'not-function': { name: '不是函式', icon: '📞', tip: '只有函式才能加 () 呼叫' },
  'read-undefined': { name: '讀到空氣', icon: '💨', tip: '想讀取屬性的東西其實是 undefined' },
  'const-assign': { name: '常數不能改', icon: '🔒', tip: 'const 宣告後就不能重新指定' },
  redeclare: { name: '重複宣告', icon: '👯', tip: '同一個名字只能用 let / const 宣告一次' },
  tdz: { name: '還沒宣告就使用', icon: '⏳', tip: '要先宣告變數，下面的程式才能使用它' },
  timeout: { name: '停不下來的迴圈', icon: '🌀', tip: '迴圈條件永遠成立，程式就停不下來' },
  logic: { name: '邏輯小誤差', icon: '🎯', tip: '程式能跑，但結果跟任務要求不一樣' },
  unknown: { name: '神祕錯誤', icon: '👾', tip: '把錯誤訊息念出來，和同學或老師一起推理' }
};

/** 全形 → 半形對照（只修正字串與註解以外的位置） */
const FULLWIDTH_MAP = {
  '；': ';', '，': ',', '、': ',', '（': '(', '）': ')', '｛': '{', '｝': '}',
  '［': '[', '］': ']', '＝': '=', '＋': '+', '－': '-', '＊': '*', '／': '/',
  '＜': '<', '＞': '>', '！': '!', '＂': '"', '＇': "'", '“': '"', '”': '"',
  '‘': "'", '’': "'", '「': '"', '」': '"', '『': '"', '』': '"', '：': ':',
  '．': '.', '。': '.', '　': ' ', '｜': '|', '＆': '&', '％': '%'
};

function toHalfWidth(ch) {
  if (FULLWIDTH_MAP[ch]) return FULLWIDTH_MAP[ch];
  const code = ch.charCodeAt(0);
  // 全形英數字 ０-９ Ａ-Ｚ ａ-ｚ
  if ((code >= 0xff10 && code <= 0xff19) || (code >= 0xff21 && code <= 0xff3a) || (code >= 0xff41 && code <= 0xff5a)) {
    return String.fromCharCode(code - 0xfee0);
  }
  return null;
}

function lineColAt(code, index) {
  const before = code.slice(0, index).split('\n');
  return { line: before.length, col: before[before.length - 1].length + 1 };
}

/**
 * 找出字串與註解以外的第一個全形符號。
 * @returns {{ line: number, col: number, char: string, replacement: string, count: number } | null}
 */
export function findFullWidthIssue(code) {
  if (typeof code !== 'string') return null;
  const stripped = stripCommentsAndStrings(code);
  let first = null;
  let count = 0;
  for (let i = 0; i < code.length; i++) {
    if (stripped[i] !== code[i]) continue; // 字串內容或註解：不動
    const half = toHalfWidth(code[i]);
    if (half === null) continue;
    count++;
    if (!first) first = { index: i, char: code[i], replacement: half };
  }
  if (!first) return null;
  return { ...lineColAt(code, first.index), char: first.char, replacement: first.replacement, count };
}

/** 一鍵把字串與註解以外的全形符號換成半形 */
export function fixFullWidth(code) {
  if (typeof code !== 'string') return code;
  const stripped = stripCommentsAndStrings(code);
  let out = '';
  for (let i = 0; i < code.length; i++) {
    const half = stripped[i] === code[i] ? toHalfWidth(code[i]) : null;
    out += half ?? code[i];
  }
  return out;
}

/** 找出沒有結尾引號的字串所在行（一般字串不可跨行） */
export function findUnclosedString(code) {
  if (typeof code !== 'string') return null;
  const lines = stripCommentsAndStrings(code).split('\n');
  for (let idx = 0; idx < lines.length; idx++) {
    // 去註解後，' 與 " 的數量為奇數代表有字串沒關
    const singles = (lines[idx].match(/'/g) || []).length;
    const doubles = (lines[idx].match(/"/g) || []).length;
    if (singles % 2 === 1 || doubles % 2 === 1) return idx + 1;
  }
  return null;
}

/** 用編輯器同一套語法解析器找出第一個文法錯誤的行號 */
export function locateSyntaxError(code) {
  if (typeof code !== 'string') return null;
  const unclosed = findUnclosedString(code);
  if (unclosed) return unclosed;
  try {
    const tree = javascriptLanguage.parser.parse(code);
    let pos = null;
    tree.iterate({
      enter(node) {
        if (pos !== null) return false;
        if (node.type.isError) pos = node.from;
        return undefined;
      }
    });
    if (pos === null) return null;
    return lineColAt(code, pos).line;
  } catch (e) {
    return null;
  }
}

/**
 * 從錯誤堆疊取出學生程式碼的行號。
 * @param {string} stack
 * @param {number} offset 包裝函式額外加的行數（見 gameApi.STUDENT_CODE_LINE_OFFSET）
 * @param {number} totalLines 學生程式碼總行數（超出範圍代表行號不可信）
 */
export function extractStudentLine(stack, offset, totalLines) {
  if (!stack || typeof stack !== 'string') return null;
  // Chrome / Edge：<anonymous>:4:17；Firefox：> Function:4:17
  const m = stack.match(/(?:<anonymous>|> Function):(\d+):\d+/);
  if (!m) return null;
  const line = Number(m[1]) - offset;
  if (line < 1 || line > totalLines) return null;
  return line;
}

function similarDeclaredName(code, name) {
  const declared = (stripCommentsAndStrings(code).match(/\b(?:let|const|var|function)\s+([A-Za-z_$][\w$]*)/g) || [])
    .map((m) => m.split(/\s+/).pop());
  return declared.find((d) => d !== name && d.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * 把沙箱回傳的錯誤翻成學生看得懂的說明。
 * @param {{ message: string, name?: string, line?: number|null, code?: string }} err
 * @returns {{ type: string, line: number|null, title: string, explain: string, raw: string }}
 */
export function translateError({ message = '', name = '', line = null, code = '' }) {
  const raw = String(message);
  const isSyntax = name === 'SyntaxError' || /Unexpected|Invalid or unexpected|missing \)|Unterminated/.test(raw);
  let resolvedLine = line;
  if (isSyntax && !resolvedLine) resolvedLine = locateSyntaxError(code);

  const result = (type, title, explain) => ({ type, line: resolvedLine || null, title, explain, raw });

  if (/超時|timeout/i.test(raw)) {
    return result('timeout', '程式跑太久，被強制停下來了', '可能寫出了停不下來的迴圈：檢查 for / while 的條件是否最後會變成 false。');
  }

  let m = raw.match(/^(.+) is not defined$/);
  if (m) {
    const id = m[1];
    if (/[^\x00-\x7F]/.test(id)) {
      return result('not-defined', `找不到叫做「${id}」的變數`, `「${id}」看起來是一段文字。文字（字串）要用引號包起來，例如 "${id}"。`);
    }
    if (id === 'True' || id === 'False') {
      return result('not-defined', `找不到「${id}」`, `布林值要全部小寫：${id.toLowerCase()}（不加引號）。`);
    }
    const similar = similarDeclaredName(code, id);
    if (similar) {
      return result('not-defined', `找不到叫做「${id}」的變數`, `你宣告的是「${similar}」。JavaScript 會區分大小寫，名字要一模一樣。`);
    }
    return result('not-defined', `找不到叫做「${id}」的變數或指令`, `檢查拼字是否正確；如果它是一段文字，記得加引號；如果它是變數，要先用 let 宣告。`);
  }

  m = raw.match(/Cannot read propert(?:y|ies) of (undefined|null)(?: \(reading '(.+)'\))?/);
  if (m) {
    const prop = m[2] ? `.${m[2]}` : '屬性';
    if (m[1] === 'null' && /^(addEventListener|textContent|style|classList|innerText)$/.test(m[2] || '')) {
      return result('read-undefined', `querySelector 沒有找到元素，所以拿不到 ${prop}`, '選擇器要寫成字串並在 id 前加 #，例如 document.querySelector("#disarm-btn")；id 要跟網頁上標示的一模一樣。');
    }
    return result('read-undefined', `想讀取 ${prop}，但前面的東西是 ${m[1]}`, `${m[1]} 代表「什麼都沒有」。檢查 ${prop} 前面的名稱或路徑有沒有打錯。`);
  }

  m = raw.match(/^(.+) is not a function/);
  if (m) {
    return result('not-function', `「${m[1]}」不是函式，不能加 () 呼叫`, '檢查名稱有沒有拼錯，或對照任務說明裡可以使用的指令。');
  }

  if (/Assignment to constant variable/.test(raw)) {
    return result('const-assign', '用 const 宣告的值不能再修改', '如果這個值之後會改變，請改用 let 宣告。');
  }

  m = raw.match(/Identifier '(.+)' has already been declared/);
  if (m) {
    return result('redeclare', `「${m[1]}」被宣告了兩次`, `同一個名字只能用 let / const 宣告一次；第二次要修改時，直接寫 ${m[1]} = 新的值。`);
  }

  m = raw.match(/Cannot access '(.+)' before initialization/);
  if (m) {
    return result('tdz', `在宣告「${m[1]}」之前就使用了它`, `把 let ${m[1]} = ... 那一行移到使用它的程式上面。`);
  }

  if (/Unexpected end of input/.test(raw)) {
    return result('unclosed-bracket', '程式結尾少了右括號', '每個 ( 和 { 都要有對應的 ) 和 }。數數看左右括號是不是一樣多。');
  }

  if (/missing \) after argument list/.test(raw)) {
    return result('unclosed-bracket', '函式呼叫少了右括號 )', '例如 rover.setup(a, b) 結尾的 ) 不能漏掉；參數之間要用逗號分開。');
  }

  if (/Invalid or unexpected token|Unterminated string/.test(raw)) {
    if (findUnclosedString(code)) {
      return result('unclosed-string', '字串的引號沒有成對', '字串要用一對引號包起來，例如 "奧德賽號"：開頭和結尾都要有。');
    }
    return result('unexpected-token', '出現了電腦看不懂的符號', '可能是中文輸入法打出的全形符號，或多打了奇怪的字元。');
  }

  m = raw.match(/Unexpected token '?([^']+?)'?$/);
  if (m) {
    const tok = m[1];
    if (tok === 'else') {
      return result('unexpected-token', 'else 出現在不對的位置', 'else 必須緊接在 if 的 } 後面；檢查前面的 if 區塊有沒有正確用 } 結束。');
    }
    if (tok === ')' || tok === '}') {
      return result('unclosed-bracket', `多了一個「${tok}」，或前面少了配對的括號`, '數數看 ( ) 與 { } 是否成對。');
    }
    return result('unexpected-token', `這裡不該出現「${tok}」`, '常見原因：少了逗號、括號沒成對、或多打了符號。');
  }

  if (/Unexpected (identifier|string|number)/.test(raw)) {
    return result('unexpected-token', '兩個值之間少了符號', '常見原因：參數之間少了逗號、算式少了運算子（+ - * /），或上一行少了括號。');
  }

  if (/Maximum call stack/.test(raw)) {
    return result('timeout', '函式一直呼叫自己，停不下來', '檢查函式裡是不是又呼叫了同一個函式。');
  }

  return result('unknown', '程式執行時發生錯誤', `電腦的原始訊息：${raw}`);
}

/** 把翻譯結果組成一行文字（給執行紀錄與舊介面使用） */
export function formatTranslatedError(t) {
  const where = t.line ? `第 ${t.line} 行：` : '';
  return `${where}${t.title}。${t.explain}`;
}
