/**
 * Level 4 Scene: 迷宮巡航與迴圈拼圖 (Maze Navigation & Loop Puzzles)
 * 3D 6x6 Sci-Fi Grid Platform with Start Pad, Destination Base, and Crystal Obstacles.
 */

import * as THREE from 'three';
import { BaseGameScene } from './BaseGameScene.js';
import { createSciFiRover, createSciFiGrid, createLandingPad, createTextTexture } from '../models/ProceduralMeshes.js';
import { soundManager } from '../core/SoundManager.js';
import { LEVEL_4_MAP } from '../../levels/level-4.js';
import { simulateMaze, actionsFromApiCalls, actionsFromLoopConfig } from '../sim/maze.js';

const CELL_SIZE = 2.4;

export class Level4Scene extends BaseGameScene {
  constructor() {
    super(4);
    this.rover = null;
    this.startPad = null;
    this.targetBase = null;
    this.obstaclesGroup = null;
    this.gridPlatform = null;

    // Simulation & Animation state
    this.currentGrid = { x: 1, y: 0, dir: 0 };
    this.animQueue = [];
    this.isAnimating = false;
    this.stepTimer = 0;
    this.stepDuration = 0.38;
    this.currentStep = null;
    this.startTransform = { x: 0, z: 0, rotY: 0 };
    this.targetTransform = { x: 0, z: 0, rotY: 0 };
  }

  init(sceneManager) {
    this.sceneManager = sceneManager;
    this.build();
    this.resetCamera();
  }

  resetCamera() {
    if (this.sceneManager && this.sceneManager.cameraController) {
      // Perspective: Elevated angled isometric view overlooking 6x6 grid
      this.sceneManager.cameraController.reset(
        new THREE.Vector3(0, 16.5, 14.5),
        new THREE.Vector3(0, 0, 0)
      );
    }
  }

  gridToWorld(gx, gy) {
    return {
      x: (gx - 2.5) * CELL_SIZE,
      z: (2.5 - gy) * CELL_SIZE
    };
  }

  getHeadingAngle(dir) {
    // Rover model nose (+z at rotY=0) faces +Z=South. R_y(θ) maps +Z to
    // (sinθ, 0, cosθ), so East (+X) needs θ=+PI/2 and West (-X) needs θ=-PI/2.
    // 0=North(face -Z)=PI, 1=East(face +X)=PI/2, 2=South(face +Z)=0, 3=West(face -X)=-PI/2
    const angles = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];
    return angles[dir] ?? Math.PI;
  }

  build() {
    // 1. Surrounding sci-fi floor grid
    const ambientGrid = createSciFiGrid(80, 80, 0x38bdf8, 0xe2e8f0);
    ambientGrid.position.y = -0.25;
    this.group.add(ambientGrid);

    // 2. 6x6 Elevated Sci-Fi Floating Maze Platform
    this.buildMazePlatform();

    // 3. Start Pad at (1, 0)
    this.buildStartPad();

    // 4. Target Base at (4, 4)
    this.buildTargetBase();

    // 5. Crystal Obstacles
    this.buildObstacles();

    // 6. Sci-Fi Rover
    this.buildRover();

    this.reset();
  }

  buildMazePlatform() {
    this.gridPlatform = new THREE.Group();

    // Platform Base — 深色懸浮平台，與白色探測車形成高對比
    const platGeo = new THREE.BoxGeometry(6 * CELL_SIZE + 0.6, 0.4, 6 * CELL_SIZE + 0.6);
    const platMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.35
    });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.y = -0.2;
    this.gridPlatform.add(platform);

    // Glowing border rim — 亮青邊框，在深色平台與地板之間勾勒邊界
    const rimGeo = new THREE.BoxGeometry(6 * CELL_SIZE + 0.8, 0.08, 6 * CELL_SIZE + 0.8);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = 0.01;
    this.gridPlatform.add(rim);

    // 6x6 Tile Grid Lines and Subtle Coordinate Tiles
    // 深灰棋盤格：白色探測車、綠色目標、橘色水晶在上面都清晰可辨
    const tileMatOdd = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const tileMatEven = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
    const tileGeo = new THREE.PlaneGeometry(CELL_SIZE - 0.08, CELL_SIZE - 0.08);
    tileGeo.rotateX(-Math.PI / 2);

    for (let gx = 0; gx < 6; gx++) {
      for (let gy = 0; gy < 6; gy++) {
        const isOdd = (gx + gy) % 2 === 1;
        const tileMesh = new THREE.Mesh(tileGeo, isOdd ? tileMatOdd : tileMatEven);
        const pos = this.gridToWorld(gx, gy);
        tileMesh.position.set(pos.x, 0.02, pos.z);
        this.gridPlatform.add(tileMesh);
      }
    }

    this.group.add(this.gridPlatform);
  }

  buildStartPad() {
    this.startPad = new THREE.Group();
    const pos = this.gridToWorld(LEVEL_4_MAP.start.x, LEVEL_4_MAP.start.y);
    this.startPad.position.set(pos.x, 0.03, pos.z);

    // Cyan glowing ring
    const ringGeo = new THREE.RingGeometry(0.5, 0.9, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.startPad.add(ring);

    // Start text disc
    const discGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.05, 32);
    const discMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.3 });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.01;
    this.startPad.add(disc);

    this.group.add(this.startPad);
  }

  buildTargetBase() {
    this.targetBase = new THREE.Group();
    const pos = this.gridToWorld(LEVEL_4_MAP.target.x, LEVEL_4_MAP.target.y);
    this.targetBase.position.set(pos.x, 0.03, pos.z);

    // Landing pad with green beacon
    const pad = createLandingPad(1.1, 0x10b981);
    this.targetBase.add(pad);

    // Communications Tower & Hologram Ring
    const towerGeo = new THREE.CylinderGeometry(0.12, 0.2, 2.2, 16);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x059669, metalness: 0.6 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 1.1;
    this.targetBase.add(tower);

    // Radar dish on tower
    const dishGeo = new THREE.ConeGeometry(0.5, 0.3, 16, 1, true);
    dishGeo.rotateX(Math.PI / 4);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x34d399, metalness: 0.8 });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0, 2.3, 0);
    this.targetBase.add(dish);
    this.targetBase.userData.dish = dish;

    // Beacon glow light
    const pointLight = new THREE.PointLight(0x10b981, 1.2, 8);
    pointLight.position.set(0, 2.5, 0);
    this.targetBase.add(pointLight);

    this.group.add(this.targetBase);
  }

  buildObstacles() {
    this.obstaclesGroup = new THREE.Group();

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true
    });

    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xe11d48,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.8
    });

    LEVEL_4_MAP.obstacles.forEach((ob, idx) => {
      const obGroup = new THREE.Group();
      const pos = this.gridToWorld(ob.x, ob.y);
      obGroup.position.set(pos.x, 0, pos.z);

      // Base Rock formation
      const baseRockGeo = new THREE.DodecahedronGeometry(0.85, 1);
      const baseRock = new THREE.Mesh(baseRockGeo, rockMat);
      baseRock.position.y = 0.55;
      baseRock.scale.set(1.1, 0.8, 1.1);
      obGroup.add(baseRock);

      // 3 Glowing Crystal Spikes per obstacle
      const spikeGeo = new THREE.ConeGeometry(0.22, 1.2, 5);
      spikeGeo.translate(0, 0.6, 0);

      const spike1 = new THREE.Mesh(spikeGeo, crystalMat);
      spike1.position.set(-0.25, 0.7, 0.1);
      spike1.rotation.set(0.15, idx, -0.2);
      obGroup.add(spike1);

      const spike2 = new THREE.Mesh(spikeGeo, crystalMat);
      spike2.position.set(0.25, 0.7, -0.15);
      spike2.rotation.set(-0.2, idx * 2, 0.25);
      obGroup.add(spike2);

      const spike3 = new THREE.Mesh(spikeGeo, crystalMat);
      spike3.position.set(0.0, 0.85, 0.2);
      spike3.rotation.set(0.1, idx * 3, 0.05);
      spike3.scale.set(0.8, 0.8, 0.8);
      obGroup.add(spike3);

      this.obstaclesGroup.add(obGroup);
    });

    this.group.add(this.obstaclesGroup);
  }

  buildRover() {
    this.rover = createSciFiRover();
    // Scale rover so it fits gracefully within a 2.4x2.4 grid cell
    this.rover.scale.set(0.52, 0.52, 0.52);
    this.group.add(this.rover);
  }

  resetRoverToStart() {
    this.currentGrid = {
      x: LEVEL_4_MAP.start.x,
      y: LEVEL_4_MAP.start.y,
      dir: LEVEL_4_MAP.start.dir
    };
    this.animQueue = [];
    this.isAnimating = false;
    this.currentStep = null;

    if (this.rover) {
      const pos = this.gridToWorld(this.currentGrid.x, this.currentGrid.y);
      this.rover.position.set(pos.x, 0.1, pos.z);
      this.rover.rotation.set(0, this.getHeadingAngle(this.currentGrid.dir), 0);

      const { nameLabel, flame } = this.rover.userData;
      if (flame) flame.material.opacity = 0;
      if (nameLabel) {
        nameLabel.material.map = createTextTexture('ROVER · 起點 (1, 0) 北', '#ffffff', '#2563eb');
        nameLabel.material.needsUpdate = true;
      }
    }
  }

  reset() {
    this.resetRoverToStart();
    this.resetCamera();
  }

  handleAction(actionType, payload = {}) {
    if (actionType === 'RESET_SCENE' || actionType === 'RESET_POSITION' || actionType === 'RESET') {
      this.reset();
      return;
    }

    if (actionType === 'EXECUTE_START') {
      this.resetRoverToStart();

      const inner = payload.payload || payload || {};
      let actions = [];
      if (inner.apiCalls && Array.isArray(inner.apiCalls)) {
        actions = actionsFromApiCalls(inner.apiCalls);
      } else if (inner.loopConfig) {
        actions = actionsFromLoopConfig(inner.loopConfig);
      }

      this.prepareAnimationQueue(actions);
      try {
        soundManager.playEngine();
      } catch (e) {}
    } else if (actionType === 'LEVEL_SUCCESS') {
      const { nameLabel } = this.rover.userData;
      if (nameLabel) {
        nameLabel.material.map = createTextTexture('★ 成功抵達基地 (4, 4)！', '#ffffff', '#10b981');
        nameLabel.material.needsUpdate = true;
      }
    } else if (actionType === 'LEVEL_FAIL') {
      const { nameLabel } = this.rover.userData;
      if (nameLabel) {
        nameLabel.material.map = createTextTexture(`⚠️ 未達成目的地`, '#ffffff', '#ef4444');
        nameLabel.material.needsUpdate = true;
      }
    }
  }

  /**
   * @param {string[]} actions MAZE_ACTION 序列（FORWARD / BACKWARD / TURN_LEFT / TURN_RIGHT）
   */
  prepareAnimationQueue(actions) {
    // 撞擊或出界時 simulateMaze 會在該步截止，動畫也就停在撞擊那一刻
    const sim = simulateMaze(LEVEL_4_MAP, actions);
    this.animQueue = sim.steps;

    this.isAnimating = true;
    this.stepTimer = 0;
    this.currentStep = null;
    this.advanceStep();
  }

  advanceStep() {
    if (this.animQueue.length === 0) {
      this.isAnimating = false;
      this.currentStep = null;
      return;
    }

    this.currentStep = this.animQueue.shift();
    this.stepTimer = 0;

    const { nameLabel, flame } = this.rover.userData;
    if (flame) flame.material.opacity = 0.5;

    if (this.currentStep.type === 'MOVE') {
      const fromW = this.gridToWorld(this.currentStep.fromX, this.currentStep.fromY);
      const toW = this.gridToWorld(this.currentStep.toX, this.currentStep.toY);

      this.startTransform = {
        x: fromW.x,
        z: fromW.z,
        rotY: this.getHeadingAngle(this.currentStep.dir)
      };
      this.targetTransform = {
        x: toW.x,
        z: toW.z,
        rotY: this.getHeadingAngle(this.currentStep.dir)
      };

      if (nameLabel) {
        nameLabel.material.map = createTextTexture(
          `巡航至 (${this.currentStep.toX}, ${this.currentStep.toY})`,
          '#ffffff',
          '#0284c7'
        );
        nameLabel.material.needsUpdate = true;
      }
    } else if (this.currentStep.type === 'TURN') {
      const curW = this.gridToWorld(this.currentStep.gx, this.currentStep.gy);
      const fromAngle = this.getHeadingAngle(this.currentStep.fromDir);
      let toAngle = this.getHeadingAngle(this.currentStep.toDir);

      // Handle angle wrap-around smoothly
      if (toAngle - fromAngle > Math.PI) toAngle -= Math.PI * 2;
      if (toAngle - fromAngle < -Math.PI) toAngle += Math.PI * 2;

      this.startTransform = {
        x: curW.x,
        z: curW.z,
        rotY: fromAngle
      };
      this.targetTransform = {
        x: curW.x,
        z: curW.z,
        rotY: toAngle
      };

      if (nameLabel) {
        nameLabel.material.map = createTextTexture(
          `轉向至 ${this.getHeadingName(this.currentStep.toDir)}`,
          '#ffffff',
          '#6366f1'
        );
        nameLabel.material.needsUpdate = true;
      }
    }
  }

  getHeadingName(dir) {
    const names = ['北', '東', '南', '西'];
    return names[dir] || '北';
  }

  update(delta) {
    // 1. Rotate Radar dish on target base
    if (this.targetBase && this.targetBase.userData.dish) {
      this.targetBase.userData.dish.rotation.y += delta * 1.5;
    }

    // 2. Pulse target beacon
    if (this.targetBase) {
      const beacon = this.targetBase.userData.beacon;
      if (beacon) {
        beacon.rotation.y += delta * 0.8;
      }
    }

    // 3. Step-by-step Rover Motion Interpolation
    if (this.isAnimating && this.currentStep && this.rover) {
      this.stepTimer += delta;
      const progress = Math.min(1.0, this.stepTimer / this.stepDuration);
      // Smooth easeInOutQuad interpolation
      const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

      const curX = THREE.MathUtils.lerp(this.startTransform.x, this.targetTransform.x, ease);
      const curZ = THREE.MathUtils.lerp(this.startTransform.z, this.targetTransform.z, ease);
      const curRotY = THREE.MathUtils.lerp(this.startTransform.rotY, this.targetTransform.rotY, ease);

      this.rover.position.set(curX, 0.1, curZ);
      this.rover.rotation.y = curRotY;

      // Wheel roll animation during move
      if (this.currentStep.type === 'MOVE' && this.rover.userData.wheels) {
        this.rover.userData.wheels.forEach(w => {
          w.children[0].rotation.x += delta * 10;
        });
      }

      if (progress >= 1.0) {
        // Step finished
        if (this.currentStep.collision || this.currentStep.outOfBounds) {
          // Collision stop
          this.isAnimating = false;
          const { flame, nameLabel } = this.rover.userData;
          if (flame) flame.material.opacity = 0;
          if (nameLabel) {
            nameLabel.material.map = createTextTexture(
              this.currentStep.collision ? '💥 撞擊岩石障礙物！' : '⚠️ 超出平台邊緣！',
              '#ffffff',
              '#ef4444'
            );
            nameLabel.material.needsUpdate = true;
          }
          try {
            soundManager.playError();
          } catch (e) {}
        } else {
          this.advanceStep();
        }
      }
    }
  }
}
