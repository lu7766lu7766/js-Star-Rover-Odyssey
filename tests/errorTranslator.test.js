import { describe, it, expect } from 'vitest';
import {
  translateError,
  findFullWidthIssue,
  fixFullWidth,
  locateSyntaxError,
  extractStudentLine
} from '../src/utils/errorTranslator.js';
import {
  runStudentCode,
  findTopLevelDeclarations,
  STUDENT_CODE_LINE_OFFSET
} from '../src/sandbox/gameApi.js';

/** 用跟 Worker 一樣的方式跑學生程式碼，取回錯誤 */
function runAndCatch(code) {
  try {
    runStudentCode(code, { rover: { setup: () => {} } });
    return null;
  } catch (err) {
    return err;
  }
}

describe('錯誤行號', () => {
  it('執行期錯誤的行號扣掉包裝函式後，等於學生看到的行號', () => {
    const code = 'let roverName = 奧德賽號;\nlet powerLevel = 90;\nrover.setup(roverName, powerLevel, true);';
    const err = runAndCatch(code);
    expect(err).toBeTruthy();
    expect(extractStudentLine(err.stack, STUDENT_CODE_LINE_OFFSET, 3)).toBe(1);
  });

  it('第 3 行出錯就回報第 3 行', () => {
    const code = 'let a = 1;\nlet b = 2;\nlet c = notDeclared + 1;';
    const err = runAndCatch(code);
    expect(extractStudentLine(err.stack, STUDENT_CODE_LINE_OFFSET, 3)).toBe(3);
  });

  it('超出程式碼範圍的行號視為不可信', () => {
    expect(extractStudentLine('at <anonymous>:99:1', STUDENT_CODE_LINE_OFFSET, 3)).toBe(null);
    expect(extractStudentLine(undefined, STUDENT_CODE_LINE_OFFSET, 3)).toBe(null);
  });

  it('語法錯誤用解析器定位行號', () => {
    expect(locateSyntaxError('let a = 1;\nlet b = (2;\nrover.setup(a);')).toBe(2);
    expect(locateSyntaxError('let a = "abc;\nlet b = 2;')).toBe(1);
    expect(locateSyntaxError('let a = 1;')).toBe(null);
  });
});

describe('錯誤翻譯', () => {
  it('中文字忘了加引號 → 提醒字串要加引號', () => {
    const t = translateError({ message: '奧德賽號 is not defined', name: 'ReferenceError', line: 1, code: '' });
    expect(t.type).toBe('not-defined');
    expect(t.explain).toContain('"奧德賽號"');
    expect(t.line).toBe(1);
  });

  it('大小寫不同 → 指出宣告時的名稱', () => {
    const t = translateError({ message: 'rovername is not defined', code: 'let roverName = "a";\nrover.setup(rovername);' });
    expect(t.explain).toContain('roverName');
  });

  it('True / False → 提醒布林值要小寫', () => {
    const t = translateError({ message: 'True is not defined', code: '' });
    expect(t.explain).toContain('true');
  });

  it('語法錯誤會自己找行號', () => {
    const code = 'let a = 1;\nrover.setup(a;\n';
    const err = runAndCatch(code);
    const t = translateError({ message: err.message, name: err.name, line: null, code });
    expect(t.line).toBe(2);
    expect(['unclosed-bracket', 'unexpected-token']).toContain(t.type);
  });

  it('字串沒關 → unclosed-string', () => {
    const code = 'let a = "abc;\nlet b = 2;';
    const err = runAndCatch(code);
    const t = translateError({ message: err.message, name: err.name, code });
    expect(t.type).toBe('unclosed-string');
    expect(t.line).toBe(1);
  });

  it('const 重新指定', () => {
    const err = runAndCatch('const a = 1;\na = 2;');
    const t = translateError({ message: err.message, name: err.name, code: '' });
    expect(t.type).toBe('const-assign');
  });

  it('認不得的錯誤保留原始訊息', () => {
    const t = translateError({ message: 'Something weird', code: '' });
    expect(t.type).toBe('unknown');
    expect(t.explain).toContain('Something weird');
  });
});

describe('全形符號', () => {
  it('找到字串與註解以外的全形符號', () => {
    const issue = findFullWidthIssue('let a = 1；\nlet b = 2;');
    expect(issue).toMatchObject({ line: 1, char: '；', replacement: ';' });
  });

  it('字串和註解裡的全形符號不算', () => {
    expect(findFullWidthIssue('let a = "你好，世界！"; // 註解：沒關係')).toBe(null);
  });

  it('中文引號包住的文字會被修成半形引號', () => {
    expect(fixFullWidth('let roverName = “奧德賽號”；')).toBe('let roverName = "奧德賽號";');
    expect(fixFullWidth('let roverName = 「奧德賽號」;')).toBe('let roverName = "奧德賽號";');
  });

  it('一鍵修正只改程式碼本體', () => {
    const code = 'rover.setup（a，b）; // 註解（保留）\nlet s = "（保留）";';
    expect(fixFullWidth(code)).toBe('rover.setup(a,b); // 註解（保留）\nlet s = "（保留）";');
  });
});

describe('變數盒子', () => {
  it('只抓最外層的 let / const / var', () => {
    const code = 'let a = 1;\nconst b = "x";\nfunction f() { let inner = 2; }\nfor (let i = 0; i < 2; i++) {}\nvar c = true;';
    expect(findTopLevelDeclarations(code).map((d) => d.name)).toEqual(['a', 'b', 'c']);
  });

  it('執行完回傳變數值與型態', () => {
    let vars = null;
    runStudentCode('let roverName = "奧德賽號";\nlet powerLevel = 90;\nlet shieldActive = true;', {}, {
      onVariables: (v) => { vars = v; }
    });
    expect(vars).toEqual([
      { name: 'roverName', kind: 'let', type: 'string', display: '"奧德賽號"' },
      { name: 'powerLevel', kind: 'let', type: 'number', display: '90' },
      { name: 'shieldActive', kind: 'let', type: 'boolean', display: 'true' }
    ]);
  });

  it('加上快照不影響錯誤行號', () => {
    let err = null;
    try {
      runStudentCode('let a = 1;\nlet b = missing;', {}, { onVariables: () => {} });
    } catch (e) {
      err = e;
    }
    expect(extractStudentLine(err.stack, STUDENT_CODE_LINE_OFFSET, 2)).toBe(2);
  });
});
