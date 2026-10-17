/**
 * Star Rover Odyssey - Worker Message Protocol
 */

export const MSG_TYPE = {
  // Main -> Worker
  EXECUTE: 'EXECUTE',
  TRIGGER_EVENT: 'TRIGGER_EVENT',
  GET_SNAPSHOT: 'GET_SNAPSHOT',

  // Worker -> Main
  CONSOLE_LOG: 'CONSOLE_LOG',
  DOM_MUTATION: 'DOM_MUTATION',
  DOM_SNAPSHOT: 'DOM_SNAPSHOT',
  GAME_API_CALL: 'GAME_API_CALL',
  EXECUTION_SUCCESS: 'EXECUTION_SUCCESS',
  EXECUTION_ERROR: 'EXECUTION_ERROR'
};

/** 逐行追蹤：插樁後的學生程式碼會呼叫的兩個全域名稱（見 utils/codeTracer.js） */
export const TRACE_FN = '__srT';
export const SAFE_GET_FN = '__srV';
