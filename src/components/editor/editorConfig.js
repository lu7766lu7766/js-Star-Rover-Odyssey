/**
 * Star Rover Odyssey - CodeMirror 6 Configuration & Level Autocompletions
 */

import { autocompletion } from '@codemirror/autocomplete';

/**
 * Custom level-specific completions for high school students
 */
export function createLevelCompletions(levelId) {
  const commonCompletions = [
    { label: 'console.log', type: 'function', detail: '(data) 印出除錯訊息', apply: 'console.log();' },
    { label: 'let', type: 'keyword', detail: '宣告變數' },
    { label: 'const', type: 'keyword', detail: '宣告常數' },
    { label: 'for', type: 'keyword', detail: '迴圈控制', apply: 'for (let i = 0; i < 5; i++) {\n  \n}' },
    { label: 'if', type: 'keyword', detail: '條件判斷', apply: 'if () {\n  \n}' }
  ];

  const levelSpecific = {
    1: [
      { label: 'rover.setup', type: 'function', detail: '(name, battery, isActive) 探測船通電開機', apply: 'rover.setup(shipName, battery, isActive);' }
    ],
    2: [
      { label: 'rover.launch', type: 'function', detail: '(remainingFuel) 推進發射', apply: 'rover.launch(remainingFuel);' },
      { label: 'rover.approachStation', type: 'function', detail: '({distance, speed, remainingFuel}) 軌道轉移進站', apply: 'rover.approachStation({ distance, speed, remainingFuel });' }
    ],
    3: [
      { label: 'rover.setAutoPilot', type: 'function', detail: '(callback) 註冊避障邏輯函式', apply: 'rover.setAutoPilot(autoPilot);' },
      { label: 'distance', type: 'variable', detail: '雷達探測之障礙物距離' },
      { label: '"STOP"', type: 'constant', detail: '煞車停止' },
      { label: '"SLOW_DOWN"', type: 'constant', detail: '減速通過' },
      { label: '"FULL_SPEED"', type: 'constant', detail: '全速前進' }
    ],
    4: [
      { label: 'rover.moveForward', type: 'function', detail: '() 前進 1 格', apply: 'rover.moveForward();' },
      { label: 'rover.moveBackward', type: 'function', detail: '() 後退 1 格', apply: 'rover.moveBackward();' },
      { label: 'rover.turnLeft', type: 'function', detail: '() 左轉 90°', apply: 'rover.turnLeft();' },
      { label: 'rover.turnRight', type: 'function', detail: '() 右轉 90°', apply: 'rover.turnRight();' }
    ],
    5: [
      { label: 'rover.installModule', type: 'function', detail: '(moduleObject) 安裝科技模組', apply: 'rover.installModule(scanModule);' },
      { label: 'this.range', type: 'property', detail: '存取模組掃描半徑' }
    ],
    6: [
      { label: 'document.getElementById', type: 'function', detail: '(id) 取得指定 DOM 元素', apply: 'document.getElementById("");' },
      { label: 'addEventListener', type: 'method', detail: '("click", callback) 綁定事件監聽器', apply: 'addEventListener("click", function() {\n  \n});' },
      { label: 'innerText', type: 'property', detail: '設定或讀取元素文字內容' },
      { label: 'style.color', type: 'property', detail: '設定元素文字顏色' }
    ],
    7: [
      { label: 'drones', type: 'variable', detail: 'Array<Drone> 無人機遙測資料陣列' },
      { label: 'droneFleet.deploy', type: 'function', detail: '(drones) 部署無人機編隊', apply: 'droneFleet.deploy(drones);' },
      { label: 'drone.battery', type: 'property', detail: '無人機電量百分比 (number)' },
      { label: 'drone.order', type: 'property', detail: '"RETURN_BASE" | "PATROL"（英文，加引號）' },
      { label: 'drone.status', type: 'property', detail: '舊寫法，同 order（"RETURN_BASE" | "PATROL"）' },
      { label: '"RETURN_BASE"', type: 'constant', detail: '低電量：返航充電', apply: '"RETURN_BASE"' },
      { label: '"PATROL"', type: 'constant', detail: '高電量：空域巡邏', apply: '"PATROL"' }
    ],
    8: [
      { label: 'fetchStation', type: 'function', detail: '(id) 取回觀測站氣象 JSON', apply: 'fetchStation("station-tpe");' },
      { label: 'drone.launch', type: 'function', detail: '(id) 派遣無人機升空', apply: 'drone.launch(stationId);' },
      { label: 'drone.abortMission', type: 'function', detail: '() 中止發射任務', apply: 'drone.abortMission();' }
    ],
    9: [
      { label: 'runner.setAutoRun', type: 'function', detail: '(callback) 註冊跑酷決策函式', apply: 'runner.setAutoRun(decide);' },
      { label: 'ahead', type: 'variable', detail: '前方一格地形: "gap"|"low"|"high"|"ground"' },
      { label: '"jump"', type: 'constant', detail: '動作：跳過斷崖或矮欄', apply: '"jump"' },
      { label: '"slide"', type: 'constant', detail: '動作：滑過高空橫桿', apply: '"slide"' },
      { label: '"run"', type: 'constant', detail: '動作：平地與終點前進', apply: '"run"' },
      { label: '"gap"', type: 'constant', detail: '地形：斷崖缺口', apply: '"gap"' },
      { label: '"low"', type: 'constant', detail: '地形：低矮能量欄', apply: '"low"' },
      { label: '"high"', type: 'constant', detail: '地形：高空橫桿', apply: '"high"' },
      { label: '"ground"', type: 'constant', detail: '地形：平坦地面', apply: '"ground"' }
    ]
  };

  const currentLevelOptions = levelSpecific[levelId] || [];

  return autocompletion({
    override: [
      (context) => {
        const word = context.matchBefore(/[\w.]*/);
        if (!word || (word.from === word.to && !context.explicit)) return null;

        return {
          from: word.from,
          options: [...currentLevelOptions, ...commonCompletions]
        };
      }
    ]
  });
}
