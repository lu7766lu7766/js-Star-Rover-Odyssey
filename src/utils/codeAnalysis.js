/**
 * Star Rover Odyssey - Student Code Analysis Utilities
 *
 * 關卡驗證常需要「學生有沒有真的寫出某個語法」（例如 for 迴圈、async/await）。
 * 直接對原始字串做 includes / regex 會被註解與字串騙過，
 * 這裡先把註解（與可選的字串內容）抹成空白，再做比對。
 * 抹除時保留換行與字元位置，行號不會跑掉。
 */

/**
 * 抹除註解；keepStrings=false 時一併把字串內容抹成空白（保留引號）。
 * @param {string} code
 * @param {{ keepStrings?: boolean }} [options]
 * @returns {string}
 */
export function stripCode(code, { keepStrings = false } = {}) {
  if (typeof code !== 'string') return '';
  const n = code.length;
  let out = '';
  let i = 0;

  while (i < n) {
    const c = code[i];
    const d = code[i + 1];

    // 單行註解
    if (c === '/' && d === '/') {
      while (i < n && code[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }

    // 區塊註解
    if (c === '/' && d === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) {
        out += code[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) {
        out += '  ';
        i += 2;
      }
      continue;
    }

    // 字串 / 樣板字串
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += quote;
      i++;
      while (i < n && code[i] !== quote) {
        // 一般字串遇到換行代表沒有正確結尾，停止吞字避免後面整段被當字串
        if (quote !== '`' && code[i] === '\n') break;
        if (code[i] === '\\') {
          const pair = code.slice(i, i + 2);
          out += keepStrings ? pair : pair.replace(/[^\n]/g, ' ');
          i += 2;
          continue;
        }
        out += keepStrings || code[i] === '\n' ? code[i] : ' ';
        i++;
      }
      if (i < n && code[i] === quote) {
        out += quote;
        i++;
      }
      continue;
    }

    out += c;
    i++;
  }

  return out;
}

/** 只抹除註解（字串保留，適合檢查 'wind_speed_10m' 這類可能寫在字串裡的鍵名） */
export function stripComments(code) {
  return stripCode(code, { keepStrings: true });
}

/** 抹除註解與字串內容（適合檢查關鍵字：for / async / && …） */
export function stripCommentsAndStrings(code) {
  return stripCode(code, { keepStrings: false });
}

/** 計算 regex 在「已去註解與字串」程式碼中的出現次數 */
export function countInCode(code, regex) {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const matches = stripCommentsAndStrings(code).match(new RegExp(regex.source, flags));
  return matches ? matches.length : 0;
}

/** 「已去註解與字串」的程式碼是否符合 regex */
export function codeMatches(code, regex) {
  return new RegExp(regex.source, regex.flags.replace('g', '')).test(stripCommentsAndStrings(code));
}

/**
 * 偵測學生是否還留著 ___ 填空。
 * @returns {{ line: number, text: string } | null}
 */
export function findUnfilledBlank(code) {
  if (typeof code !== 'string') return null;
  const lines = stripCommentsAndStrings(code).split('\n');
  const originals = code.split('\n');
  const blank = /(^|[^\w$])_{3,}(?![\w$])/;
  for (let idx = 0; idx < lines.length; idx++) {
    if (blank.test(lines[idx])) {
      return { line: idx + 1, text: (originals[idx] || '').trim() };
    }
  }
  return null;
}
