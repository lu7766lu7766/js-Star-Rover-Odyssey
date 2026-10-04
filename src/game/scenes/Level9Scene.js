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
  createGlowSprite
} from '../models/ProceduralMeshes.js';
import { soundManager } from '../core/SoundManager.js';
import { PARKOUR_COURSES, TILE, ACTION } from '../sim/parkour.js';

const STEP_LEN = 4.0;
const TRACK_WIDTH = 3.2;

export class Level9Scene extends BaseGameScene {
  constructor() {
    super(9);
    this.character = null;
    this.rover = null; // Alias for backward compatibility
    this.trackGroup = null;
    this.obstaclesGroup = null;
    this.finishPad = null;

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

    // Camera follow offsets (Third-person follow view)
    this.camOffset = new THREE.Vector3(0, 3.2, -5.5);
    this.lookOffset = new THREE.Vector3(0, 1.2, 4.0);
  }

  init(sceneManager) {
    this.sceneManager = sceneManager;
    this.build();
    this.resetCamera();
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
    // 1. Ambient deep space grid floor far beneath
    const ambientGrid = createSciFiGrid(140, 140, 0x6366f1, 0x1e293b);
    ambientGrid.position.y = -8.0;
    this.group.add(ambientGrid);

    // 2. Build the floating track based on Course A
    this.buildTrack();

    // 3. Humanoid Sci-Fi Astronaut character
    this.character = createSciFiAstronaut();
    this.rover = this.character; // alias for compatibility
    this.character.scale.set(0.95, 0.95, 0.95);
    this.group.add(this.character);

    this.reset();
  }

  buildTrack() {
    this.trackGroup = new THREE.Group();
    this.obstaclesGroup = new THREE.Group();

    const tiles = this.course.tiles;

    // Normal deck slab material
    const normalMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.25,
      metalness: 0.45
    });

    const borderMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    // Low obstacle material (crimson/orange laser gate)
    const lowBarrierMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xd97706,
      emissiveIntensity: 0.85,
      metalness: 0.7,
      roughness: 0.2
    });

    // High hurdle material (violet plasma beam)
    const highBeamMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x9333ea,
      emissiveIntensity: 1.4,
      metalness: 0.5,
      roughness: 0.1
    });

    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25
    });

    const tileCount = tiles.length;

    tiles.forEach((type, idx) => {
      const z = idx * STEP_LEN;

      // Finish Pad at last tile
      if (type === TILE.FINISH) {
        this.finishPad = new THREE.Group();
        this.finishPad.position.set(0, 0, z);

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

      // Check if current tile is a GAP
      const isGap = type === TILE.GAP;

      if (!isGap) {
        // Solid runway platform slab
        const slabGeo = new THREE.BoxGeometry(TRACK_WIDTH, 0.3, STEP_LEN - 0.25);
        const slab = new THREE.Mesh(slabGeo, normalMat);
        slab.position.set(0, -0.15, z);
        this.trackGroup.add(slab);

        // Neon glowing side edges
        const leftRim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, STEP_LEN - 0.2), borderMat);
        leftRim.position.set(-TRACK_WIDTH * 0.49, 0.02, z);
        this.trackGroup.add(leftRim);

        const rightRim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, STEP_LEN - 0.2), borderMat);
        rightRim.position.set(TRACK_WIDTH * 0.49, 0.02, z);
        this.trackGroup.add(rightRim);

        // Center runway dashed guide
        const centerLine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, STEP_LEN * 0.45), lineMat);
        centerLine.position.set(0, 0.01, z);
        this.trackGroup.add(centerLine);
      } else {
        // Gap edge warning lights on incoming & outgoing borders
        const warnMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
        const edgeStart = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH, 0.08, 0.1), warnMat);
        edgeStart.position.set(0, 0.04, z - STEP_LEN * 0.45);
        this.trackGroup.add(edgeStart);

        const edgeEnd = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH, 0.08, 0.1), warnMat);
        edgeEnd.position.set(0, 0.04, z + STEP_LEN * 0.45);
        this.trackGroup.add(edgeEnd);
      }

      // Obstacle placement:
      // Obstacle for step idx -> idx + 1 or on arrival at tile idx:
      // We place obstacles at the TRANSIT MIDPOINT so the player jumps or slides right through them!
      // When at idx - 1, player looks ahead at type = tiles[idx].
      // The obstacle is placed at z = (idx - 0.5) * STEP_LEN.
      if (idx > 0) {
        const obstacleZ = (idx - 0.5) * STEP_LEN;

        // 1. Low Barrier (jump over it at peak of jump)
        if (type === TILE.LOW) {
          const barrierGroup = new THREE.Group();
          barrierGroup.position.set(0, 0, obstacleZ);

          // Base stands
          const standL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.4), pylonMat);
          standL.position.set(-TRACK_WIDTH * 0.46, 0.17, 0);
          barrierGroup.add(standL);

          const standR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.4), pylonMat);
          standR.position.set(TRACK_WIDTH * 0.46, 0.17, 0);
          barrierGroup.add(standR);

          // Glowing energy hurdle (height 0.40, easily cleared by 1.35m jump)
          const barGeo = new THREE.BoxGeometry(TRACK_WIDTH * 0.90, 0.38, 0.18);
          const barrier = new THREE.Mesh(barGeo, lowBarrierMat);
          barrier.position.set(0, 0.20, 0);
          barrierGroup.add(barrier);

          // Amber pulse light
          const light = createGlowSprite(0xf59e0b, 1.2, 0.8);
          light.position.set(0, 0.35, 0);
          barrierGroup.add(light);

          this.obstaclesGroup.add(barrierGroup);
        }

        // 2. High Hurdle (slide under the plasma bar)
        if (type === TILE.HIGH) {
          const hurdleGroup = new THREE.Group();
          hurdleGroup.position.set(0, 0, obstacleZ);

          // Side pylons located completely outside the track lane
          const pylonGeo = new THREE.CylinderGeometry(0.12, 0.14, 2.5, 16);
          const pylonL = new THREE.Mesh(pylonGeo, pylonMat);
          pylonL.position.set(-TRACK_WIDTH * 0.56, 1.25, 0);
          hurdleGroup.add(pylonL);

          const pylonR = new THREE.Mesh(pylonGeo, pylonMat);
          pylonR.position.set(TRACK_WIDTH * 0.56, 1.25, 0);
          hurdleGroup.add(pylonR);

          // Emitter cap glows
          const glowL = createGlowSprite(0xa855f7, 0.9, 0.9);
          glowL.position.set(-TRACK_WIDTH * 0.56, 2.4, 0);
          hurdleGroup.add(glowL);

          const glowR = createGlowSprite(0xa855f7, 0.9, 0.9);
          glowR.position.set(TRACK_WIDTH * 0.56, 2.4, 0);
          hurdleGroup.add(glowR);

          // Suspended plasma laser bar at height Y = 1.35
          // Standing runner (1.6m) hits chest/head; sliding runner (<0.45m) slides cleanly under!
          const barGeo = new THREE.CylinderGeometry(0.09, 0.09, TRACK_WIDTH * 1.12, 16);
          barGeo.rotateZ(Math.PI / 2);
          const bar = new THREE.Mesh(barGeo, highBeamMat);
          bar.position.set(0, 1.35, 0);
          hurdleGroup.add(bar);

          // Additive beam glow sprite along center of bar
          const beamGlow = createGlowSprite(0x8b5cf6, 2.8, 0.65);
          beamGlow.position.set(0, 1.35, 0);
          hurdleGroup.add(beamGlow);

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

    if (this.character) {
      this.character.position.set(0, this.characterBaseY, 0);
      this.character.rotation.set(0, 0, 0);
      this.resetAstronautPose();
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
      const apiCalls = inner.apiCalls || [];
      const call = apiCalls.find((c) => c.api === 'runner.setAutoRun');

      const runs = call?.runs || [];
      const courseRun = runs.find((r) => r.courseId === 'A');

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
    // 1. Animate finish pad hologram
    if (this.finishPad && this.finishPad.userData.holo) {
      this.finishPad.userData.holo.rotation.z += delta * 1.4;
    }

    const u = this.character ? this.character.userData : null;
    if (!u) return;

    // 2. Idle ready animation when waiting at start
    if (!this.isAnimating) {
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

      // Forward travel in Z (smooth cubic ease in-out)
      const curZ = THREE.MathUtils.lerp(this.startPos.z, this.targetPos.z, progress);
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
        u.slideSparks.children.forEach((s, idx) => {
          s.visible = slideIntensity > 0.25;
          s.position.set(
            (Math.random() - 0.5) * 0.3,
            0.05,
            -0.2 - Math.random() * 0.5
          );
        });
      }

      // ─── FAIL CONSEQUENCES ───
      if (!ok && progress > 0.45) {
        const failProg = (progress - 0.45) / 0.55;
        if (reason === 'FALL') {
          // Plunge down into deep chasm
          curY -= failProg * 8.0;
          wholeBodyRotX = failProg * 3.5;
          u.leftArm.rotation.x = 1.2;
          u.rightArm.rotation.x = 1.2;
        } else if (reason === 'TRIP') {
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

      // Dynamic camera position adjusts during slide or jump
      let camTargetY = this.camOffset.y;
      if (this.isAnimating && this.currentFrame) {
        if (this.currentFrame.action === ACTION.SLIDE) {
          camTargetY -= 0.4; // Lower camera for intense speed feeling
        } else if (this.currentFrame.action === ACTION.JUMP) {
          camTargetY += 0.35; // Raise camera slightly to track soaring arc
        }
      }

      const targetCamPos = new THREE.Vector3(
        this.camOffset.x,
        camTargetY,
        this.character.position.z + this.camOffset.z
      );
      const targetLookPos = new THREE.Vector3(
        this.lookOffset.x,
        this.lookOffset.y,
        this.character.position.z + this.lookOffset.z
      );

      cam.position.lerp(targetCamPos, delta * 4.0);
      if (controls) {
        controls.target.lerp(targetLookPos, delta * 4.0);
      }
    }
  }
}
