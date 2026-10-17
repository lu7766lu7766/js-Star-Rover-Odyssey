import { describe, it, expect } from 'vitest';
import { validateSaveData, DEFAULT_SAVE_DATA } from '../src/utils/storage.js';

describe('Storage & Save Validation', () => {
  it('validates default save data correctly', () => {
    const res = validateSaveData(DEFAULT_SAVE_DATA);
    expect(res.valid).toBe(true);
    expect(res.data.version).toBe(2);
    expect(res.data.unlockedLevels).toContain(1);
  });

  it('supports version 1 backwards compatibility and upgrades to version 2', () => {
    const v1Data = {
      version: 1,
      currentLevel: 1,
      unlockedLevels: [1],
      completedLevels: [],
      savedCode: { '1': 'engine.start();' }
    };
    const res = validateSaveData(v1Data);
    expect(res.valid).toBe(true);
    expect(res.data.version).toBe(2);
    expect(res.data.savedOperations['1']).toBe('engine.start();');
  });

  it('rejects save data with unsupported version', () => {
    const res = validateSaveData({ ...DEFAULT_SAVE_DATA, version: 99 });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('不支援的存檔版本');
  });

  it('rejects corrupt non-object data', () => {
    expect(validateSaveData(null).valid).toBe(false);
    expect(validateSaveData('malicious payload').valid).toBe(false);
  });

  it('sanitizes and supports all 8 levels in unlocked and completed lists', () => {
    const res = validateSaveData({
      version: 2,
      currentLevel: 8,
      unlockedLevels: [1, 2, 3, 4, 5, 6, 7, 8, 999],
      completedLevels: [1, 2, 3, 4, 5, 6, 7],
      savedOperations: { '8': { stationId: 'station-tpe' } }
    });
    expect(res.valid).toBe(true);
    expect(res.data.unlockedLevels).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // 999 filtered out
    expect(res.data.currentLevel).toBe(8);
  });
});

describe('預設存檔', async () => {
  const { loadSaveData } = await import('../src/utils/storage.js');

  it('每次載入都是獨立的一份，修改不會影響預設值', () => {
    globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
    const a = loadSaveData();
    a.unlockedLevels.push(2);
    a.levelStars[1] = 3;
    const b = loadSaveData();
    expect(b.unlockedLevels).toEqual([1]);
    expect(b.levelStars).toEqual({});
    expect(DEFAULT_SAVE_DATA.unlockedLevels).toEqual([1]);
  });
});
