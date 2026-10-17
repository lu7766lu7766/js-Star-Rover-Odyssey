import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLevelStore, hintUnlockFails } from '../src/stores/levelStore.js';
import { useProgressStore } from '../src/stores/progressStore.js';
import { validateSaveData, DEFAULT_SAVE_DATA } from '../src/utils/storage.js';
import { makePassCode, verifyPassCode } from '../src/utils/passCode.js';

const mockStorage = {};
globalThis.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

describe('存檔：星數、船名、錯誤圖鑑', () => {
  it('舊存檔沒有新欄位時補上預設值', () => {
    const res = validateSaveData({ version: 2, unlockedLevels: [1], completedLevels: [] });
    expect(res.data.levelStars).toEqual({});
    expect(res.data.roverName).toBe('');
    expect(res.data.errorDex).toEqual({});
  });

  it('過濾不合法的星數與錯誤類型', () => {
    const res = validateSaveData({
      ...DEFAULT_SAVE_DATA,
      levelStars: { 1: 3, 2: 9, 999: 2, 3: 'x' },
      roverName: '  奧德賽號  ',
      errorDex: { fullwidth: 2, 'BAD KEY': 1, logic: -1 }
    });
    expect(res.data.levelStars).toEqual({ 1: 3 });
    expect(res.data.roverName).toBe('奧德賽號');
    expect(res.data.errorDex).toEqual({ fullwidth: 2 });
  });
});

describe('進度 store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    globalThis.localStorage.clear();
  });

  it('只保留每關最高星數', () => {
    const progress = useProgressStore();
    progress.markLevelCompleted(1, 2);
    progress.markLevelCompleted(1, 1);
    expect(progress.getLevelStars(1)).toBe(2);
    progress.markLevelCompleted(1, 3);
    expect(progress.getLevelStars(1)).toBe(3);
    expect(progress.totalStars).toBe(3);
  });

  it('錯誤圖鑑累計次數', () => {
    const progress = useProgressStore();
    progress.recordError('fullwidth');
    progress.recordError('fullwidth');
    expect(progress.errorDex.fullwidth).toBe(2);
  });
});

describe('關卡 store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    globalThis.localStorage.clear();
    vi.useFakeTimers();
  });

  it('提示依失敗次數逐步解鎖：0、2、3 次', () => {
    expect([0, 1, 2].map(hintUnlockFails)).toEqual([0, 2, 3]);
    const levelStore = useLevelStore();
    useProgressStore().goToLevel(1);
    expect(levelStore.unlockedHintCount).toBe(1);
    levelStore.failCount = 2;
    expect(levelStore.unlockedHintCount).toBe(2);
    levelStore.failCount = 3;
    expect(levelStore.unlockedHintCount).toBe(3);
  });

  it('還有 ___ 沒填時不送進沙箱，直接回報行號與錯誤圖鑑', async () => {
    const levelStore = useLevelStore();
    const progress = useProgressStore();
    progress.goToLevel(1);
    const promise = levelStore.executeLevel({ code: 'let roverName = ___;\nrover.setup(roverName, 90, true);' });
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res.errorInfo).toMatchObject({ type: 'blank', line: 1 });
    expect(levelStore.failCount).toBe(1);
    expect(progress.errorDex.blank).toBe(1);
  });

  it('全形符號會被預先攔下並可一鍵修正', async () => {
    const levelStore = useLevelStore();
    useProgressStore().goToLevel(1);
    const promise = levelStore.executeLevel({ code: 'let roverName = "a"；' });
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res.errorInfo).toMatchObject({ type: 'fullwidth', line: 1, fixable: true });
  });

  it('切換關卡會清掉上一關的結果、彈窗與失敗次數', () => {
    const levelStore = useLevelStore();
    levelStore.lastRunResult = { pass: false, error: 'x' };
    levelStore.isFailModalOpen = true;
    levelStore.failCount = 3;
    levelStore.enterLevel();
    expect(levelStore.lastRunResult).toBe(null);
    expect(levelStore.isFailModalOpen).toBe(false);
    expect(levelStore.failCount).toBe(0);
  });

  it('驗證沒過時帶出卡在第幾項要求', async () => {
    const levelStore = useLevelStore();
    useProgressStore().goToLevel(1);
    // 不帶 code：直接用 apiCalls 走驗證，不需要 Worker
    const promise = levelStore.executeLevel({
      apiCalls: [{ api: 'rover.setup', args: ['奧德賽號', 50, true] }]
    });
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res.pass).toBe(false);
    expect(res.errorInfo).toMatchObject({ type: 'logic', reqIndex: 1 });
  });
});

describe('通關碼', () => {
  it('同船名同關卡可驗證，換船名就失效', () => {
    const code = makePassCode(5, 3, '奧德賽號');
    expect(code).toMatch(/^05-3-[0-9A-Z]{4}$/);
    expect(verifyPassCode(code, '奧德賽號')).toEqual({ valid: true, levelNumber: 5, stars: 3 });
    expect(verifyPassCode(code, '星馳號').valid).toBe(false);
    expect(verifyPassCode('05-2-' + code.slice(-4), '奧德賽號').valid).toBe(false);
    expect(verifyPassCode('亂打', '奧德賽號').valid).toBe(false);
  });
});

describe('按下執行', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    globalThis.localStorage.clear();
    vi.useFakeTimers();
  });

  it('直接執行並回傳結果，不會先停下來', async () => {
    const levelStore = useLevelStore();
    const progress = useProgressStore();
    progress.goToLevel(1);
    levelStore.enterLevel();
    const promise = levelStore.requestRun({ code: 'let roverName = ___;' });
    expect(promise).not.toBe(null);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.pass).toBe(false);
    expect(levelStore.lastRunResult).toEqual(result);
  });
});
