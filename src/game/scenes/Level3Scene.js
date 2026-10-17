/**
 * Level 3 Scene: 雷達自主避障
 */

import * as THREE from 'three';
import { BaseGameScene } from './BaseGameScene.js';
import { createSciFiRover, createSciFiGrid, createAsteroids, createTextTexture } from '../models/ProceduralMeshes.js';
import { soundManager } from '../core/SoundManager.js';

export class Level3Scene extends BaseGameScene {
  constructor() {
    super(3);
    this.rover = null;
    this.asteroids = null;
    this.cratersGroup = null;
    this.radarRing = null;
    this.statusText = 'STANDBY';
    this.simulating = false;
    this.simStep = 0;
    this.stepTimer = 0;

    // 從探測車後方高處俯視，同時納入推進路線（z=-12 → 1.5）與前方隕石群（z=4.5~12.2），隕石沿縱深展開不會疊成一堆
    this.camPos = new THREE.Vector3(-3.5, 18.5, -23.5);
    this.camTarget = new THREE.Vector3(0, 0.5, -1.5);
  }

  init(sceneManager) {
    this.sceneManager = sceneManager;
    this.build();
    this.resetCamera();
  }

  resetCamera() {
    const cc = this.sceneManager?.cameraController;
    if (cc) {
      cc.defaultCamPos.copy(this.camPos);
      cc.defaultTarget.copy(this.camTarget);
      cc.reset(this.camPos, this.camTarget);
    }
  }

  build() {
    const isLow = Boolean(this.sceneManager?.isLowPerformance);

    this.grid = createSciFiGrid(60, 60, 0xa855f7);
    this.group.add(this.grid);

    // 地面隕石撞擊坑（環形凸起山脊 + 凹陷焦黑暗色盤）
    this.buildImpactCraters(isLow);

    this.rover = createSciFiRover();
    this.rover.position.set(0, 0, -12);
    // 讓車頂狀態名牌面向後方鏡頭，方便從後上方斜視角清楚閱讀雷達狀態
    const { nameLabel } = this.rover.userData;
    if (nameLabel) {
      nameLabel.position.z = -0.09;
      nameLabel.rotation.y = Math.PI;
    }
    this.group.add(this.rover);

    // 分布在探測車前進路線前方與兩側的擋路隕石群（最近距離 z=4.6，距停靠點 z=1.5 約 3.1 單位）
    const asteroidConfigs = [
      { x: -1.35, y: 1.05, z: 4.6, scale: 1.0 },
      { x: 1.55, y: 1.15, z: 5.0, scale: 1.12 },
      { x: 0.05, y: 1.4, z: 6.4, scale: 1.45 },
      { x: -3.1, y: 1.25, z: 6.9, scale: 1.25 },
      { x: 3.25, y: 1.3, z: 7.6, scale: 1.32 },
      { x: -1.85, y: 1.45, z: 9.2, scale: 1.48 },
      { x: 2.05, y: 1.3, z: 10.3, scale: 1.28 }
    ];
    if (!isLow) {
      asteroidConfigs.push(
        { x: -0.25, y: 1.55, z: 11.6, scale: 1.58 },
        { x: -3.7, y: 1.15, z: 11.2, scale: 1.15 },
        { x: 3.8, y: 1.25, z: 12.0, scale: 1.22 }
      );
    }

    this.asteroids = createAsteroids(asteroidConfigs);
    this.group.add(this.asteroids);

    // Radar scan ring
    const ringGeo = new THREE.RingGeometry(0.8, 1.2, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    this.radarRing = new THREE.Mesh(ringGeo, ringMat);
    this.radarRing.position.set(0, 0.2, -12);
    this.group.add(this.radarRing);

    this.reset();
  }

  /**
   * 在地面建立隕石撞擊坑（環形岩石凸起 + 凹陷暗色坑底盤）
   */
  buildImpactCraters(isLow = false) {
    this.cratersGroup = new THREE.Group();
    this.cratersGroup.name = 'ImpactCraters_ground';

    const rimGeo = new THREE.TorusGeometry(1.0, 0.19, 10, 28);
    rimGeo.rotateX(Math.PI / 2);
    const basinGeo = new THREE.CircleGeometry(0.96, 28);
    basinGeo.rotateX(-Math.PI / 2);
    const innerScorchGeo = new THREE.CircleGeometry(0.55, 20);
    innerScorchGeo.rotateX(-Math.PI / 2);

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x44403c,
      roughness: 0.95,
      metalness: 0.08,
      flatShading: true
    });
    const basinMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.98,
      metalness: 0.02
    });
    const scorchMat = new THREE.MeshStandardMaterial({
      color: 0x292524,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.22,
      roughness: 0.95
    });

    const craterLayouts = [
      { x: -3.2, z: -5.5, r: 1.25 },
      { x: 3.1, z: -1.8, r: 1.4 },
      { x: -1.6, z: 4.7, r: 1.55 },
      { x: 1.9, z: 5.5, r: 1.35 },
      { x: 0.1, z: 7.8, r: 2.1 }
    ];
    if (!isLow) {
      craterLayouts.push(
        { x: -3.5, z: 9.4, r: 1.65 },
        { x: 3.4, z: 10.6, r: 1.5 }
      );
    }

    craterLayouts.forEach((cfg) => {
      const crater = new THREE.Group();
      crater.position.set(cfg.x, 0.01, cfg.z);

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.name = 'crater_rim_ground';
      rim.scale.set(cfg.r, 0.42, cfg.r);
      rim.position.y = 0.04;
      crater.add(rim);

      const basin = new THREE.Mesh(basinGeo, basinMat);
      basin.name = 'crater_basin_ground';
      basin.scale.setScalar(cfg.r);
      basin.position.y = 0.015;
      crater.add(basin);

      const scorch = new THREE.Mesh(innerScorchGeo, scorchMat);
      scorch.name = 'crater_scorch_ground';
      scorch.scale.setScalar(cfg.r);
      scorch.position.y = 0.022;
      crater.add(scorch);

      this.cratersGroup.add(crater);
    });

    this.group.add(this.cratersGroup);
  }

  reset() {
    this.simulating = false;
    this.simStep = 0;
    this.stepTimer = 0;
    this.statusText = 'STANDBY';

    if (this.rover) {
      this.rover.position.set(0, 0, -12);
      const { nameLabel, flame } = this.rover.userData;
      if (nameLabel) {
        nameLabel.material.map = createTextTexture('RADAR: STANDBY', '#ffffff', '#2563eb');
        nameLabel.material.needsUpdate = true;
      }
      if (flame) flame.material.opacity = 0.5;
    }

    if (this.radarRing) {
      this.radarRing.scale.set(1, 1, 1);
      this.radarRing.position.set(0, 0.2, -12);
    }

    this.resetCamera();
  }

  handleAction(actionType, payload = {}) {
    if (actionType === 'RESET_SCENE' || actionType === 'RESET_POSITION' || actionType === 'RESET') {
      this.reset();
      return;
    }

    if (actionType === 'EXECUTE_START') {
      this.reset();
      this.simulating = true;
      this.simStep = 1;
      this.stepTimer = 0;
      try { soundManager.playRadarPing(); } catch (e) {}
    } else if (actionType === 'LEVEL_SUCCESS') {
      this.simulating = true;
      if (this.simStep < 2) this.simStep = 2;
      const { nameLabel } = this.rover.userData;
      if (nameLabel) {
        nameLabel.material.map = createTextTexture('AVOIDANCE VERIFIED', '#ffffff', '#10b981');
        nameLabel.material.needsUpdate = true;
      }
    } else if (actionType === 'LEVEL_FAIL') {
      const { nameLabel } = this.rover.userData;
      if (nameLabel) {
        nameLabel.material.map = createTextTexture('COLLISION ALERT!', '#ffffff', '#ef4444');
        nameLabel.material.needsUpdate = true;
      }
      try { soundManager.playError(); } catch (e) {}
    }
  }

  update(delta) {
    // 隕石群緩慢自轉，增添立體太空岩石感
    const asteroidList = this.asteroids?.userData?.asteroids;
    if (asteroidList) {
      for (let i = 0; i < asteroidList.length; i++) {
        const rock = asteroidList[i];
        rock.rotation.y += delta * (0.14 + (i % 3) * 0.05);
        rock.rotation.x += delta * 0.06 * (i % 2 === 0 ? 1 : -1);
      }
    }

    // Pulse radar ring
    if (this.radarRing && this.rover) {
      this.radarRing.position.x = this.rover.position.x;
      this.radarRing.position.z = this.rover.position.z;
      const s = (this.radarRing.scale.x + delta * 3) % 6;
      this.radarRing.scale.set(s, s, s);
      this.radarRing.material.opacity = Math.max(0, 1 - s / 6);
    }

    // Step-by-step autopilot simulation
    if (this.simulating && this.rover) {
      this.stepTimer += delta;
      const { nameLabel } = this.rover.userData;

      // Stage 1: Full Speed (Distance > 15)
      if (this.simStep === 1) {
        this.rover.position.z += delta * 6;
        if (nameLabel) {
          nameLabel.material.map = createTextTexture('SPEED: FULL_SPEED', '#ffffff', '#10b981');
          nameLabel.material.needsUpdate = true;
        }
        if (this.rover.position.z >= -4) {
          this.simStep = 2;
          this.stepTimer = 0;
          try { soundManager.playRadarPing(); } catch (e) {}
        }
      }
      // Stage 2: Slow Down (5 <= Distance <= 15)
      else if (this.simStep === 2) {
        this.rover.position.z += delta * 2.5;
        if (nameLabel) {
          nameLabel.material.map = createTextTexture('SPEED: SLOW_DOWN', '#ffffff', '#f59e0b');
          nameLabel.material.needsUpdate = true;
        }
        if (this.rover.position.z >= 1.5) {
          this.simStep = 3;
          this.stepTimer = 0;
          try { soundManager.playRadarPing(); } catch (e) {}
        }
      }
      // Stage 3: Stop safely before closest obstacle (Distance < 5)
      else if (this.simStep === 3) {
        if (nameLabel) {
          nameLabel.material.map = createTextTexture('SPEED: STOP (SAFE)', '#ffffff', '#2563eb');
          nameLabel.material.needsUpdate = true;
        }
        if (this.stepTimer > 1.5) {
          this.simulating = false;
        }
      }
    }
  }

  dispose() {
    const cc = this.sceneManager?.cameraController;
    if (cc) {
      cc.defaultCamPos.set(0, 5, 10);
      cc.defaultTarget.set(0, 1, 0);
    }
    super.dispose();
  }
}
