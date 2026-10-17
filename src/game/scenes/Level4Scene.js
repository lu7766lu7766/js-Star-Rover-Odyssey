/**
 * Level 4 Scene: 迷宮巡航與迴圈拼圖 (Maze Navigation & Loop Puzzles)
 * 3D 6x6 Sci-Fi Grid Platform with Start Pad, Destination Base, and Crystal Obstacles.
 */

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BaseGameScene } from './BaseGameScene.js';
import { createSciFiRover, createSciFiGrid, createLandingPad, createTextTexture } from '../models/ProceduralMeshes.js';
import { soundManager } from '../core/SoundManager.js';
import { LEVEL_4_MAP } from '../../levels/level-4.js';
import { simulateMaze, actionsFromApiCalls, actionsFromLoopConfig, MAZE_STEP_SECONDS } from '../sim/maze.js';

const CELL_SIZE = 2.4;

/**
 * 建立玄武岩多邊形岩柱幾何體：先 mergeVertices 再做確定性頂點位移，避免裂縫並呈現嶙峋切面
 */
function createBasaltPillarGeometry(radiusTop, radiusBottom, height, radialSegments = 6, seed = 1) {
  const raw = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 4);
  raw.translate(0, height / 2, 0);
  const geo = mergeVertices(raw);
  raw.dispose();

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    // 底部貼齊地面不動，往上逐漸加入岩石稜角位移
    if (vy > 0.06) {
      const hRatio = vy / height;
      const hash = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
      const n1 = hash - Math.floor(hash);
      const hash2 = Math.sin((i + 1) * 45.164 + seed * 31.71) * 19341.123;
      const n2 = hash2 - Math.floor(hash2);

      const radialScale = 0.88 + n1 * 0.22 * (1.0 - hRatio * 0.25);
      let ny = vy + (n2 - 0.5) * 0.14 * hRatio;
      // 柱頂做斜切面感
      if (hRatio > 0.9) {
        ny += (vx * 0.18 - vz * 0.15) * (seed % 2 === 0 ? 1 : -1);
      }
      pos.setXYZ(i, vx * radialScale, Math.max(0.05, ny), vz * radialScale);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

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
    this.stepDuration = MAZE_STEP_SECONDS;
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

    // 5. Basalt Pillar Obstacles & Red Warning Tiles
    this.buildObstacles();

    // 6. Outer Canyon Rock Formations (2+ cells away from platform edge)
    this.buildCanyonEnvironment();

    // 7. Sci-Fi Rover
    this.buildRover();

    this.reset();
  }

  buildMazePlatform() {
    this.gridPlatform = new THREE.Group();
    const gridSpan = 6 * CELL_SIZE;

    // Platform Base — 深色懸浮平台底座（頂面 y=0.0，在棋盤格之間露出深色細縫線）
    const platGeo = new THREE.BoxGeometry(gridSpan + 0.6, 0.4, gridSpan + 0.6);
    const platMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.35
    });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.y = -0.2;
    this.gridPlatform.add(platform);

    // Glowing border rim — 只在平台外圍的四條細邊框勾勒邊界，不覆蓋 6x6 棋盤格
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const rimThickness = 0.12;
    const rimHeight = 0.08;
    const rimOffset = gridSpan * 0.5 + 0.34;

    const rimHorizGeo = new THREE.BoxGeometry(gridSpan + 0.8, rimHeight, rimThickness);
    const rimVertGeo = new THREE.BoxGeometry(rimThickness, rimHeight, gridSpan + 0.56);

    const rimNorth = new THREE.Mesh(rimHorizGeo, rimMat);
    rimNorth.position.set(0, 0.02, -rimOffset);
    this.gridPlatform.add(rimNorth);

    const rimSouth = new THREE.Mesh(rimHorizGeo, rimMat);
    rimSouth.position.set(0, 0.02, rimOffset);
    this.gridPlatform.add(rimSouth);

    const rimWest = new THREE.Mesh(rimVertGeo, rimMat);
    rimWest.position.set(-rimOffset, 0.02, 0);
    this.gridPlatform.add(rimWest);

    const rimEast = new THREE.Mesh(rimVertGeo, rimMat);
    rimEast.position.set(rimOffset, 0.02, 0);
    this.gridPlatform.add(rimEast);

    // 6x6 深灰兩色棋盤格，每格之間保留 0.10 細縫線露出深色底板
    const tileMatOdd = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.62,
      metalness: 0.15
    });
    const tileMatEven = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.62,
      metalness: 0.15
    });
    const tileGeo = new THREE.BoxGeometry(CELL_SIZE - 0.1, 0.04, CELL_SIZE - 0.1);

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
    this.startPad.position.set(pos.x, 0.045, pos.z);

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
    this.targetBase.position.set(pos.x, 0.045, pos.z);

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
    const isLowPerf = Boolean(this.sceneManager?.isLowPerformance);

    // 深炭灰 / 深褐玄武岩材質（高對比擋路感，flatShading）
    const basaltMatPrimary = new THREE.MeshStandardMaterial({
      color: 0x3b3530,
      roughness: 0.88,
      metalness: 0.12,
      flatShading: true
    });
    const basaltMatDark = new THREE.MeshStandardMaterial({
      color: 0x292524,
      roughness: 0.92,
      metalness: 0.1,
      flatShading: true
    });

    // 嵌在柱頂與縫隙中的發光橘紅水晶材質
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xe11d48,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.75,
      flatShading: true
    });

    // 障礙物格地面：紅色發光危險地磚 + 霓虹紅警示外框
    const dangerTileMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      emissive: 0xdc2626,
      emissiveIntensity: 0.42,
      roughness: 0.5,
      metalness: 0.2
    });
    const warnFrameMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    // 共用幾何體：地面警示磚與紅框
    const dangerTileGeo = new THREE.BoxGeometry(CELL_SIZE - 0.16, 0.025, CELL_SIZE - 0.16);
    const frameSpan = CELL_SIZE - 0.14;
    const frameThick = 0.11;
    const frameH = 0.04;
    const frameBarHGeo = new THREE.BoxGeometry(frameSpan, frameH, frameThick);
    const frameBarVGeo = new THREE.BoxGeometry(frameThick, frameH, frameSpan - frameThick * 2);
    const frameEdgeOffset = frameSpan * 0.5 - frameThick * 0.5;

    // 共用幾何體：4 種高低不一的多邊形玄武岩柱（高度約 1.05 ~ 1.72）與水晶
    const pillarTallGeo = createBasaltPillarGeometry(0.34, 0.46, 1.72, 6, 11);
    const pillarMidTallGeo = createBasaltPillarGeometry(0.32, 0.44, 1.42, 6, 23);
    const pillarMidGeo = createBasaltPillarGeometry(0.30, 0.42, 1.18, 5, 37);
    const pillarShortGeo = createBasaltPillarGeometry(0.28, 0.38, 1.02, 6, 53);

    const crystalGeo = new THREE.ConeGeometry(0.18, 0.72, 5);
    crystalGeo.translate(0, 0.36, 0);

    LEVEL_4_MAP.obstacles.forEach((ob, idx) => {
      const obGroup = new THREE.Group();
      const pos = this.gridToWorld(ob.x, ob.y);
      obGroup.position.set(pos.x, 0.04, pos.z);

      // 1. 地面紅色發光地磚 + 紅色警示框（一眼看出此格不可通行）
      const dangerTile = new THREE.Mesh(dangerTileGeo, dangerTileMat);
      dangerTile.position.y = 0.012;
      obGroup.add(dangerTile);

      const frameN = new THREE.Mesh(frameBarHGeo, warnFrameMat);
      frameN.position.set(0, 0.025, -frameEdgeOffset);
      obGroup.add(frameN);

      const frameS = new THREE.Mesh(frameBarHGeo, warnFrameMat);
      frameS.position.set(0, 0.025, frameEdgeOffset);
      obGroup.add(frameS);

      const frameW = new THREE.Mesh(frameBarVGeo, warnFrameMat);
      frameW.position.set(-frameEdgeOffset, 0.025, 0);
      obGroup.add(frameW);

      const frameE = new THREE.Mesh(frameBarVGeo, warnFrameMat);
      frameE.position.set(frameEdgeOffset, 0.025, 0);
      obGroup.add(frameE);

      // 2. 玄武岩柱群（每格 3~4 根高低交錯岩柱，佔滿格子但不超出邊界）
      const clusterGroup = new THREE.Group();
      clusterGroup.rotation.y = (idx * Math.PI) / 3;

      // 主岩柱（最高，約 1.72）
      const p1 = new THREE.Mesh(pillarTallGeo, basaltMatPrimary);
      p1.position.set(-0.22, 0.02, -0.18);
      p1.rotation.set(0.04, idx * 0.7, -0.05);
      clusterGroup.add(p1);

      // 次高岩柱（約 1.42）
      const p2 = new THREE.Mesh(pillarMidTallGeo, basaltMatDark);
      p2.position.set(0.34, 0.02, -0.12);
      p2.rotation.set(-0.05, idx * 1.3, 0.06);
      clusterGroup.add(p2);

      // 中岩柱（約 1.18）
      const p3 = new THREE.Mesh(pillarMidGeo, basaltMatPrimary);
      p3.position.set(0.08, 0.02, 0.36);
      p3.rotation.set(0.06, idx * 2.1, 0.04);
      clusterGroup.add(p3);

      // 第四根矮岩柱（約 1.02，低效能模式省略以節省 draw call）
      if (!isLowPerf) {
        const p4 = new THREE.Mesh(pillarShortGeo, basaltMatDark);
        p4.position.set(-0.38, 0.02, 0.28);
        p4.rotation.set(0.05, idx * 1.7, -0.07);
        clusterGroup.add(p4);
      }

      // 3. 嵌在柱頂與岩柱縫隙中的發光橘紅水晶
      const c1 = new THREE.Mesh(crystalGeo, crystalMat);
      c1.position.set(-0.18, 1.35, -0.15);
      c1.rotation.set(0.18, idx, -0.22);
      clusterGroup.add(c1);

      const c2 = new THREE.Mesh(crystalGeo, crystalMat);
      c2.position.set(0.32, 1.05, -0.08);
      c2.rotation.set(-0.24, idx * 2, 0.28);
      c2.scale.set(0.85, 0.9, 0.85);
      clusterGroup.add(c2);

      const c3 = new THREE.Mesh(crystalGeo, crystalMat);
      c3.position.set(0.02, 0.65, 0.12);
      c3.rotation.set(0.32, idx * 1.5, -0.15);
      c3.scale.set(0.9, 1.05, 0.9);
      clusterGroup.add(c3);

      obGroup.add(clusterGroup);
      this.obstaclesGroup.add(obGroup);
    });

    this.group.add(this.obstaclesGroup);
  }

  buildCanyonEnvironment() {
    const isLowPerf = Boolean(this.sceneManager?.isLowPerformance);
    const canyonGroup = new THREE.Group();

    const canyonRockMat = new THREE.MeshStandardMaterial({
      color: 0x332d28,
      roughness: 0.92,
      metalness: 0.08,
      flatShading: true
    });
    const canyonDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e242b,
      roughness: 0.95,
      metalness: 0.08,
      flatShading: true
    });

    const spireGeo = createBasaltPillarGeometry(1.1, 2.2, 5.2, 6, 71);
    const bluffGeo = createBasaltPillarGeometry(1.8, 2.8, 3.6, 7, 89);

    // 距離 6x6 平台邊緣（±7.2）至少 2 格（4.8）以上，且避開南方預設相機（z > 8, x ∈ [-12, 12]）視線
    const formations = isLowPerf
      ? [
          { x: -14.5, z: -13.5, sx: 1.2, sy: 1.1, sz: 1.1, geo: spireGeo, dark: false },
          { x: -4.5, z: -15.5, sx: 1.5, sy: 0.95, sz: 1.2, geo: bluffGeo, dark: true },
          { x: 5.5, z: -15.0, sx: 1.3, sy: 1.15, sz: 1.1, geo: spireGeo, dark: false },
          { x: 14.8, z: -13.0, sx: 1.4, sy: 1.0, sz: 1.2, geo: bluffGeo, dark: true },
          { x: -15.2, z: -1.5, sx: 1.1, sy: 0.9, sz: 1.3, geo: bluffGeo, dark: false },
          { x: 15.2, z: -1.0, sx: 1.2, sy: 0.95, sz: 1.2, geo: spireGeo, dark: true }
        ]
      : [
          { x: -15.0, z: -13.5, sx: 1.3, sy: 1.2, sz: 1.1, geo: spireGeo, dark: false },
          { x: -9.5, z: -15.2, sx: 1.5, sy: 0.95, sz: 1.2, geo: bluffGeo, dark: true },
          { x: -3.2, z: -16.0, sx: 1.2, sy: 1.3, sz: 1.1, geo: spireGeo, dark: false },
          { x: 3.8, z: -15.8, sx: 1.6, sy: 1.0, sz: 1.3, geo: bluffGeo, dark: true },
          { x: 10.2, z: -14.8, sx: 1.25, sy: 1.25, sz: 1.1, geo: spireGeo, dark: false },
          { x: 15.2, z: -12.8, sx: 1.4, sy: 1.05, sz: 1.2, geo: bluffGeo, dark: true },
          { x: -15.5, z: -6.5, sx: 1.2, sy: 1.1, sz: 1.2, geo: spireGeo, dark: true },
          { x: -16.0, z: 0.5, sx: 1.4, sy: 0.9, sz: 1.3, geo: bluffGeo, dark: false },
          { x: -15.2, z: 7.2, sx: 1.1, sy: 0.85, sz: 1.1, geo: spireGeo, dark: true },
          { x: 15.5, z: -6.0, sx: 1.3, sy: 1.05, sz: 1.2, geo: bluffGeo, dark: false },
          { x: 16.0, z: 1.0, sx: 1.15, sy: 1.1, sz: 1.15, geo: spireGeo, dark: true },
          { x: 15.2, z: 7.5, sx: 1.3, sy: 0.8, sz: 1.2, geo: bluffGeo, dark: false }
        ];

    formations.forEach((f, idx) => {
      const rock = new THREE.Mesh(f.geo, f.dark ? canyonDarkMat : canyonRockMat);
      rock.position.set(f.x, -0.25, f.z);
      rock.scale.set(f.sx, f.sy, f.sz);
      rock.rotation.y = idx * 1.1;
      canyonGroup.add(rock);
    });

    this.group.add(canyonGroup);
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
