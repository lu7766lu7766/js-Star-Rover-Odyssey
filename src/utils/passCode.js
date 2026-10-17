/**
 * Star Rover Odyssey - 通關碼
 *
 * 通關時依「關卡編號 + 星數 + 船名」算出一組短碼（例如 05-3-K7QF），
 * 老師巡堂時看一眼就能登記；在教師密令視窗輸入船名與通關碼即可驗證真偽。
 * 這不是密碼學等級的防偽，只是讓「抄同學的碼」行不通（船名不同，碼就不同）。
 */

const SALT = 'star-rover-odyssey';

function hash4(text) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).toUpperCase().padStart(4, '0').slice(-4);
}

function normalizeName(name) {
  return String(name || '').trim();
}

/**
 * @param {number} levelNumber 課程順序中的關卡編號（1 起算）
 * @param {number} stars 1~3
 * @param {string} roverName 第 1 關取的船名
 */
export function makePassCode(levelNumber, stars, roverName) {
  const lv = String(levelNumber).padStart(2, '0');
  return `${lv}-${stars}-${hash4(`${SALT}|${lv}|${stars}|${normalizeName(roverName)}`)}`;
}

/**
 * @returns {{ valid: boolean, levelNumber?: number, stars?: number }}
 */
export function verifyPassCode(code, roverName) {
  const m = String(code || '').trim().toUpperCase().match(/^(\d{1,2})-([1-3])-([0-9A-Z]{4})$/);
  if (!m) return { valid: false };
  const levelNumber = Number(m[1]);
  const stars = Number(m[2]);
  const valid = makePassCode(levelNumber, stars, roverName) === `${String(levelNumber).padStart(2, '0')}-${stars}-${m[3]}`;
  return valid ? { valid, levelNumber, stars } : { valid: false };
}
