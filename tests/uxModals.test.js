import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLevelStore } from '../src/stores/levelStore.js';
import { useProgressStore } from '../src/stores/progressStore.js';
import { Level2Scene } from '../src/game/scenes/Level2Scene.js';
import { Level1Scene } from '../src/game/scenes/Level1Scene.js';
import { Level3Scene } from '../src/game/scenes/Level3Scene.js';
import { Level4Scene } from '../src/game/scenes/Level4Scene.js';
import { Level5Scene } from '../src/game/scenes/Level5Scene.js';
import { Level8Scene } from '../src/game/scenes/Level8Scene.js';
import { useDomLabStore } from '../src/stores/domLabStore.js';

const mockStorage = {};
globalThis.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

describe('Star Rover Odyssey 2.0 - Failure Alert Modal & Vehicle Restore Suite', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    globalThis.localStorage.clear();
    vi.useFakeTimers();
  });

  it('LevelStore: opens failure alert modal on level test failure (UX consistency with success modal)', async () => {
    const levelStore = useLevelStore();
    const progressStore = useProgressStore();
    progressStore.goToLevel(1);

    expect(levelStore.isFailModalOpen).toBe(false);
    expect(levelStore.isSuccessModalOpen).toBe(false);

    // Execute with failing parameters (empty name, 0 power)
    const execPromise = levelStore.executeLevel({
      variables: { roverName: '', powerLevel: 0, shieldActive: false }
    });

    // Fast-forward animation & evaluation timer
    await vi.runAllTimersAsync();
    const res = await execPromise;

    expect(res.pass).toBe(false);
    expect(levelStore.isFailModalOpen).toBe(true);
    expect(levelStore.isSuccessModalOpen).toBe(false);

    // Close fail modal
    levelStore.closeFailModal();
    expect(levelStore.isFailModalOpen).toBe(false);
  });

  it('LevelStore: opens success milestone modal on valid level completion', async () => {
    const levelStore = useLevelStore();
    const progressStore = useProgressStore();
    progressStore.goToLevel(1);

    // Execute with passing parameters
    const execPromise = levelStore.executeLevel({
      variables: { roverName: '奧德賽號', powerLevel: 90, shieldActive: true }
    });

    await vi.runAllTimersAsync();
    const res = await execPromise;

    expect(res.pass).toBe(true);
    expect(levelStore.isSuccessModalOpen).toBe(true);
    expect(levelStore.isFailModalOpen).toBe(false);

    levelStore.closeSuccessModal();
    expect(levelStore.isSuccessModalOpen).toBe(false);
  });

  it('LevelStore: Level 6 delays success modal until door opening animation (1.2s) finishes plus 1s (total 2.2s)', () => {
    const levelStore = useLevelStore();
    const progressStore = useProgressStore();
    const domLabStore = useDomLabStore();
    progressStore.isDeveloperMode = true;
    progressStore.goToLevel(6);

    levelStore.l6CodeApproved = true;
    domLabStore.disarmed = true;
    domLabStore.airlockOpen = true;

    levelStore.checkL6ManualCompletion();

    // Immediately: modal should NOT be open yet
    expect(levelStore.isSuccessModalOpen).toBe(false);

    // At 1200ms (door opening animation finishes): modal still not open (waiting 1s more)
    vi.advanceTimersByTime(1200);
    expect(levelStore.isSuccessModalOpen).toBe(false);

    // At 2199ms: modal still not open
    vi.advanceTimersByTime(999);
    expect(levelStore.isSuccessModalOpen).toBe(false);

    // At 2200ms: modal opens!
    vi.advanceTimersByTime(1);
    expect(levelStore.isSuccessModalOpen).toBe(true);
  });

  it('LevelStore: restoreVehiclePosition triggers RESET_POSITION and closes failure modal', async () => {
    const levelStore = useLevelStore();
    const mockTrigger = vi.fn();
    levelStore.setSceneActionTrigger(mockTrigger);

    levelStore.isFailModalOpen = true;
    levelStore.restoreVehiclePosition();

    expect(levelStore.isFailModalOpen).toBe(false);
    expect(mockTrigger).toHaveBeenCalledWith('RESET_POSITION', expect.any(Object));
  });

  it('Level2Scene: properly resets rover position to starting pad (0, 0.1, 0) on RESET_POSITION', () => {
    const scene = new Level2Scene();
    scene.build();

    // Move rover forward down the runway
    scene.rover.position.set(0, 0.1, 15);
    scene.isLaunching = true;
    scene.currentDistance = 15;

    // Dispatch RESET_POSITION
    scene.handleAction('RESET_POSITION');

    expect(scene.rover.position.x).toBe(0);
    expect(scene.rover.position.y).toBeCloseTo(0.1);
    expect(scene.rover.position.z).toBe(0);
    expect(scene.isLaunching).toBe(false);
    expect(scene.currentDistance).toBe(0);
  });

  it('Level2Scene: automatically resets rover to start line before EXECUTE_START', () => {
    const scene = new Level2Scene();
    scene.build();

    // Simulate rover stuck at 18m from a previous run
    scene.rover.position.set(0, 0.1, 18);
    scene.currentDistance = 18;

    // Dispatch new test launch
    scene.handleAction('EXECUTE_START', {
      params: { initialFuel: 150, burnPerThrust: 30, thrustCount: 3, speed: 2 }
    });

    // Must have immediately restored to 0 before advancing
    expect(scene.targetDistance).toBe(6); // 3 * 2 = 6
    expect(scene.currentDistance).toBe(0);
    expect(scene.rover.position.z).toBe(0);
    expect(scene.isLaunching).toBe(true);
  });

  it('Level3Scene: automatically resets rover to start coordinate (0, 0, -12) on retry and RESET_POSITION', () => {
    const scene = new Level3Scene();
    scene.build();

    // Simulate rover stopped at collision/avoidance coordinate
    scene.rover.position.set(0, 0, 2);

    scene.handleAction('RESET_POSITION');
    expect(scene.rover.position.z).toBe(-12);

    // Simulate another run
    scene.rover.position.set(0, 0, 1.5);
    scene.handleAction('EXECUTE_START');
    expect(scene.rover.position.z).toBe(-12);
  });

  it('Level8Scene: properly restores weather probe drone (機器) to launch pad on RESET_SCENE and RESET_POSITION', () => {
    const scene = new Level8Scene();
    scene.build();

    // Simulate probe drone launched into high altitude
    scene.isLaunching = true;
    scene.launchHeight = 25;
    scene.drone.position.y = 25.6;

    // Dispatch RESET_SCENE
    scene.handleAction('RESET_SCENE');

    expect(scene.isLaunching).toBe(false);
    expect(scene.launchHeight).toBe(0);
    expect(scene.drone.position.x).toBe(4);
    expect(scene.drone.position.y).toBeCloseTo(0.6);
    expect(scene.drone.position.z).toBe(0);

    // Simulate retry launch
    scene.isLaunching = true;
    scene.launchHeight = 12;
    scene.drone.position.y = 12.6;

    // Retry should also reset to launch pad
    scene.handleAction('EXECUTE_START');
    expect(scene.isLaunching).toBe(false);
    expect(scene.launchHeight).toBe(0);
    expect(scene.drone.position.y).toBeCloseTo(0.6);
  });

  it('Level4Scene: properly restores maze rover to start pad (1, 0) on RESET_SCENE and RESET_POSITION', () => {    const scene = new Level4Scene();
    scene.build();

    // Start pad world coords: gx=1, gy=0 -> x = (1 - 2.5)*2.4 = -3.6, z = (2.5 - 0)*2.4 = 6.0
    expect(scene.rover.position.x).toBeCloseTo(-3.6);
    expect(scene.rover.position.z).toBeCloseTo(6.0);

    // Simulate rover moved elsewhere
    scene.rover.position.set(2.4, 0.1, -1.2);
    scene.currentGrid = { x: 3, y: 3, dir: 1 };

    scene.handleAction('RESET_SCENE');
    expect(scene.currentGrid.x).toBe(1);
    expect(scene.currentGrid.y).toBe(0);
    expect(scene.rover.position.x).toBeCloseTo(-3.6);
    expect(scene.rover.position.z).toBeCloseTo(6.0);

    // Also verify RESET_POSITION
    scene.rover.position.set(0, 0.1, 0);
    scene.handleAction('RESET_POSITION');
    expect(scene.rover.position.x).toBeCloseTo(-3.6);
    expect(scene.rover.position.z).toBeCloseTo(6.0);
  });

  it('Level4Scene: animates rover from Worker apiCalls trace (code mode EXECUTE_START)', () => {
    const scene = new Level4Scene();
    scene.build();

    // Canonical 2-3-2 solution as Worker apiCalls (levelStore tracePayload shape)
    const toCalls = (actions) => actions.map((a) => ({ api: `rover.${a}`, args: [] }));
    const apiCalls = toCalls([
      'moveForward', 'moveForward',
      'turnRight',
      'moveForward', 'moveForward', 'moveForward',
      'turnLeft',
      'moveForward', 'moveForward'
    ]);

    scene.handleAction('EXECUTE_START', { levelId: 4, payload: { apiCalls, code: 'for...' } });

    // 9 steps total: first shifted to currentStep, rest queued
    expect(scene.isAnimating).toBe(true);
    const totalSteps = scene.animQueue.length + (scene.currentStep ? 1 : 0);
    expect(totalSteps).toBe(9);
    // First step: MOVE (1,0) -> (1,1) heading north
    expect(scene.currentStep.type).toBe('MOVE');
    expect(scene.currentStep.fromX).toBe(1);
    expect(scene.currentStep.fromY).toBe(0);
    expect(scene.currentStep.toX).toBe(1);
    expect(scene.currentStep.toY).toBe(1);
  });

  it('Level4Scene: still animates from loopConfig blocks (blocks mode EXECUTE_START)', () => {    const scene = new Level4Scene();
    scene.build();

    scene.handleAction('EXECUTE_START', {
      levelId: 4,
      payload: {
        loopConfig: {
          blocks: [
            { id: '1', type: 'LOOP', count: 2, action: 'FORWARD' },
            { id: '2', type: 'TURN_RIGHT' },
            { id: '3', type: 'LOOP', count: 3, action: 'FORWARD' },
            { id: '4', type: 'TURN_LEFT' },
            { id: '5', type: 'LOOP', count: 2, action: 'FORWARD' }
          ]
        }
      }
    });

    expect(scene.isAnimating).toBe(true);
    const totalSteps = scene.animQueue.length + (scene.currentStep ? 1 : 0);
    expect(totalSteps).toBe(9);
  });

  it('Level1Scene: diagnoses from Worker setup trace (code mode EXECUTE_START)', () => {
    const scene = new Level1Scene();
    scene.build();

    scene.handleAction('EXECUTE_START', {
      levelId: 1,
      payload: {
        apiCalls: [{ api: 'rover.setup', args: ['星馳號', 90, true] }],
        code: 'let...'
      }
    });

    expect(scene.isDiagnosing).toBe(true);
    expect(scene.targetPower).toBe(90);
    expect(scene.isShieldOn).toBe(true);
  });

  it('Level2Scene: launches toward resolved distance from approachStation trace (code mode)', () => {
    const scene = new Level2Scene();
    scene.build();

    scene.handleAction('EXECUTE_START', {
      levelId: 2,
      payload: {
        apiCalls: [{ api: 'rover.approachStation', args: [{ distance: 24, speed: 3, remainingFuel: 100 }] }],
        code: 'let...'
      }
    });

    expect(scene.isLaunching).toBe(true);
    expect(scene.targetDistance).toBe(24);
    expect(scene.fuelRemaining).toBe(100);
    expect(scene.launchSpeed).toBeCloseTo(9.6);
  });

  it('Level4Scene: nose heading matches grid direction (East/West not swapped)', () => {
    const scene = new Level4Scene();
    // Rover nose points +Z at rotY=0; facing = R_y(angle) applied to (0,0,1)
    const facingOf = (dir) => {
      const a = scene.getHeadingAngle(dir);
      return { x: Math.sin(a), z: Math.cos(a) };
    };
    const close = (v, e) => expect(v).toBeCloseTo(e, 5);

    // 0=North -> world -Z (up-screen)
    let f = facingOf(0);
    close(f.x, 0); close(f.z, -1);
    // 1=East -> world +X (screen-right); right turn from North must face East
    f = facingOf(1);
    close(f.x, 1); close(f.z, 0);
    // 2=South -> world +Z
    f = facingOf(2);
    close(f.x, 0); close(f.z, 1);
    // 3=West -> world -X (screen-left)
    f = facingOf(3);
    close(f.x, -1); close(f.z, 0);
  });

  it('Level5Scene: installs the traced module method instead of defaulting (code mode)', () => {
    const scene = new Level5Scene();
    scene.build();

    scene.handleAction('EXECUTE_START', {
      levelId: 5,
      payload: {
        apiCalls: [{ api: 'rover.installModule', args: [{ name: 'focusScan', range: 20, mode: 'HIGH' }] }],
        code: 'const...'
      }
    });

    expect(scene.isInstalled).toBe(true);
    expect(scene.activeMethod).toBe('focusScan');
    expect(scene.scanRadius).toBe(20);
    expect(scene.scannerDish.visible).toBe(true);
  });
});
