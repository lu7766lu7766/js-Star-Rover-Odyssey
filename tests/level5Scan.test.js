import { describe, it, expect } from 'vitest';
import level5, { LEVEL_5_STARTER_CODE } from '../src/levels/level-5.js';
import { createGameApi, runStudentCode, createTraceRecorder } from '../src/sandbox/gameApi.js';
import { instrumentForTrace } from '../src/utils/codeTracer.js';
import { TRACE_FN, SAFE_GET_FN } from '../src/sandbox/protocol.js';
import { evaluatePulse, VISIBLE_PLANETS, scanAnimationPlan, MAX_ANIMATION_SECONDS } from '../src/game/sim/scanner.js';
import { buildTraceSchedule } from '../src/stores/levelStore.js';
import { Level5Scene } from '../src/game/scenes/Level5Scene.js';
import * as THREE from 'three';
import { translateError } from '../src/utils/errorTranslator.js';

/** 照 worker 的流程跑學生程式：真跑 scanner.pulse，程式結束後拿 scanPlanet 去掃隱藏星系 */
function runL5(code) {
  const calls = [];
  const hooks = {};
  const api = createGameApi({ calls, hooks });
  runStudentCode(code, { ...api, console: { log() {} } }, {
    probe: {
      names: ['scanPlanet'],
      callback: ({ scanPlanet }) => {
        if (scanPlanet) hooks.runHiddenScanSurvey(scanPlanet);
      }
    }
  });
  return { calls, result: level5.validate({ apiCalls: calls, code }) };
}

/** 把起始程式碼的空格依序填好（answers 少給的就維持 ___） */
function fill(answers) {
  let i = 0;
  return LEVEL_5_STARTER_CODE.replace(/___/g, () => answers[i++] ?? '___');
}

const SOLUTION = fill(['planet.distance', '"HIGH"', 'planetB', 'scanPlanet(planetC)', 'reportC.coords']);

/** 跑起來會丟錯的寫法：回傳翻譯後的錯誤 */
function runError(code) {
  try {
    runL5(code);
  } catch (e) {
    return translateError({ message: e.message, name: e.name, code });
  }
  throw new Error('expected the code to throw');
}

describe('第 5 號關卡：深空普查', () => {
  it('掃描規則：半徑要剛好蓋到、遠的星要 HIGH', () => {
    const a = VISIBLE_PLANETS[0]; // 8
    expect(evaluatePulse({ target: a.name, range: 10, mode: 'NORMAL' }, VISIBLE_PLANETS).status).toBe('OK');
    expect(evaluatePulse({ target: a.name, range: 7, mode: 'NORMAL' }, VISIBLE_PLANETS).status).toBe('TOO_SHORT');
    expect(evaluatePulse({ target: a.name, range: 12, mode: 'NORMAL' }, VISIBLE_PLANETS).status).toBe('OVERHEAT');
    expect(evaluatePulse({ target: a.name, range: 10, mode: 'HIGH' }, VISIBLE_PLANETS).status).toBe('OVEREXPOSED');
    expect(evaluatePulse({ target: 'Kepler-C', range: 23, mode: 'NORMAL' }, VISIBLE_PLANETS).status).toBe('LOW_RES');
    expect(evaluatePulse({ target: a.name, range: NaN, mode: 'NORMAL' }, VISIBLE_PLANETS).status).toBe('BAD_RANGE');
    expect(evaluatePulse({ target: 'Nope', range: 10, mode: 'NORMAL' }, VISIBLE_PLANETS).status).toBe('NO_TARGET');
  });

  it('範例解答通關（3 星），隱藏星系也全部掃到', () => {
    const { calls, result } = runL5(level5.jsCodeExample);
    expect(result.pass).toBe(true);
    expect(result.data.stars).toBe(3);
    // 隱藏星系的脈衝不會混進 apiCalls（3D 只播三發）
    expect(calls.filter((c) => c.api === 'scanner.pulse')).toHaveLength(3);
    const survey = calls.find((c) => c.api === 'scanner.hiddenSurvey');
    expect(survey.systems.every((s) => s.planets.every((p) => p.ok))).toBe(true);
  });

  it('填好起始程式碼就能通關；沒 console.log 報告是 2 星', () => {
    const { result } = runL5(SOLUTION);
    expect(result.pass).toBe(true);
    expect(result.data.stars).toBe(2);
    expect(result.feedback).toContain('console.log');
  });

  it('range 寫死：第一顆星就過熱', () => {
    const { result } = runL5(SOLUTION.replace('planet.distance + 2', '23'));
    expect(result.pass).toBe(false);
    expect(result.reqIndex).toBe(0);
    expect(result.error).toContain('過熱');
  });

  it('函式裡寫 planetA.distance：B 星掃不到', () => {
    const { result } = runL5(fill(['planetA.distance', '"HIGH"', 'planetB', 'scanPlanet(planetC)', 'reportC.coords']));
    expect(result.pass).toBe(false);
    expect(result.reqIndex).toBe(0);
    expect(result.error).toContain('Kepler-B');
    expect(result.error).toContain('planet.distance');
  });

  it('屬性名稱拼錯變成 NaN：提示拼字', () => {
    const { result } = runL5(SOLUTION.replace('planet.distance + 2', 'planet.distanse + 2'));
    expect(result.pass).toBe(false);
    expect(result.error).toContain('NaN');
  });

  it('遠的星沒切 HIGH：卡在解析度', () => {
    const { result } = runL5(fill(['planet.distance', '"NORMAL"', 'planetB', 'scanPlanet(planetC)', 'reportC.coords']));
    expect(result.pass).toBe(false);
    expect(result.reqIndex).toBe(1);
    expect(result.error).toContain('"HIGH"');
  });

  it('B 星沒掃到：要呼叫 scanPlanet(planetB)', () => {
    const { result } = runL5(fill(['planet.distance', '"HIGH"', 'planetA', 'scanPlanet(planetC)', 'reportC.coords']));
    expect(result.pass).toBe(false);
    expect(result.reqIndex).toBe(2);
    expect(result.error).toContain('scanPlanet(planetB)');
  });

  it('flyTo 收到整份報告或別顆星的座標', () => {
    const whole = runL5(fill(['planet.distance', '"HIGH"', 'planetB', 'scanPlanet(planetC)', 'reportC'])).result;
    expect(whole.reqIndex).toBe(3);
    expect(whole.error).toContain('整份報告');

    const wrong = runL5(fill(['planet.distance', '"HIGH"', 'planetB', 'scanPlanet(planetC)', 'reportA.coords'])).result;
    expect(wrong.reqIndex).toBe(3);
    expect(wrong.error).toContain('Kepler-A 的座標');
  });

  it('只對 Kepler 三顆星有效的寫法：過不了隱藏星系', () => {
    const hack = SOLUTION.replace(
      'planet.distance + 2',
      'planet.name === "Kepler-A" ? 10 : planet.name === "Kepler-B" ? 16 : 23'
    );
    const { result } = runL5(hack);
    expect(result.pass).toBe(false);
    expect(result.reqIndex).toBe(4);
    expect(result.error).toContain('隱藏星系');
  });

  it('函式改名：找不到 scanPlanet', () => {
    const renamed = SOLUTION.replace(/scanPlanet/g, 'scan');
    const { result } = runL5(renamed);
    expect(result.pass).toBe(false);
    expect(result.reqIndex).toBe(4);
    expect(result.error).toContain('scanPlanet');
  });

  it('錯誤翻譯：屬性單獨使用、忘了傳參數、忘了 return', () => {
    const bare = runError(SOLUTION.replace('planet.distance + 2', 'distance + 2'));
    expect(bare.title).toContain('屬性');
    expect(bare.explain).toContain('planet.distance');

    const noArg = runError(SOLUTION.replace('scanPlanet(planetB)', 'scanPlanet()'));
    expect(noArg.title).toContain('planet');
    expect(noArg.explain).toContain('scanPlanet');

    const noReturn = runError(SOLUTION.replace('return scanner.pulse(params);', 'scanner.pulse(params);'));
    expect(noReturn.title).toContain('reportC');
    expect(noReturn.explain).toContain('return');
  });

  it('逐行追蹤插樁後一樣能考隱藏星系，而且隱藏星系的步驟不會進重播', () => {
    const run = (withProbe) => {
      const calls = [];
      const hooks = {};
      const api = createGameApi({ calls, hooks });
      const tracer = createTraceRecorder({ calls, hiddenValues: Object.values(api) });
      const inst = instrumentForTrace(SOLUTION);
      runStudentCode(inst.code, { ...api, [TRACE_FN]: tracer.hook, [SAFE_GET_FN]: tracer.safeGet }, {
        probe: withProbe ? {
          names: ['scanPlanet'],
          callback: ({ scanPlanet }) => {
            tracer.setPaused(true);
            try {
              hooks.runHiddenScanSurvey(scanPlanet);
            } finally {
              tracer.setPaused(false);
            }
          }
        } : undefined
      });
      return { calls, steps: tracer.steps.length };
    };
    const withProbe = run(true);
    const without = run(false);
    expect(withProbe.calls.some((c) => c.api === 'scanner.hiddenSurvey')).toBe(true);
    expect(withProbe.steps).toBe(without.steps);
    expect(level5.validate({ apiCalls: withProbe.calls, code: SOLUTION }).pass).toBe(true);
  });

  it('scanPlanet 裡呼叫 rover.flyTo：隱藏星系考驗不會留下飛行紀錄', () => {
    const code = SOLUTION.replace(
      'return scanner.pulse(params);',
      'const report = scanner.pulse(params);\n  rover.flyTo(report.coords);\n  return report;'
    );
    const { calls, result } = runL5(code);
    expect(result.pass).toBe(true);
    // 3 次函式內 + 1 次最後的 flyTo，全部來自訓練星系
    expect(calls.filter((c) => c.api === 'rover.flyTo')).toHaveLength(4);
  });

  it('隱藏星系裡 throw 非 Error 的值：照樣回報是哪顆星失敗', () => {
    const code = SOLUTION.replace('const params = {', 'if (planet.name === "Vega-1") { throw null; }\n  const params = {');
    const { result } = runL5(code);
    expect(result.pass).toBe(false);
    expect(result.reqIndex).toBe(4);
    expect(result.error).toContain('Vega-1');
  });

  it('不寫分號時，console.log 後面幾行的 report 不算看過報告', () => {
    const code = SOLUTION.replace(/;$/gm, '').replace('const reportA', 'console.log(planetA)\nconst reportA');
    const { result } = runL5(code);
    expect(result.pass).toBe(true);
    expect(result.data.stars).toBe(2);
  });

  it('錯誤翻譯：不會建議讀不存在的屬性；函式表達式也認得參數', () => {
    const wrongProp = runError(SOLUTION.replace('planet.distance + 2', 'range + 2'));
    expect(wrongProp.explain).not.toContain('planet.range');

    const fnExpr = SOLUTION
      .replace('function scanPlanet(planet) {', 'const scanPlanet = function (planet) {')
      .replace(/^}$/m, '};')
      .replace('scanPlanet(planetB)', 'scanPlanet()');
    const noArg = runError(fnExpr);
    expect(noArg.title).toContain('planet');
    expect(noArg.explain).toContain('scanPlanet');
  });

  it('呼叫很多次時動畫加速，總長不超過上限；逐行重播照每個動作的開始時間', () => {
    const many = Array.from({ length: 20 }, () => ({ api: 'scanner.pulse' }));
    const plan = scanAnimationPlan(many);
    expect(plan.totalMs).toBeCloseTo(MAX_ANIMATION_SECONDS * 1000);
    expect(plan.speed).toBeGreaterThan(1);

    const mixed = scanAnimationPlan([{ api: 'scanner.pulse' }, { api: 'rover.flyTo' }, { api: 'scanner.pulse' }]);
    expect(mixed.startsMs).toEqual([0, 1000, 2800, 3800]);
    const steps = [{ calls: 0 }, { calls: 1 }, { calls: 2 }, { calls: 3 }];
    expect(buildTraceSchedule(steps, { actionStartsMs: mixed.startsMs, intervalMs: 300 })).toEqual([0, 1000, 2800, 3800]);
  });

  it('離開關卡時還原共用的預設視角', () => {
    const cameraController = {
      defaultCamPos: new THREE.Vector3(0, 5, 10),
      defaultTarget: new THREE.Vector3(0, 1, 0),
      reset() {}
    };
    const scene = new Level5Scene();
    scene.init({ cameraController });
    expect(cameraController.defaultCamPos.y).toBe(22);
    scene.dispose();
    expect(cameraController.defaultCamPos.toArray()).toEqual([0, 5, 10]);
    expect(cameraController.defaultTarget.toArray()).toEqual([0, 1, 0]);
  });
});
