/**
 * Star Rover Odyssey - Maze Simulator (pure)
 *
 * L4 迷宮巡航：驗證 (levels/level-4.js) 與 3D 動畫 (Level4Scene.js) 共用同一份模擬，
 * 避免兩邊各寫一份導致改地圖時不一致。
 */

// 0=North(dy=+1), 1=East(dx=+1), 2=South(dy=-1), 3=West(dx=-1)
export const MAZE_DIRS = Object.freeze([
  Object.freeze({ dx: 0, dy: 1, name: '北' }),
  Object.freeze({ dx: 1, dy: 0, name: '東' }),
  Object.freeze({ dx: 0, dy: -1, name: '南' }),
  Object.freeze({ dx: -1, dy: 0, name: '西' })
]);

export const MAZE_ACTION = Object.freeze({
  FORWARD: 'FORWARD',
  BACKWARD: 'BACKWARD',
  TURN_LEFT: 'TURN_LEFT',
  TURN_RIGHT: 'TURN_RIGHT'
});

/** Worker apiCalls 的 api 名稱 → 迷宮動作 */
export const MAZE_API_TO_ACTION = Object.freeze({
  'rover.moveForward': MAZE_ACTION.FORWARD,
  'rover.moveBackward': MAZE_ACTION.BACKWARD,
  'rover.turnLeft': MAZE_ACTION.TURN_LEFT,
  'rover.turnRight': MAZE_ACTION.TURN_RIGHT
});

/** apiCalls trace → 動作陣列（略過非移動類 API） */
export function actionsFromApiCalls(apiCalls = []) {
  return apiCalls.map((c) => MAZE_API_TO_ACTION[c.api]).filter(Boolean);
}

/** loopConfig.blocks → 動作陣列（向後相容積木模式） */
export function actionsFromLoopConfig(loopConfig) {
  const blocks = loopConfig?.blocks || [];
  const actions = [];
  for (const b of blocks) {
    if (b.type === 'LOOP') {
      const count = Math.max(1, Math.min(b.count || 2, 10));
      const act = b.action || 'FORWARD';
      for (let i = 0; i < count; i++) {
        actions.push(act);
      }
    } else if (b.type) {
      actions.push(b.type);
    }
  }
  return actions;
}

/**
 * 模擬一串動作。遇到撞擊或出界即停止（steps 最後一筆帶 collision / outOfBounds）。
 *
 * @param {{ gridSize: {width:number,height:number}, start: {x:number,y:number,dir:number}, target?: {x:number,y:number}, obstacles: Array<{x:number,y:number}> }} map
 * @param {string[]} actions MAZE_ACTION 序列
 * @returns {{
 *   steps: Array<object>,
 *   final: { x: number, y: number, dir: number },
 *   crash: null | { kind: 'OUT_OF_BOUNDS' | 'COLLISION', backward: boolean, stepCount: number, from: {x:number,y:number}, attempted: {x:number,y:number} },
 *   stepCount: number
 * }}
 */
export function simulateMaze(map, actions) {
  let { x, y, dir } = map.start;
  const steps = [];
  let stepCount = 0;
  let crash = null;

  const isObstacle = (cx, cy) => map.obstacles.some((ob) => ob.x === cx && ob.y === cy);
  const inBounds = (cx, cy) => cx >= 0 && cx < map.gridSize.width && cy >= 0 && cy < map.gridSize.height;

  for (const act of actions) {
    stepCount++;

    if (act === MAZE_ACTION.TURN_LEFT || act === MAZE_ACTION.TURN_RIGHT) {
      const toDir = act === MAZE_ACTION.TURN_LEFT ? (dir + 3) % 4 : (dir + 1) % 4;
      steps.push({ type: 'TURN', fromDir: dir, toDir, gx: x, gy: y });
      dir = toDir;
      continue;
    }

    if (act === MAZE_ACTION.FORWARD || act === MAZE_ACTION.BACKWARD) {
      const sign = act === MAZE_ACTION.FORWARD ? 1 : -1;
      const nx = x + sign * MAZE_DIRS[dir].dx;
      const ny = y + sign * MAZE_DIRS[dir].dy;
      const outOfBounds = !inBounds(nx, ny);
      const collision = !outOfBounds && isObstacle(nx, ny);

      steps.push({
        type: 'MOVE',
        fromX: x,
        fromY: y,
        toX: nx,
        toY: ny,
        dir,
        collision,
        outOfBounds
      });

      if (outOfBounds || collision) {
        crash = {
          kind: outOfBounds ? 'OUT_OF_BOUNDS' : 'COLLISION',
          backward: sign < 0,
          stepCount,
          from: { x, y },
          attempted: { x: nx, y: ny }
        };
        // 動畫與驗證都以「撞上那一刻」為終點
        x = nx;
        y = ny;
        break;
      }

      x = nx;
      y = ny;
    }
  }

  return { steps, final: { x, y, dir }, crash, stepCount };
}
