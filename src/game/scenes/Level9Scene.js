/**
 * Star Rover Odyssey - Level 9 Scene: 太空站跑酷 (3D Third-Person Parkour)
 *
 * 第三人稱 3D 跑酷視角：探測車在懸浮軌道上前進，相機從後方平滑追隨。
 * 軌道由 Course A（訓練場）構成：
 * - ground: 懸浮科技跑道
 * - gap: 斷崖缺口（需 jump 躍過）
 * - low: 低矮能量柵欄（需 jump 躍過）
 * - high: 高空光能橫桿（需 slide 滑過）
 * - finish: 逃生停機坪與旋轉信標
 */

import * as THREE from 'three';
import { BaseGameScene } from './BaseGameScene.js';
import { createSciFiRover, createSciFiGrid, createLandingPad, createTextTexture } from '../models/ProceduralMeshes.js';
import { soundManager } from '../core/SoundManager.js';
import { PARKOUR_COURSES, TILE, ACTION } from '../sim/parkour.js';

const STEP_LEN = 3.6;
const TRACK_WIDTH = 3.2;

export class Level9Scene extends BaseGameScene {
  constructor() {
    super(9);
    this.rover = null;
    this.trackGroup = null;
    this.obstaclesGroup = null;
    this.finishPad = null;

    // Simulation animation state
    this.course = PARKOUR_COURSES[0]; // Course A
    this.isAnimating = false;
    this.framesQueue = [];
    this.currentFrame = null;
    this.frameTimer = 0;
    this.frameDuration = 0.36;

    // Transform interpolation
    this.roverBaseY = 0.12;
    this.startPos = new THREE.Vector3();
    this.targetPos = new THREE.Vector3();
    this.startRot = new THREE.Vector3();
    this.targetRot = new THREE.Vector3();

    // Camera follow offsets (Third-person view)
    this.camOffset = new THREE.Vector3(0, 4.5, -8.0);
    this.lookOffset = new THREE.Vector3(0, 1.2, 5.0);
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
    // 1. Ambient sci-fi floor grid
    const ambientGrid = createSciFiGrid(120, 120, 0x6366f1, 0x334155);
    ambientGrid.position.y = -6.0;
    this.group.add(ambientGrid);

    // 2. Build the floating track based on Course A
    this.buildTrack();

    // 3. Rover
    this.rover = createSciFiRover();
    this.rover.scale.set(0.6, 0.6, 0.6);
    this.group.add(this.rover);

    this.reset();
  }

  buildTrack() {
    this.trackGroup = new THREE.Group();
    this.obstaclesGroup = new THREE.Group();

    const tiles = this.course.tiles;
    const tileGeo = new THREE.BoxGeometry(TRACK_WIDTH, 0.3, STEP_LEN - 0.15);

    const normalMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.4
    });

    const borderMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const borderGeo = new THREE.BoxGeometry(TRACK_WIDTH + 0.15, 0.08, STEP_LEN - 0.1);

    // Low obstacle material (crimson energy barrier)
    const lowBarrierMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xd97706,
      emissiveIntensity: 0.65,
      metalness: 0.7,
      roughness: 0.2
    });

    // High hurdle material (cyan plasma bar)
    const highHurdleMat = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x6366f1,
      emissiveIntensity: 0.75,
      metalness: 0.8,
      roughness: 0.2
    });

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.8,
      roughness: 0.3
    });

    tiles.forEach((type, idx) => {
      const z = idx * STEP_LEN;

      // Finish Pad
      if (type === TILE.FINISH) {
        this.finishPad = new THREE.Group();
        this.finishPad.position.set(0, 0, z);

        const pad = createLandingPad(1.8, 0x10b981);
        this.finishPad.add(pad);

        // Hologram ring
        const holoGeo = new THREE.TorusGeometry(1.6, 0.05, 16, 32);
        holoGeo.rotateX(Math.PI / 2);
        const holoMat = new THREE.MeshBasicMaterial({ color: 0x34d399, wireframe: true });
        const holo = new THREE.Mesh(holoGeo, holoMat);
        holo.position.y = 1.2;
        this.finishPad.add(holo);
        this.finishPad.userData.holo = holo;

        this.trackGroup.add(this.finishPad);
        return;
      }

      // If GAP, do not build floor!
      if (type === TILE.GAP) {
        // Build subtle warning border lights on gap edges
        const edgeGeo = new THREE.BoxGeometry(TRACK_WIDTH, 0.1, 0.1);
        const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
        const edgeStart = new THREE.Mesh(edgeGeo, edgeMat);
        edgeStart.position.set(0, 0.1, z - STEP_LEN * 0.45);
        this.trackGroup.add(edgeStart);
        return;
      }

      // Normal ground slab
      const slab = new THREE.Mesh(tileGeo, normalMat);
      slab.position.set(0, -0.15, z);
      this.trackGroup.add(slab);

      const rim = new THREE.Mesh(borderGeo, borderMat);
      rim.position.set(0, 0.01, z);
      this.trackGroup.add(rim);

      // Low barrier
      if (type === TILE.LOW) {
        const barrierGeo = new THREE.BoxGeometry(TRACK_WIDTH * 0.85, 0.55, 0.3);
        const barrier = new THREE.Mesh(barrierGeo, lowBarrierMat);
        barrier.position.set(0, 0.3, z);
        this.obstaclesGroup.add(barrier);
      }

      // High hurdle (two vertical poles + crossbar)
      if (type === TILE.HIGH) {
        const hurdleGroup = new THREE.Group();
        hurdleGroup.position.set(0, 0, z);

        const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 12);
        const poleLeft = new THREE.Mesh(poleGeo, poleMat);
        poleLeft.position.set(-TRACK_WIDTH * 0.45, 1.1, 0);
        hurdleGroup.add(poleLeft);

        const poleRight = new THREE.Mesh(poleGeo, poleMat);
        poleRight.position.set(TRACK_WIDTH * 0.45, 1.1, 0);
        hurdleGroup.add(poleRight);

        // Horizontal crossbar at height 1.55
        const barGeo = new THREE.BoxGeometry(TRACK_WIDTH * 0.95, 0.22, 0.22);
        const bar = new THREE.Mesh(barGeo, highHurdleMat);
        bar.position.set(0, 1.55, 0);
        hurdleGroup.add(bar);

        this.obstaclesGroup.add(hurdleGroup);
      }
    });

    this.group.add(this.trackGroup);
    this.group.add(this.obstaclesGroup);
  }

  resetRoverToStart() {
    this.isAnimating = false;
    this.framesQueue = [];
    this.currentFrame = null;
    this.frameTimer = 0;

    if (this.rover) {
      this.rover.position.set(0, this.roverBaseY, 0);
      this.rover.rotation.set(0, 0, 0); // facing +Z

      const { nameLabel, flame } = this.rover.userData;
      if (flame) flame.material.opacity = 0.3;
      if (nameLabel) {
        nameLabel.material.map = createTextTexture('PARKOUR · 起點整備', '#ffffff', '#2563eb');
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
      const { nameLabel } = this.rover.userData;
      if (nameLabel) {
        nameLabel.material.map = createTextTexture('★ 抵達逃生艙·跑酷成功！', '#ffffff', '#10b981');
        nameLabel.material.needsUpdate = true;
      }
    } else if (actionType === 'LEVEL_FAIL') {
      const { nameLabel } = this.rover.userData;
      if (nameLabel) {
        nameLabel.material.map = createTextTexture('⚠️ 避障失敗·失去平衡', '#ffffff', '#ef4444');
        nameLabel.material.needsUpdate = true;
      }
    }
  }

  advanceFrame() {
    if (this.framesQueue.length === 0) {
      this.isAnimating = false;
      this.currentFrame = null;
      return;
    }

    this.currentFrame = this.framesQueue.shift();
    this.frameTimer = 0;

    const fromZ = this.currentFrame.x * STEP_LEN;
    const toZ = (this.currentFrame.x + 1) * STEP_LEN;

    this.startPos.set(0, this.roverBaseY, fromZ);
    this.targetPos.set(0, this.roverBaseY, toZ);
    this.startRot.set(0, 0, 0);
    this.targetRot.set(0, 0, 0);

    const { nameLabel, flame } = this.rover.userData;
    if (flame) flame.material.opacity = 0.8;

    const act = this.currentFrame.action;
    const ahead = this.currentFrame.ahead;

    if (nameLabel) {
      const actText = act === ACTION.JUMP ? '🦘 JUMP 跳躍' : act === ACTION.SLIDE ? '⚡ SLIDE 滑行' : '🏃 RUN 疾跑';
      nameLabel.material.map = createTextTexture(`[${ahead}] ➔ ${actText}`, '#ffffff', '#0284c7');
      nameLabel.material.needsUpdate = true;
    }
  }

  update(delta) {
    // 1. Animate finish hologram
    if (this.finishPad && this.finishPad.userData.holo) {
      this.finishPad.userData.holo.rotation.z += delta * 1.2;
    }

    // 2. Animate Rover along course frames
    if (this.isAnimating && this.currentFrame && this.rover) {
      this.frameTimer += delta;
      const progress = Math.min(1.0, this.frameTimer / this.frameDuration);

      const act = this.currentFrame.action;
      const ok = this.currentFrame.ok;
      const reason = this.currentFrame.reason;

      // Linear motion in Z
      const curZ = THREE.MathUtils.lerp(this.startPos.z, this.targetPos.z, progress);
      let curY = this.roverBaseY;
      let rotX = 0;
      let rotZ = 0;

      if (act === ACTION.JUMP) {
        // Parabolic jump trajectory: peak at progress = 0.5
        const jumpHeight = 1.6;
        curY += Math.sin(progress * Math.PI) * jumpHeight;
        rotX = -Math.sin(progress * Math.PI * 2) * 0.25;
      } else if (act === ACTION.SLIDE) {
        // Slide low profile: lower Y slightly, pitch down
        curY = this.roverBaseY - 0.05;
        rotX = -0.15;
      }

      // If step failed on this frame
      if (!ok) {
        if (progress > 0.45) {
          if (reason === 'FALL') {
            // Drop down into gap
            curY -= (progress - 0.45) * 8.0;
            rotX = (progress - 0.45) * 4.0;
          } else if (reason === 'TRIP') {
            // Tumble over low barrier
            curY += (progress - 0.45) * 2.0;
            rotX = -(progress - 0.45) * 5.0;
          } else if (reason === 'HIT') {
            // Bounce off high hurdle
            rotZ = Math.sin(progress * 20) * 0.4;
          } else {
            rotZ = (progress - 0.45) * 6.0;
          }
        }
      }

      this.rover.position.set(0, curY, curZ);
      this.rover.rotation.set(rotX, 0, rotZ);

      // Roll wheels
      if (this.rover.userData.wheels) {
        this.rover.userData.wheels.forEach((w) => {
          w.children[0].rotation.x += delta * 15;
        });
      }

      if (progress >= 1.0) {
        if (!ok) {
          // Animation ends on crash
          this.isAnimating = false;
          const { nameLabel, flame } = this.rover.userData;
          if (flame) flame.material.opacity = 0;
          if (nameLabel) {
            nameLabel.material.map = createTextTexture('💥 避障失誤！', '#ffffff', '#ef4444');
            nameLabel.material.needsUpdate = true;
          }
          try {
            soundManager.playError();
          } catch (e) {}
        } else {
          this.advanceFrame();
        }
      }
    }

    // 3. Smooth Camera Third-Person Follow
    if (this.rover && this.sceneManager && this.sceneManager.cameraController) {
      const cam = this.sceneManager.cameraController.camera;
      const controls = this.sceneManager.cameraController.controls;

      const targetCamPos = new THREE.Vector3(
        this.camOffset.x,
        this.camOffset.y,
        this.rover.position.z + this.camOffset.z
      );
      const targetLookPos = new THREE.Vector3(
        this.lookOffset.x,
        this.lookOffset.y,
        this.rover.position.z + this.lookOffset.z
      );

      // Smooth camera interpolation
      cam.position.lerp(targetCamPos, delta * 3.5);
      if (controls) {
        controls.target.lerp(targetLookPos, delta * 3.5);
      }
    }
  }
}
