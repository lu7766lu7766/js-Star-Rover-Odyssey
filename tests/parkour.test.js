import { describe, it, expect } from 'vitest';
import level9, { LEVEL_9_STARTER_CODE } from '../src/levels/level-9.js';
import {
  PARKOUR_COURSES,
  runCourse,
  judgeStep,
  describeFailure,
  FAIL_REASON,
  TILE,
  ACTION
} from '../src/game/sim/parkour.js';
import {
  stripComments,
  stripCommentsAndStrings,
  countInCode,
  codeMatches,
  findUnfilledBlank
} from '../src/utils/codeAnalysis.js';
import { createGameApi, runStudentCode } from '../src/sandbox/gameApi.js';

describe('Parkour Simulation Engine (src/game/sim/parkour.js)', () => {
  it('correctly judges single step outcomes', () => {
    // Gap requires JUMP
    expect(judgeStep(TILE.GAP, ACTION.JUMP)).toBeNull();
    expect(judgeStep(TILE.GAP, ACTION.RUN)).toBe(FAIL_REASON.FALL);
    expect(judgeStep(TILE.GAP, ACTION.SLIDE)).toBe(FAIL_REASON.FALL);

    // Low barrier requires JUMP
    expect(judgeStep(TILE.LOW, ACTION.JUMP)).toBeNull();
    expect(judgeStep(TILE.LOW, ACTION.RUN)).toBe(FAIL_REASON.TRIP);
    expect(judgeStep(TILE.LOW, ACTION.SLIDE)).toBe(FAIL_REASON.TRIP);

    // High hurdle requires SLIDE
    expect(judgeStep(TILE.HIGH, ACTION.SLIDE)).toBeNull();
    expect(judgeStep(TILE.HIGH, ACTION.RUN)).toBe(FAIL_REASON.HIT);
    expect(judgeStep(TILE.HIGH, ACTION.JUMP)).toBe(FAIL_REASON.HIT);

    // Ground requires RUN
    expect(judgeStep(TILE.GROUND, ACTION.RUN)).toBeNull();
    expect(judgeStep(TILE.GROUND, ACTION.JUMP)).toBe(FAIL_REASON.WASTED);
    expect(judgeStep(TILE.GROUND, ACTION.SLIDE)).toBe(FAIL_REASON.WASTED);
  });

  it('runs course with correct decide logic and finishes successfully', () => {
    const perfectDecide = (ahead) => {
      if (ahead === 'gap' || ahead === 'low') return 'jump';
      if (ahead === 'high') return 'slide';
      return 'run';
    };

    const res = runCourse(PARKOUR_COURSES[0].tiles, perfectDecide);
    expect(res.finished).toBe(true);
    expect(res.fail).toBeNull();
    expect(res.frames.length).toBe(PARKOUR_COURSES[0].tiles.length - 1);
  });

  it('captures failures and produces detailed diagnostics', () => {
    // Always runs -> will fall into the first gap
    const runnerFail = (ahead) => 'run';
    const res = runCourse(PARKOUR_COURSES[0].tiles, runnerFail);
    expect(res.finished).toBe(false);
    expect(res.fail).not.toBeNull();
    expect(res.fail.reason).toBe(FAIL_REASON.FALL);

    const desc = describeFailure(res.fail);
    expect(desc).toContain('缺口要用 \'jump\' 跳過去');
  });

  it('safely handles exceptions thrown inside student decide function', () => {
    const buggyDecide = () => {
      throw new Error('故意拋出異常');
    };
    const res = runCourse(PARKOUR_COURSES[0].tiles, buggyDecide);
    expect(res.finished).toBe(false);
    expect(res.fail.reason).toBe(FAIL_REASON.ERROR);
    expect(res.error).toContain('故意拋出異常');
  });
});

describe('Level 9 Validation & Anti-Cheating (src/levels/level-9.js)', () => {
  function runDecideThroughApi(decideFn, codeStr = '') {
    const calls = [];
    const api = createGameApi({ calls });
    api.runner.setAutoRun(decideFn);
    return level9.validate({ apiCalls: calls, code: codeStr });
  }

  it('fails when runner.setAutoRun is not registered', () => {
    const res = level9.validate({ apiCalls: [], code: '' });
    expect(res.pass).toBe(false);
    expect(res.error).toContain('沒有偵測到 runner.setAutoRun');
  });

  it('rejects hard-coded decision that only passes Course A but fails hidden courses', () => {
    // Course A tiles: ground ground gap ground low ground high ground gap low high ground ground finish
    // An overfitted sequence of answers hard-coded for Course A steps
    let step = 0;
    const overfittedCourseA = () => {
      step++;
      // Exact answers for Course A
      const answers = ['run', 'jump', 'run', 'jump', 'run', 'slide', 'run', 'jump', 'jump', 'slide', 'run', 'run'];
      return answers[step - 1] || 'run';
    };

    const res = runDecideThroughApi(overfittedCourseA, 'runner.setAutoRun(...)');
    expect(res.pass).toBe(false);
    expect(res.error).toContain('隱藏');
  });

  it('passes all 4 courses with generalized logic and awards 3 stars for || and console.log', () => {
    const perfectDecide = (ahead) => {
      console.log('Ahead:', ahead);
      if (ahead === 'gap' || ahead === 'low') return 'jump';
      if (ahead === 'high') return 'slide';
      return 'run';
    };

    const codeStr = `
      function decide(ahead) {
        console.log(ahead);
        if (ahead === 'gap' || ahead === 'low') {
          return 'jump';
        } else if (ahead === 'high') {
          return 'slide';
        } else {
          return 'run';
        }
      }
      runner.setAutoRun(decide);
    `;

    const res = runDecideThroughApi(perfectDecide, codeStr);
    expect(res.pass).toBe(true);
    expect(res.data.stars).toBe(3);
    expect(res.data.coursesPassed).toBe(4);
    expect(res.feedback).toContain('跑酷成功');
  });

  it('starter code does not pass without modification', () => {
    // Missing runner.setAutoRun call with valid function
    expect(level9.validate({ apiCalls: [] }).pass).toBe(false);
  });
});

describe('Code Analysis Utilities (src/utils/codeAnalysis.js)', () => {
  it('strips comments while preserving code structure and line breaks', () => {
    const code = `// line comment\nconst x = 1; /* block comment */\nconst y = 2;`;
    const stripped = stripComments(code);
    expect(stripped).not.toContain('line comment');
    expect(stripped).not.toContain('block comment');
    expect(stripped).toContain('const x = 1;');
    expect(stripped.split('\n').length).toBe(3);
  });

  it('strips comments and string contents so comments do not fake loop counts', () => {
    const trickyCode = `
      // for (let i = 0; i < 99; i++) {}
      /* for (let j = 0; j < 99; j++) {} */
      const msg = "for (let k = 0; k < 99; k++)";
      for (let real = 0; real < 3; real++) {}
    `;
    const count = countInCode(trickyCode, /\bfor\s*\(/);
    expect(count).toBe(1); // Only the 1 real for loop counted!
  });

  it('detects unfilled blank ___ with accurate line numbers', () => {
    const unfilled = `function test() {\n  return ___;\n}`;
    const detected = findUnfilledBlank(unfilled);
    expect(detected).not.toBeNull();
    expect(detected.line).toBe(2);
    expect(detected.text).toContain('___');

    const filled = `function test() {\n  return 'jump';\n}`;
    expect(findUnfilledBlank(filled)).toBeNull();
  });
});

describe('Sandbox Game API & Security Sandbox (src/sandbox/gameApi.js)', () => {
  it('registers all simple APIs and records invocations', () => {
    const calls = [];
    const api = createGameApi({ calls });
    api.rover.moveForward();
    api.rover.turnRight();
    api.drill.dig(5);
    expect(calls.length).toBe(3);
    expect(calls[0].api).toBe('rover.moveForward');
    expect(calls[1].api).toBe('rover.turnRight');
    expect(calls[2].api).toBe('drill.dig');
  });

  it('blocks dangerous globals like window, self, Function, and postMessage from student code', () => {
    const globals = {
      console: { log: () => {} },
      assert: () => {}
    };

    // Attempting to access postMessage should yield undefined
    const res = runStudentCode(`
      return typeof postMessage;
    `, globals);
    expect(res).toBe('undefined');

    const resWindow = runStudentCode(`
      return typeof window;
    `, globals);
    expect(resWindow).toBe('undefined');
  });
});
