/**
 * Star Rover Odyssey - Level 9 Scene: 太空站跑酷 (3D Third-Person Parkour)
 *
 * 第三人稱 3D 跑酷視角：太空探險家在懸浮軌道上疾速奔跑，相機從後方平滑追隨。
 * 動作包含：
 * - run: 雙腿流暢交替跑步，手臂擺動，身體前傾
 * - jump: 躍過斷崖缺口或低矮障礙，單膝前收噴射推進
 * - slide: 帥氣極限滑壘姿勢（極度壓低身形，低於 0.45 單位，火花拖曳），順暢穿過高空光能閘門
 */

import * as THREE from 'three';
import { BaseGameScene } from './BaseGameScene.js';
import {
  createSciFiAstronaut,
  createSciFiGrid,
  createLandingPad,
  createGlowSprite,
  createHazardTexture
} from '../models/ProceduralMeshes.js';
import { soundManager } from '../core/SoundManager.js';
import { PARKOUR_COURSES, TILE, ACTION } from '../sim/parkour.js';

const STEP_LEN = 4.0;
const TRACK_WIDTH = 3.2;
const GAP_LEN = 2.0;

let _chasmGradientTex = null;
function getChasmGradientTexture() {
  if (_chasmGradientTex) return _chasmGradientTex;
  if (typeof document === 'undefined') return new THREE.Texture();
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(2, 6, 23, 0.92)');
  grad.addColorStop(0.45, 'rgba(15, 23, 42, 0.78)');
  grad.addColorStop(0.82, 'rgba(154, 52, 18, 0.55)');
  grad.addColorStop(1.0, 'rgba(249, 115, 22, 0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);
  _chasmGradientTex = new THREE.CanvasTexture(canvas);
  _chasmGradientTex.colorSpace = THREE.SRGBColorSpace;
  return _chasmGradientTex;
}

export class Level9Scene extends BaseGameScene {
  constructor() {
    super(9);
    this.showGlobalGround = false;
    this.character = null;
    this.rover = null; // Alias for backward compatibility
    this.trackGroup = null;
    this.obstaclesGroup = null;
    this.finishPad = null;
    this.lowBarriers = [];
    this.pulseTimer = 0;

    // Simulation animation state
    this.course = PARKOUR_COURSES[0]; // Course A
    this.isAnimating = false;
    this.framesQueue = [];
    this.currentFrame = null;
    this.frameTimer = 0;
    this.frameDuration = 0.44; // Smooth cinematic pace per step

    this.idleTimer = 0;

    // Transform interpolation
    this.characterBaseY = 0.0;
    this.startPos = new THREE.Vector3();
    this.targetPos = new THREE.Vector3();
    this.fallHoleZ = null;

    // Camera follow offsets (Third-person follow view)
    this.camOffset = new THREE.Vector3(0, 3.2, -5.5);
    this.lookOffset = new THREE.Vector3(0, 1.2, 4.0);
    this.savedMinPolarAngle = null;
  }

  init(sceneManager) {
    this.sceneManager = sceneManager;
    const controls = this.sceneManager?.cameraController?.controls;
    if (controls && this.savedMinPolarAngle === null) {
      this.savedMinPolarAngle = controls.minPolarAngle;
    }
    this.build();
    this.resetCamera();
  }

  restoreMinPolarAngle() {
    const controls = this.sceneManager?.cameraController?.controls;
    if (controls && this.savedMinPolarAngle !== null) {
      controls.minPolarAngle = this.savedMinPolarAngle;
    }
  }

  resetCamera() {
    if (this.sceneManager && this.sceneManager.cameraController) {
      const startZ = 0;
      this.sceneManager.cameraController.reset(
        new THREE.Vector3(this.camOffset.x, this.camOffset.y, startZ + this.camOffset.z),
        new THREE.Vector3(this.lookOffset.x, this.lookOffset.y, startZ + this.lookOffset.z)
      );
    }
  }

  build() {
    // 1. 無底深空底層：將深空網格下移至 y = -12，並鋪設深淵吸光底面避免天球亮底透出
    const abyssDiscGeo = new THREE.CircleGeometry(110, 48);
    abyssDiscGeo.rotateX(-Math.PI / 2);
    const abyssDiscMat = new THREE.MeshStandardMaterial({
      color: 0x050814,
      roughness: 0.98,
      metalness: 0.0
    });
    const abyssDisc = new THREE.Mesh(abyssDiscGeo, abyssDiscMat);
    abyssDisc.name = 'ground_abyss';
    abyssDisc.position.set(0, -12.15, 24);
    this.group.add(abyssDisc);

    const ambientGrid = createSciFiGrid(160, 160, 0x6366f1, 0x1e293b);
    ambientGrid.position.set(0, -12.0, 24);
    this.group.add(ambientGrid);

    // 1b. 遠景深空懸浮結構剪影，強化高空懸浮感
    this.buildDistantSilhouettes();

    // 2. Build the floating track based on Course A
    this.buildTrack();

    // 3. Humanoid Sci-Fi Astronaut character
    this.character = createSciFiAstronaut();
    this.rover = this.character; // alias for compatibility
    this.character.scale.set(0.95, 0.95, 0.95);
    this.group.add(this.character);

    this.reset();
  }

  buildDistantSilhouettes() {
    const isLowPerf = Boolean(this.sceneManager?.isLowPerformance);
    const silhouetteGroup = new THREE.Group();

    const silMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.3
    });
    const silGlowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45
    });

    const towerGeo = new THREE.BoxGeometry(2.4, 14.0, 2.4);
    const crossBeamGeo = new THREE.BoxGeometry(6.5, 0.7, 0.9);
    const stripGeo = new THREE.BoxGeometry(0.18, 10.0, 0.18);

    const placements = isLowPerf
      ? [
          { x: -16, y: -6.5, z: 12, scaleY: 1.0 },
          { x: 17, y: -5.5, z: 24, scaleY: 1.15 },
          { x: -18, y: -6.0, z: 40, scaleY: 0.95 },
          { x: 16, y: -6.8, z: 52, scaleY: 1.1 }
        ]
      : [
          { x: -15, y: -6.2, z: 6, scaleY: 0.95 },
          { x: 16, y: -5.8, z: 14, scaleY: 1.1 },
          { x: -19, y: -5.0, z: 24, scaleY: 1.25 },
          { x: 18, y: -6.5, z: 32, scaleY: 1.0 },
          { x: -16, y: -5.5, z: 42, scaleY: 1.15 },
          { x: 15, y: -6.0, z: 50, scaleY: 1.05 },
          { x: -18, y: -6.2, z: 60, scaleY: 0.9 },
          { x: 17, y: -5.4, z: 68, scaleY: 1.2 }
        ];

    placements.forEach((p, i) => {
      const node = new THREE.Group();
      node.position.set(p.x, p.y, p.z);

      const tower = new THREE.Mesh(towerGeo, silMat);
      tower.scale.y = p.scaleY;
      node.add(tower);

      const beam = new THREE.Mesh(crossBeamGeo, silMat);
      beam.position.set(p.x > 0 ? -1.5 : 1.5, 2.2, 0);
      node.add(beam);

      if (i % 2 === 0) {
        const strip = new THREE.Mesh(stripGeo, silGlowMat);
        strip.position.set(p.x > 0 ? -1.25 : 1.25, 0.5, 0);
        node.add(strip);
      }

      silhouetteGroup.add(node);
    });

    this.group.add(silhouetteGroup);
  }

  buildTrack() {
    this.trackGroup = new THREE.Group();
    this.obstaclesGroup = new THREE.Group();
    this.lowBarriers = [];

    const isLowPerf = Boolean(this.sceneManager?.isLowPerformance);
    const tiles = this.course.tiles;
    const lastIdx = tiles.length - 1;

    // ─── 共用跑道材質（頂面中深色不反白、側面與底結構更深色） ───
    const topDeckMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.55,
      metalness: 0.25
    });
    const hullSideMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.72,
      metalness: 0.35
    });
    const girderMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.45
    });
    const borderMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const seamMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const landingMarkMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.55
    });

    // ─── 缺口懸崖斷面與深淵警示共用材質 ───
    const hazardMat = new THREE.MeshStandardMaterial({
      map: createHazardTexture(),
      roughness: 0.45,
      metalness: 0.2
    });
    const warnNeonMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const abyssBottomMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.9,
      roughness: 0.3,
      metalness: 0.1
    });
    const abyssCoreMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.85
    });
    const chasmCurtainMat = new THREE.MeshBasicMaterial({
      map: getChasmGradientTexture(),
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const abyssMistMat = new THREE.MeshBasicMaterial({
      color: 0x090d16,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // ─── 障礙物共用材質 ───
    const lowBarrierLaserMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xef4444,
      emissiveIntensity: 1.8,
      metalness: 0.5,
      roughness: 0.2
    });
    const highBeamMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x9333ea,
      emissiveIntensity: 1.6,
      metalness: 0.5,
      roughness: 0.1
    });
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3
    });
    const warnDeckMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.85
    });

    // ─── 共用幾何體（單位長度 BoxGeometry 搭配 scale.z 建立連續實心區段） ───
    const unitTopDeckGeo = new THREE.BoxGeometry(TRACK_WIDTH, 0.18, 1.0);
    const unitUnderHullGeo = new THREE.BoxGeometry(TRACK_WIDTH - 0.16, 1.06, 1.0);
    const unitSideRibGeo = new THREE.BoxGeometry(0.14, 0.92, 1.0);
    const unitRimGeo = new THREE.BoxGeometry(0.1, 0.06, 1.0);
    const finishHullGeo = new THREE.BoxGeometry(TRACK_WIDTH - 0.16, 1.06, STEP_LEN - 0.24);

    const seamLineGeo = new THREE.BoxGeometry(TRACK_WIDTH - 0.22, 0.012, 0.06);
    const centerLineGeo = new THREE.BoxGeometry(0.12, 0.02, STEP_LEN * 0.24);

    // 落地區提示標線與箭頭幾何體（扁平貼地 y ≈ 0.012）
    const landingBarGeo = new THREE.BoxGeometry(TRACK_WIDTH * 0.52, 0.008, 0.07);
    const landingChevronArmGeo = new THREE.BoxGeometry(0.46, 0.008, 0.08);
    const landingSideGeo = new THREE.BoxGeometry(0.08, 0.008, 0.52);

    // 懸空支撐柱（延伸到 y = -12）
    const pillarHeight = 11.0;
    const supportPillarGeo = new THREE.BoxGeometry(0.28, pillarHeight, 0.32);
    const crossBraceGeo = new THREE.BoxGeometry(TRACK_WIDTH - 0.3, 0.22, 0.24);

    // 缺口斷面與深淵幾何體（長度配合 GAP_LEN）
    const cliffWallGeo = new THREE.BoxGeometry(TRACK_WIDTH - 0.06, 2.8, 0.22);
    const cliffRibGeo = new THREE.BoxGeometry(0.22, 2.7, 0.28);
    const cliffHazardBarGeo = new THREE.BoxGeometry(TRACK_WIDTH + 0.08, 0.18, 0.34);
    const cliffWarnStripGeo = new THREE.BoxGeometry(TRACK_WIDTH - 0.1, 0.08, 0.26);

    const abyssBottomGeo = new THREE.PlaneGeometry(TRACK_WIDTH * 1.12, GAP_LEN * 0.96);
    abyssBottomGeo.rotateX(-Math.PI / 2);
    const abyssCoreGeo = new THREE.PlaneGeometry(TRACK_WIDTH * 0.65, GAP_LEN * 0.55);
    abyssCoreGeo.rotateX(-Math.PI / 2);
    const abyssMistGeo = new THREE.PlaneGeometry(TRACK_WIDTH * 0.98, GAP_LEN * 0.92);
    abyssMistGeo.rotateX(-Math.PI / 2);

    const curtainSideGeo = new THREE.PlaneGeometry(GAP_LEN * 0.96, 7.2);
    curtainSideGeo.rotateY(Math.PI / 2);
    const curtainEndGeo = new THREE.PlaneGeometry(TRACK_WIDTH * 0.98, 7.2);

    // 低矮路障共用幾何體（實心箱型路障，總高 <= 0.62）
    const barrierBaseGeo = new THREE.BoxGeometry(TRACK_WIDTH * 0.95, 0.06, 0.66);
    const barrierBoxGeo = new THREE.BoxGeometry(TRACK_WIDTH * 0.90, 0.46, 0.56);
    const barrierCapGeo = new THREE.BoxGeometry(TRACK_WIDTH * 0.92, 0.04, 0.60);
    const barrierRibGeo = new THREE.BoxGeometry(0.12, 0.48, 0.60);
    const bollardGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.58, 14);
    const railGeo = new THREE.CylinderGeometry(0.045, 0.045, TRACK_WIDTH * 0.92, 14);
    railGeo.rotateZ(Math.PI / 2);
    const warnDeckGeo = new THREE.BoxGeometry(TRACK_WIDTH * 0.90, 0.02, 0.48);

    // 高空橫桿共用幾何體
    const highPylonGeo = new THREE.CylinderGeometry(0.12, 0.14, 2.5, 14);
    const highBarGeo = new THREE.CylinderGeometry(0.095, 0.095, TRACK_WIDTH * 1.12, 16);
    highBarGeo.rotateZ(Math.PI / 2);

    // ─── 1. 計算跑道連續實心區段（從 -STEP_LEN/2 到 lastIdx*STEP_LEN - STEP_LEN/2 扣除所有洞區間） ───
    const trackStartZ = -STEP_LEN * 0.5;
    const trackEndZ = lastIdx * STEP_LEN - STEP_LEN * 0.5;
    const gapRanges = [];

    for (let idx = 1; idx < lastIdx; idx++) {
      if (tiles[idx] === TILE.GAP) {
        const midZ = (idx - 0.5) * STEP_LEN;
        gapRanges.push({
          idx,
          midZ,
          start: midZ - GAP_LEN * 0.5,
          end: midZ + GAP_LEN * 0.5
        });
      }
    }

    const solidSegments = [];
    let segCursor = trackStartZ;
    for (const gap of gapRanges) {
      if (gap.start > segCursor) {
        solidSegments.push({ start: segCursor, end: gap.start });
      }
      segCursor = Math.max(segCursor, gap.end);
    }
    if (trackEndZ > segCursor) {
      solidSegments.push({ start: segCursor, end: trackEndZ });
    }

    // 建立每個連續實心區段的 topDeck / underHull / 側肋 / 亮青邊框
    solidSegments.forEach((seg) => {
      const segLen = seg.end - seg.start;
      const segMidZ = (seg.start + seg.end) * 0.5;

      const topDeck = new THREE.Mesh(unitTopDeckGeo, topDeckMat);
      topDeck.scale.z = segLen;
      topDeck.position.set(0, -0.09, segMidZ);
      this.trackGroup.add(topDeck);

      const underHull = new THREE.Mesh(unitUnderHullGeo, hullSideMat);
      underHull.scale.z = Math.max(0.1, segLen - 0.06);
      underHull.position.set(0, -0.71, segMidZ);
      this.trackGroup.add(underHull);

      const ribLen = Math.max(0.1, segLen - 0.16);
      const leftSideRib = new THREE.Mesh(unitSideRibGeo, girderMat);
      leftSideRib.scale.z = ribLen;
      leftSideRib.position.set(-TRACK_WIDTH * 0.48, -0.66, segMidZ);
      this.trackGroup.add(leftSideRib);

      const rightSideRib = new THREE.Mesh(unitSideRibGeo, girderMat);
      rightSideRib.scale.z = ribLen;
      rightSideRib.position.set(TRACK_WIDTH * 0.48, -0.66, segMidZ);
      this.trackGroup.add(rightSideRib);

      const leftRim = new THREE.Mesh(unitRimGeo, borderMat);
      leftRim.scale.z = segLen;
      leftRim.position.set(-TRACK_WIDTH * 0.49, 0.02, segMidZ);
      this.trackGroup.add(leftRim);

      const rightRim = new THREE.Mesh(unitRimGeo, borderMat);
      rightRim.scale.z = segLen;
      rightRim.position.set(TRACK_WIDTH * 0.49, 0.02, segMidZ);
      this.trackGroup.add(rightRim);
    });

    // ─── 2. 逐格建立中線、接縫線、支撐柱、中段缺口與障礙物 ───
    tiles.forEach((type, idx) => {
      const z = idx * STEP_LEN;

      // Finish Pad at last tile
      if (type === TILE.FINISH) {
        this.finishPad = new THREE.Group();
        this.finishPad.position.set(0, 0, z);

        // 終點平台下方也加上厚實底結構
        const finishHull = new THREE.Mesh(finishHullGeo, hullSideMat);
        finishHull.position.set(0, -0.65, 0);
        this.finishPad.add(finishHull);

        const pad = createLandingPad(2.0, 0x10b981);
        this.finishPad.add(pad);

        // Hologram beacon ring
        const holoGeo = new THREE.TorusGeometry(1.8, 0.05, 16, 36);
        holoGeo.rotateX(Math.PI / 2);
        const holoMat = new THREE.MeshBasicMaterial({ color: 0x34d399, wireframe: true });
        const holo = new THREE.Mesh(holoGeo, holoMat);
        holo.position.y = 1.3;
        this.finishPad.add(holo);
        this.finishPad.userData.holo = holo;

        this.trackGroup.add(this.finishPad);
        return;
      }

      // 每格中心都是實心落腳點，保留中線虛線
      const centerLine = new THREE.Mesh(centerLineGeo, lineMat);
      centerLine.position.set(0, 0.01, z);
      this.trackGroup.add(centerLine);

      // 每格交界 (idx + 0.5) * STEP_LEN 若落在實心區段內，加細深色接縫線
      const seamZ = (idx + 0.5) * STEP_LEN;
      const isSeamInSolid = solidSegments.some(
        (seg) => seamZ > seg.start + 0.05 && seamZ < seg.end - 0.05
      );
      if (isSeamInSolid) {
        const seamLine = new THREE.Mesh(seamLineGeo, seamMat);
        seamLine.position.set(0, 0.006, seamZ);
        this.trackGroup.add(seamLine);
      }

      // 懸空支撐柱放在每格中心（含 gap 格中心），洞前後的格子必放
      const isGap = type === TILE.GAP;
      const prevIsGap = idx > 0 && tiles[idx - 1] === TILE.GAP;
      const nextIsGap = idx < tiles.length - 1 && tiles[idx + 1] === TILE.GAP;
      const nearGap = isGap || prevIsGap || nextIsGap;

      const shouldPlacePillars = nearGap || !isLowPerf || idx % 2 === 0;
      if (shouldPlacePillars) {
        const pillarL = new THREE.Mesh(supportPillarGeo, girderMat);
        pillarL.position.set(-TRACK_WIDTH * 0.43, -6.5, z);
        this.trackGroup.add(pillarL);

        const pillarR = new THREE.Mesh(supportPillarGeo, girderMat);
        pillarR.position.set(TRACK_WIDTH * 0.43, -6.5, z);
        this.trackGroup.add(pillarR);

        const braceTop = new THREE.Mesh(crossBraceGeo, hullSideMat);
        braceTop.position.set(0, -2.4, z);
        this.trackGroup.add(braceTop);

        if (!isLowPerf || nearGap) {
          const braceLow = new THREE.Mesh(crossBraceGeo, hullSideMat);
          braceLow.position.set(0, -6.2, z);
          this.trackGroup.add(braceLow);
        }
      }

      // ─── 每格地形的「特徵」都放在「前一格中心 → 本格中心」的中段 midZ = (idx - 0.5) * STEP_LEN ───
      if (idx > 0) {
        const midZ = (idx - 0.5) * STEP_LEN;

        // 0. GAP：中段高空斷崖深淵 [midZ - GAP_LEN/2, midZ + GAP_LEN/2]
        if (type === TILE.GAP) {
          const zFront = midZ - GAP_LEN * 0.5;
          const zBack = midZ + GAP_LEN * 0.5;

          // (a) 洞前緣、後緣：黃黑警示橫樑 + 紅色霓虹邊條
          const hazardFront = new THREE.Mesh(cliffHazardBarGeo, hazardMat);
          hazardFront.position.set(0, -0.02, zFront);
          this.trackGroup.add(hazardFront);

          const hazardBack = new THREE.Mesh(cliffHazardBarGeo, hazardMat);
          hazardBack.position.set(0, -0.02, zBack);
          this.trackGroup.add(hazardBack);

          const warnEdgeFront = new THREE.Mesh(cliffWarnStripGeo, warnNeonMat);
          warnEdgeFront.position.set(0, 0.08, zFront - 0.12);
          this.trackGroup.add(warnEdgeFront);

          const warnEdgeBack = new THREE.Mesh(cliffWarnStripGeo, warnNeonMat);
          warnEdgeBack.position.set(0, 0.08, zBack + 0.12);
          this.trackGroup.add(warnEdgeBack);

          // (b) 兩端懸崖斷面牆 + 肋條 + 斷面燈帶
          [zFront, zBack].forEach((cz) => {
            const cliffWall = new THREE.Mesh(cliffWallGeo, hullSideMat);
            cliffWall.position.set(0, -1.45, cz);
            this.trackGroup.add(cliffWall);

            [-0.95, 0, 0.95].forEach((rx) => {
              const rib = new THREE.Mesh(cliffRibGeo, girderMat);
              rib.position.set(rx, -1.45, cz);
              this.trackGroup.add(rib);
            });

            const cliffGlowStrip = new THREE.Mesh(cliffWarnStripGeo, warnNeonMat);
            cliffGlowStrip.position.set(0, -0.55, cz);
            this.trackGroup.add(cliffGlowStrip);
          });

          // (c) 往下漸暗的側面/端面帷幕與深淵霧層（長度配合 GAP_LEN）
          const mistPlane = new THREE.Mesh(abyssMistGeo, abyssMistMat);
          mistPlane.position.set(0, -2.6, midZ);
          this.trackGroup.add(mistPlane);

          const curtainL = new THREE.Mesh(curtainSideGeo, chasmCurtainMat);
          curtainL.position.set(-TRACK_WIDTH * 0.48, -4.1, midZ);
          this.trackGroup.add(curtainL);

          const curtainR = new THREE.Mesh(curtainSideGeo, chasmCurtainMat);
          curtainR.position.set(TRACK_WIDTH * 0.48, -4.1, midZ);
          this.trackGroup.add(curtainR);

          const curtainF = new THREE.Mesh(curtainEndGeo, chasmCurtainMat);
          curtainF.position.set(0, -4.1, zFront + 0.08);
          this.trackGroup.add(curtainF);

          const curtainB = new THREE.Mesh(curtainEndGeo, chasmCurtainMat);
          curtainB.position.set(0, -4.1, zBack - 0.08);
          this.trackGroup.add(curtainB);

          // (d) 坑底紅橘發光面與光暈（y = -7.6）
          const abyssBottom = new THREE.Mesh(abyssBottomGeo, abyssBottomMat);
          abyssBottom.position.set(0, -7.6, midZ);
          this.trackGroup.add(abyssBottom);

          const abyssCore = new THREE.Mesh(abyssCoreGeo, abyssCoreMat);
          abyssCore.position.set(0, -7.56, midZ);
          this.trackGroup.add(abyssCore);

          const abyssGlow = createGlowSprite(0xf97316, 4.5, 0.9);
          abyssGlow.position.set(0, -7.1, midZ);
          this.trackGroup.add(abyssGlow);

          // (e) 落地區提示：洞後緣 zBack 到該 gap 格中心 z 之間的落腳平台上，加扁平貼地標線與箭頭（y ≈ 0.012）
          const landingBar = new THREE.Mesh(landingBarGeo, landingMarkMat);
          landingBar.position.set(0, 0.012, z - 0.68);
          this.trackGroup.add(landingBar);

          const chevronL = new THREE.Mesh(landingChevronArmGeo, landingMarkMat);
          chevronL.position.set(-0.18, 0.012, z - 0.54);
          chevronL.rotation.y = -0.45;
          this.trackGroup.add(chevronL);

          const chevronR = new THREE.Mesh(landingChevronArmGeo, landingMarkMat);
          chevronR.position.set(0.18, 0.012, z - 0.54);
          chevronR.rotation.y = 0.45;
          this.trackGroup.add(chevronR);

          const landingSideL = new THREE.Mesh(landingSideGeo, landingMarkMat);
          landingSideL.position.set(-0.72, 0.012, z - 0.36);
          this.trackGroup.add(landingSideL);

          const landingSideR = new THREE.Mesh(landingSideGeo, landingMarkMat);
          landingSideR.position.set(0.72, 0.012, z - 0.36);
          this.trackGroup.add(landingSideR);
        }

        // 1. Low Barrier：一看就是「實體箱型路障」（高約 0.54m，加頂部雷射條 <= 0.62m）
        if (type === TILE.LOW) {
          const barrierGroup = new THREE.Group();
          barrierGroup.position.set(0, 0, midZ);

          // 1a. 深色重型底座
          const basePlate = new THREE.Mesh(barrierBaseGeo, hullSideMat);
          basePlate.position.set(0, 0.03, 0);
          barrierGroup.add(basePlate);

          // 1b. 實心箱型路障主體（黃黑斜紋貼圖，高度 0.06 ~ 0.52）
          const hazardBox = new THREE.Mesh(barrierBoxGeo, hazardMat);
          hazardBox.position.set(0, 0.29, 0);
          barrierGroup.add(hazardBox);

          // 1c. 頂部深色裝甲壓條與垂直護肋（強化立體箱型結構感）
          const topCap = new THREE.Mesh(barrierCapGeo, girderMat);
          topCap.position.set(0, 0.53, 0);
          barrierGroup.add(topCap);

          [-0.75, 0.75].forEach((rx) => {
            const rib = new THREE.Mesh(barrierRibGeo, pylonMat);
            rib.position.set(rx, 0.29, 0);
            barrierGroup.add(rib);
          });

          // 1d. 兩端短柱 + 閃爍琥珀燈
          const bollardL = new THREE.Mesh(bollardGeo, pylonMat);
          bollardL.position.set(-TRACK_WIDTH * 0.47, 0.29, 0);
          barrierGroup.add(bollardL);

          const bollardR = new THREE.Mesh(bollardGeo, pylonMat);
          bollardR.position.set(TRACK_WIDTH * 0.47, 0.29, 0);
          barrierGroup.add(bollardR);

          const beaconL = createGlowSprite(0xf59e0b, 1.25, 0.95);
          beaconL.position.set(-TRACK_WIDTH * 0.47, 0.62, 0);
          barrierGroup.add(beaconL);

          const beaconR = createGlowSprite(0xf59e0b, 1.25, 0.95);
          beaconR.position.set(TRACK_WIDTH * 0.47, 0.62, 0);
          barrierGroup.add(beaconR);

          // 1e. 頂部雷射條（配合路障高度設於 Y = 0.58，總高約 0.625 < 0.65）
          const rail = new THREE.Mesh(railGeo, lowBarrierLaserMat);
          rail.position.set(0, 0.58, 0);
          barrierGroup.add(rail);

          const centerGlow = createGlowSprite(0xef4444, 1.9, 0.65);
          centerGlow.position.set(0, 0.58, 0);
          barrierGroup.add(centerGlow);

          // 1f. 前方地面警示貼條
          const warnDeck = new THREE.Mesh(warnDeckGeo, warnDeckMat);
          warnDeck.position.set(0, 0.015, -0.58);
          barrierGroup.add(warnDeck);

          this.obstaclesGroup.add(barrierGroup);
          this.lowBarriers.push({ beaconL, beaconR, centerGlow });
        }

        // 2. High Hurdle (slide under the plasma bar)
        if (type === TILE.HIGH) {
          const hurdleGroup = new THREE.Group();
          hurdleGroup.position.set(0, 0, midZ);

          // Side pylons located completely outside the track lane
          const pylonL = new THREE.Mesh(highPylonGeo, pylonMat);
          pylonL.position.set(-TRACK_WIDTH * 0.56, 1.25, 0);
          hurdleGroup.add(pylonL);

          const pylonR = new THREE.Mesh(highPylonGeo, pylonMat);
          pylonR.position.set(TRACK_WIDTH * 0.56, 1.25, 0);
          hurdleGroup.add(pylonR);

          // Emitter cap glows
          const glowL = createGlowSprite(0xa855f7, 1.1, 0.92);
          glowL.position.set(-TRACK_WIDTH * 0.56, 2.4, 0);
          hurdleGroup.add(glowL);

          const glowR = createGlowSprite(0xa855f7, 1.1, 0.92);
          glowR.position.set(TRACK_WIDTH * 0.56, 2.4, 0);
          hurdleGroup.add(glowR);

          // Suspended plasma laser bar at height Y = 1.35
          const bar = new THREE.Mesh(highBarGeo, highBeamMat);
          bar.position.set(0, 1.35, 0);
          hurdleGroup.add(bar);

          // 加強橫桿光暈（中央主光暈 + 兩側能量光暈）
          const beamGlowCenter = createGlowSprite(0xa855f7, 3.2, 0.85);
          beamGlowCenter.position.set(0, 1.35, 0);
          hurdleGroup.add(beamGlowCenter);

          if (!isLowPerf) {
            const beamGlowL = createGlowSprite(0xc084fc, 2.2, 0.7);
            beamGlowL.position.set(-TRACK_WIDTH * 0.3, 1.35, 0);
            hurdleGroup.add(beamGlowL);

            const beamGlowR = createGlowSprite(0xc084fc, 2.2, 0.7);
            beamGlowR.position.set(TRACK_WIDTH * 0.3, 1.35, 0);
            hurdleGroup.add(beamGlowR);
          }

          this.obstaclesGroup.add(hurdleGroup);
        }
      }
    });

    this.group.add(this.trackGroup);
    this.group.add(this.obstaclesGroup);
  }

  resetAstronautPose() {
    if (!this.character) return;
    const u = this.character.userData;
    if (!u) return;

    if (u.pelvis) u.pelvis.position.set(0, 0.78, 0);
    if (u.torsoGroup) u.torsoGroup.rotation.set(0, 0, 0);
    if (u.headGroup) u.headGroup.rotation.set(0, 0, 0);

    if (u.leftLeg) u.leftLeg.rotation.set(0, 0, 0);
    if (u.leftKnee) u.leftKnee.rotation.set(0, 0, 0);
    if (u.rightLeg) u.rightLeg.rotation.set(0, 0, 0);
    if (u.rightKnee) u.rightKnee.rotation.set(0, 0, 0);

    if (u.leftArm) u.leftArm.rotation.set(0, 0, 0);
    if (u.leftElbow) u.leftElbow.rotation.set(-0.2, 0, 0);
    if (u.rightArm) u.rightArm.rotation.set(0, 0, 0);
    if (u.rightElbow) u.rightElbow.rotation.set(-0.2, 0, 0);

    if (u.flameMeshL) u.flameMeshL.visible = false;
    if (u.flameMeshR) u.flameMeshR.visible = false;

    if (u.slideSparks) {
      u.slideSparks.children.forEach((s) => (s.visible = false));
    }
  }

  resetRoverToStart() {
    this.isAnimating = false;
    this.framesQueue = [];
    this.currentFrame = null;
    this.frameTimer = 0;
    this.idleTimer = 0;
    this.fallHoleZ = null;
    this.restoreMinPolarAngle();

    if (this.character) {
      this.character.position.set(0, this.characterBaseY, 0);
      this.character.rotation.set(0, 0, 0);
      this.resetAstronautPose();
    }
  }

  reset() {
    this.restoreMinPolarAngle();
    this.resetRoverToStart();
    this.resetCamera();
  }

  dispose() {
    this.restoreMinPolarAngle();
    super.dispose();
  }

  /**
   * 換一條賽道（創作模式）；不傳 tiles 就換回訓練場 A。
   * 舊的賽道與障礙物會先釋放掉再重建。
   */
  setCourse(tiles = null, id = 'A') {
    const next = tiles ? { id, tiles } : PARKOUR_COURSES[0];
    if (this.course.id === next.id && this.course.tiles.join() === next.tiles.join()) return;
    for (const g of [this.trackGroup, this.obstaclesGroup]) {
      if (!g) continue;
      g.traverse((obj) => {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material?.dispose();
      });
      this.group.remove(g);
    }
    this.finishPad = null;
    this.course = next;
    this.buildTrack();
    this.reset();
  }

  handleAction(actionType, payload = {}) {
    if (actionType === 'RESET_SCENE' || actionType === 'RESET_POSITION' || actionType === 'RESET') {
      this.reset();
      return;
    }

    if (actionType === 'SET_COURSE') {
      this.setCourse(payload.tiles || null, payload.courseId || 'A');
      return;
    }

    if (actionType === 'EXECUTE_START') {
      this.resetRoverToStart();
      const inner = payload.payload || payload || {};
      const apiCalls = inner.apiCalls || [];
      const call = apiCalls.find((c) => c.api === 'runner.setAutoRun');

      const runs = call?.runs || [];
      const courseRun = runs.find((r) => r.courseId === this.course.id);

      if (courseRun && courseRun.frames && courseRun.frames.length > 0) {
        this.framesQueue = [...courseRun.frames];
        this.isAnimating = true;
        this.advanceFrame();
      }

      try {
        soundManager.playEngine();
      } catch (e) {}
    } else if (actionType === 'LEVEL_SUCCESS') {
      // Level success handling
    } else if (actionType === 'LEVEL_FAIL') {
      // Level fail handling
    }
  }

  advanceFrame() {
    if (this.framesQueue.length === 0) {
      this.isAnimating = false;
      this.currentFrame = null;
      this.resetAstronautPose();
      return;
    }

    this.currentFrame = this.framesQueue.shift();
    this.frameTimer = 0;

    const fromZ = this.currentFrame.x * STEP_LEN;
    const toZ = (this.currentFrame.x + 1) * STEP_LEN;

    this.startPos.set(0, this.characterBaseY, fromZ);
    this.targetPos.set(0, this.characterBaseY, toZ);
  }

  update(delta) {
    // 1. Animate finish pad hologram & low barrier pulsating beacons
    if (this.finishPad && this.finishPad.userData.holo) {
      this.finishPad.userData.holo.rotation.z += delta * 1.4;
    }

    if (this.lowBarriers && this.lowBarriers.length > 0) {
      this.pulseTimer += delta;
      const pulse = 1.0 + Math.sin(this.pulseTimer * 8.0) * 0.25;
      for (const b of this.lowBarriers) {
        if (b.beaconL) b.beaconL.scale.set(1.25 * pulse, 1.25 * pulse, 1);
        if (b.beaconR) b.beaconR.scale.set(1.25 * pulse, 1.25 * pulse, 1);
        if (b.centerGlow) b.centerGlow.scale.set(1.9 * pulse, 1.9 * pulse, 1);
      }
    }

    const u = this.character ? this.character.userData : null;
    if (!u) return;

    const hasFallenIntoAbyss = this.character.position.y < -0.5;

    // 2. Idle ready animation when waiting at start
    if (!this.isAnimating && !hasFallenIntoAbyss) {
      this.idleTimer += delta;
      const breath = Math.sin(this.idleTimer * 2.2);
      if (u.torsoGroup) u.torsoGroup.rotation.x = breath * 0.03;
      if (u.leftArm) u.leftArm.rotation.x = breath * 0.04;
      if (u.rightArm) u.rightArm.rotation.x = -breath * 0.04;
      if (u.flameMeshL) u.flameMeshL.visible = false;
      if (u.flameMeshR) u.flameMeshR.visible = false;
      if (u.slideSparks) u.slideSparks.children.forEach((s) => (s.visible = false));
      return;
    }

    // 3. Active step animation along frames
    if (this.isAnimating && this.currentFrame) {
      this.frameTimer += delta;
      const progress = Math.min(1.0, this.frameTimer / this.frameDuration);

      const act = this.currentFrame.action;
      const ok = this.currentFrame.ok;
      const reason = this.currentFrame.reason;

      // Forward travel in Z
      let curZ = THREE.MathUtils.lerp(this.startPos.z, this.targetPos.z, progress);
      let curY = this.characterBaseY;
      let wholeBodyRotX = 0;
      let wholeBodyRotZ = 0;

      // ─── ACTION: RUN ───
      if (act === ACTION.RUN) {
        // Double stride cycle over 1 frame
        const cycle = progress * Math.PI * 2;
        const swing = Math.sin(cycle) * 0.75;

        // Legs
        u.leftLeg.rotation.x = swing;
        u.leftKnee.rotation.x = Math.max(0, -swing * 0.95);
        u.rightLeg.rotation.x = -swing;
        u.rightKnee.rotation.x = Math.max(0, swing * 0.95);

        // Arms counter-swing
        u.leftArm.rotation.x = -swing * 0.65;
        u.leftArm.rotation.z = -0.15;
        u.leftElbow.rotation.x = -0.45 - Math.max(0, swing * 0.4);
        u.rightArm.rotation.x = swing * 0.65;
        u.rightArm.rotation.z = 0.15;
        u.rightElbow.rotation.x = -0.45 - Math.max(0, -swing * 0.4);

        // Torso forward lean & bouncy stride
        u.torsoGroup.rotation.x = 0.18;
        u.pelvis.position.y = 0.78 + Math.abs(Math.sin(cycle)) * 0.08;

        u.flameMeshL.visible = false;
        u.flameMeshR.visible = false;
        u.slideSparks.children.forEach((s) => (s.visible = false));
      }

      // ─── ACTION: JUMP (飛躍障礙 / 跨越深淵) ───
      else if (act === ACTION.JUMP) {
        // Parabolic arc: peak = 1.35m at progress = 0.5
        const jumpArc = Math.sin(progress * Math.PI);
        const jumpHeight = 1.35;
        curY += jumpArc * jumpHeight;
        u.pelvis.position.y = 0.78 + jumpArc * 0.2;

        // In-air athletic parkour leap pose:
        // Right leg tucked up forward, left leg tucked back
        u.rightLeg.rotation.x = -0.75;
        u.rightKnee.rotation.x = 0.45;
        u.leftLeg.rotation.x = 0.60;
        u.leftKnee.rotation.x = 0.95;

        // Arms raised wide for flight balance
        u.leftArm.rotation.x = -0.65;
        u.leftArm.rotation.z = -0.40;
        u.leftElbow.rotation.x = -0.35;

        u.rightArm.rotation.x = -0.65;
        u.rightArm.rotation.z = 0.40;
        u.rightElbow.rotation.x = -0.35;

        u.torsoGroup.rotation.x = -0.06;

        // Jetpack thrusters flame burst during jump
        const flameScale = jumpArc * 1.2;
        u.flameMeshL.visible = true;
        u.flameMeshR.visible = true;
        u.flameMeshL.scale.set(flameScale, flameScale, flameScale);
        u.flameMeshR.scale.set(flameScale, flameScale, flameScale);

        u.slideSparks.children.forEach((s) => (s.visible = false));
      }

      // ─── ACTION: SLIDE (極限滑壘 / 深度壓低身形) ───
      else if (act === ACTION.SLIDE) {
        // Dramatic baseball slide:
        // Fast drop into slide, hold low under high bar, pop up as frame completes
        const slideIntensity = Math.sin(progress * Math.PI);

        // Pelvis height drops from 0.78 down to 0.22!
        u.pelvis.position.y = THREE.MathUtils.lerp(0.78, 0.22, slideIntensity);

        // Torso leans heavily backward (-66 deg) to duck under high laser beam!
        u.torsoGroup.rotation.x = -1.15 * slideIntensity;
        // Head looks forward to see the track ahead
        u.headGroup.rotation.x = 0.85 * slideIntensity;

        // Lead leg (right) shoots straight forward flat along the deck
        u.rightLeg.rotation.x = -1.52 * slideIntensity;
        u.rightKnee.rotation.x = 0.05;

        // Trail leg (left) folds under hip
        u.leftLeg.rotation.x = 0.72 * slideIntensity;
        u.leftKnee.rotation.x = 1.38 * slideIntensity;

        // Left arm drags along the deck for power-slide balance
        u.leftArm.rotation.x = -0.85 * slideIntensity;
        u.leftArm.rotation.z = -0.35 * slideIntensity;
        u.leftElbow.rotation.x = -0.25;

        // Right arm balances backward
        u.rightArm.rotation.x = -0.65 * slideIntensity;
        u.rightArm.rotation.z = 0.35 * slideIntensity;
        u.rightElbow.rotation.x = -0.25;

        // Jetpack fires forward-facing thrusters for slide speed
        u.flameMeshL.visible = slideIntensity > 0.25;
        u.flameMeshR.visible = slideIntensity > 0.25;
        const thrusterSize = slideIntensity * 0.9;
        u.flameMeshL.scale.set(thrusterSize, thrusterSize, thrusterSize);
        u.flameMeshR.scale.set(thrusterSize, thrusterSize, thrusterSize);

        // Glowing friction sparks trail behind sliding boots
        u.slideSparks.children.forEach((s) => {
          s.visible = slideIntensity > 0.25;
          s.position.set(
            (Math.random() - 0.5) * 0.3,
            0.05,
            -0.2 - Math.random() * 0.5
          );
        });
      }

      // ─── FAIL CONSEQUENCES ───
      const fallStartProg = (STEP_LEN * 0.5 - GAP_LEN * 0.5) / STEP_LEN; // 0.25（跑到洞前緣才開始下墜）
      if (!ok && reason === 'FALL' && progress > fallStartProg) {
        const failProg = (progress - fallStartProg) / (1.0 - fallStartProg);
        const holeZ = this.startPos.z + STEP_LEN * 0.5;
        const frontEdgeZ = holeZ - GAP_LEN * 0.5;
        this.fallHoleZ = holeZ;

        // z 以 ease-out 前進並停在洞中心 holeZ，不穿進洞的前後斷面牆
        const easeOutZ = 1.0 - (1.0 - failProg) * (1.0 - failProg);
        curZ = THREE.MathUtils.lerp(frontEdgeZ, holeZ, easeOutZ);

        // y 加速下墜至約 -6.6（坑底發光面在 -7.6，停在它上方）
        const fallCurve = 0.35 * failProg + 0.65 * failProg * failProg;
        curY = this.characterBaseY - fallCurve * 6.6;

        wholeBodyRotX = failProg * 2.8;
        wholeBodyRotZ = Math.sin(failProg * 10.0) * 0.35;
        u.leftArm.rotation.x = -2.2;
        u.rightArm.rotation.x = -2.2;
        u.leftArm.rotation.z = -0.5;
        u.rightArm.rotation.z = 0.5;
        u.flameMeshL.visible = false;
        u.flameMeshR.visible = false;
        u.slideSparks.children.forEach((s) => (s.visible = false));
      } else if (!ok && reason !== 'FALL' && progress > 0.45) {
        const failProg = (progress - 0.45) / 0.55;
        if (reason === 'TRIP') {
          // Trip forward over low obstacle
          curY += Math.sin(failProg * Math.PI) * 0.8;
          wholeBodyRotX = failProg * 3.0; // pitch forward roll
        } else if (reason === 'HIT') {
          // Recoil backward from high plasma bar
          wholeBodyRotX = -failProg * 1.8;
          wholeBodyRotZ = Math.sin(failProg * 25) * 0.3;
        } else {
          wholeBodyRotZ = failProg * 4.0;
        }
      }

      this.character.position.set(0, curY, curZ);
      this.character.rotation.set(wholeBodyRotX, 0, wholeBodyRotZ);

      // Frame completion
      if (progress >= 1.0) {
        if (!ok) {
          this.isAnimating = false;
          if (u.flameMeshL) u.flameMeshL.visible = false;
          if (u.flameMeshR) u.flameMeshR.visible = false;
          if (u.slideSparks) u.slideSparks.children.forEach((s) => (s.visible = false));
          try {
            soundManager.playError();
          } catch (e) {}
        } else {
          this.advanceFrame();
        }
      }
    }

    // 4. Smooth Third-Person Camera Follow
    if (this.character && this.sceneManager && this.sceneManager.cameraController) {
      const cam = this.sceneManager.cameraController.camera;
      const controls = this.sceneManager.cameraController.controls;

      // Dynamic camera position adjusts during slide, jump, or abyss fall
      let camTargetY = this.camOffset.y;
      let camTargetZ = this.character.position.z + this.camOffset.z;
      let lookTargetY = this.lookOffset.y;
      let lookTargetZ = this.character.position.z + this.lookOffset.z;

      if (this.isAnimating && this.currentFrame) {
        if (this.currentFrame.action === ACTION.SLIDE) {
          camTargetY -= 0.4; // Lower camera for intense speed feeling
        } else if (this.currentFrame.action === ACTION.JUMP) {
          camTargetY += 0.35; // Raise camera slightly to track soaring arc
        }
      }

      // 若角色墜入缺口深淵（y < -0.3），暫時將 controls.minPolarAngle 設為 0.02，
      // 讓相機從洞正上方往下俯視角色，避免視線被 2 單位寬的缺口斷面牆擋住
      if (this.character.position.y < -0.3) {
        if (controls) {
          controls.minPolarAngle = 0.02;
        }
        const holeZ = this.fallHoleZ ?? (this.startPos.z + STEP_LEN * 0.5);
        camTargetY = 7.5;
        camTargetZ = holeZ - 1.2;
        lookTargetY = -4.0;
        lookTargetZ = holeZ + 0.3;
      }

      const targetCamPos = new THREE.Vector3(
        this.camOffset.x,
        camTargetY,
        camTargetZ
      );
      const targetLookPos = new THREE.Vector3(
        this.lookOffset.x,
        lookTargetY,
        lookTargetZ
      );

      const lerpSpeed = this.character.position.y < -0.3 ? delta * 5.5 : delta * 4.0;
      cam.position.lerp(targetCamPos, lerpSpeed);
      if (controls) {
        controls.target.lerp(targetLookPos, lerpSpeed);
      }
    }
  }
}
