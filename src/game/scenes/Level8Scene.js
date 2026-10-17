/**
 * Level 8 Scene: 星際氣象站 (Open-Meteo Weather API & Drone Flight Dynamics)
 * Renders Weather Station Tower, radar dish, atmospheric clouds, and probe drone launch
 * with distinctive animations for success (piercing clouds) and failures (wind buffeting, icing stall, rain short-circuit, disconnect).
 */

import * as THREE from 'three';
import { BaseGameScene } from './BaseGameScene.js';
import { createSciFiGrid, createPatrolDrone, createScannerDish } from '../models/ProceduralMeshes.js';
import { soundManager } from '../core/SoundManager.js';

export class Level8Scene extends BaseGameScene {
  constructor() {
    super(8);
    this.grid = null;
    this.stationTower = null;
    this.drone = null;
    this.radarDish = null;
    this.anemometer = null;
    this.windsock = null;
    this.clouds = [];
    this.mistClouds = [];
    this.cloudMeshes = [];
    this.windTime = 0;
    this.isLaunching = false;
    this.launchHeight = 0;
    this.failMode = null; // 'WIND' | 'TEMP' | 'PRECIP' | 'DISCONNECT'
    this.failAnimTimer = 0;

    // 自訂直式構圖視角：下半部收納氣象塔與發射台，上半部完整呈現 y=5.4~8.5 的蓬鬆雲層與雲霧
    this.camPos = new THREE.Vector3(0, 5.2, 18.5);
    this.camTarget = new THREE.Vector3(0, 3.6, 0);
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

    this.grid = createSciFiGrid(60, 20, 0x38bdf8, 0x475569);
    this.group.add(this.grid);

    // 1. 專業氣象觀測塔（細桁架鋼構塔身、基座設備箱、頂部觀測平台、雷達碟、三杯風速計、紅白風向袋）
    this.buildWeatherTower(isLow);

    // 2. 無人機發射台
    const padGroup = new THREE.Group();
    padGroup.position.set(4, 0, 0);
    const padGeo = new THREE.CylinderGeometry(1.8, 2.0, 0.3, isLow ? 16 : 28);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4, metalness: 0.35 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 0.15;
    padGroup.add(pad);

    const padRingGeo = new THREE.TorusGeometry(1.45, 0.05, 8, isLow ? 20 : 36);
    padRingGeo.rotateX(Math.PI / 2);
    const padRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const padRing = new THREE.Mesh(padRingGeo, padRingMat);
    padRing.position.y = 0.31;
    padGroup.add(padRing);
    this.group.add(padGroup);

    // 3. 氣象探測無人機
    this.drone = createPatrolDrone('WEATHER_PROBE', 0x10b981);
    this.drone.position.set(4, 0.6, 0);
    this.group.add(this.drone);

    // 4. 蓬鬆立體雲層 + 後上方半透明高空雲霧
    this.buildClouds(isLow);

    this.reset();
  }

  /**
   * 建立細桁架鋼構氣象站塔、頂部平台、雷達碟、風速計、風向袋與基座設備箱
   */
  buildWeatherTower(isLow = false) {
    this.stationTower = new THREE.Group();
    this.stationTower.position.set(-4, 0, 0);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.38, metalness: 0.72 });
    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.65 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.25 });
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.2,
      roughness: 0.4
    });
    const cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const greenGlowMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

    // 基座混凝土/金屬八角平台
    const basePad = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.48, 0.24, 8), darkSteelMat);
    basePad.position.y = 0.12;
    this.stationTower.add(basePad);

    // 基座旁的小設備箱（含狀態指示燈與散熱百葉面板）
    const cabinetGroup = new THREE.Group();
    cabinetGroup.position.set(0.78, 0.24, 0.38);
    const cabinetBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.76, 0.48), whiteMat);
    cabinetBody.position.y = 0.38;
    cabinetGroup.add(cabinetBody);

    const cabinetRoof = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.07, 0.52), steelMat);
    cabinetRoof.position.y = 0.78;
    cabinetGroup.add(cabinetRoof);

    const screenPanel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.03), darkSteelMat);
    screenPanel.position.set(0, 0.48, 0.24);
    cabinetGroup.add(screenPanel);

    const led1 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), greenGlowMat);
    led1.position.set(-0.12, 0.24, 0.25);
    cabinetGroup.add(led1);

    const led2 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), cyanGlowMat);
    led2.position.set(0.02, 0.24, 0.25);
    cabinetGroup.add(led2);

    this.stationTower.add(cabinetGroup);

    // 細長鋼構桁架塔身（四角立柱 + 中央通訊導管 + 分段橫樑環 + 斜撐桿）
    const towerHeight = 3.4;
    const corePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, towerHeight, 10), darkSteelMat);
    corePipe.position.y = 0.2 + towerHeight * 0.5;
    this.stationTower.add(corePipe);

    const legGeo = new THREE.CylinderGeometry(0.048, 0.065, towerHeight, 8);
    const legAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
    legAngles.forEach((ang) => {
      const leg = new THREE.Mesh(legGeo, steelMat);
      const rMid = 0.44;
      leg.position.set(Math.cos(ang) * rMid, 0.2 + towerHeight * 0.5, Math.sin(ang) * rMid);
      leg.rotation.z = Math.cos(ang) * 0.065;
      leg.rotation.x = -Math.sin(ang) * 0.065;
      this.stationTower.add(leg);
    });

    // 分段水平橫箍與斜撐
    const levels = [0.85, 1.65, 2.45, 3.2];
    const braceGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.95, 6);
    levels.forEach((ly, idx) => {
      const rRing = 0.54 - idx * 0.055;
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(rRing, 0.032, 6, 16),
        idx % 2 === 0 ? steelMat : orangeMat
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.y = ly;
      this.stationTower.add(collar);

      if (!isLow || idx % 2 === 0) {
        for (let b = 0; b < 4; b++) {
          const bAng = (b * Math.PI) / 2;
          const brace = new THREE.Mesh(braceGeo, steelMat);
          brace.position.set(
            Math.cos(bAng) * (rRing * 0.86),
            ly - 0.35,
            Math.sin(bAng) * (rRing * 0.86)
          );
          brace.rotation.y = -bAng;
          brace.rotation.x = 0.62;
          this.stationTower.add(brace);
        }
      }
    });

    // 頂部觀測平台與護欄
    const platformY = 3.56;
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.76, 0.16, 16), darkSteelMat);
    deck.position.y = platformY;
    this.stationTower.add(deck);

    const railRing = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.028, 8, 24), orangeMat);
    railRing.rotation.x = Math.PI / 2;
    railRing.position.y = platformY + 0.28;
    this.stationTower.add(railRing);

    // 保留氣象雷達碟（置於頂部平台中央偏左）
    this.radarDish = createScannerDish();
    this.radarDish.scale.setScalar(0.84);
    this.radarDish.position.set(-0.16, platformY + 0.06, 0.05);
    this.stationTower.add(this.radarDish);

    // 三杯風速計（Anemometer）：位於頂部平台右側高桿上，三個風杯持續旋轉
    const anemMast = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.95, 8), steelMat);
    anemMast.position.set(0.56, platformY + 0.52, 0.24);
    this.stationTower.add(anemMast);

    this.anemometer = new THREE.Group();
    this.anemometer.position.set(0.56, platformY + 1.0, 0.24);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), whiteMat);
    this.anemometer.add(hub);

    const armGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.34, 6);
    armGeo.rotateZ(Math.PI / 2);
    const cupGeo = new THREE.SphereGeometry(0.085, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    for (let c = 0; c < 3; c++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (c * Math.PI * 2) / 3;

      const arm = new THREE.Mesh(armGeo, steelMat);
      arm.position.x = 0.17;
      pivot.add(arm);

      const cup = new THREE.Mesh(cupGeo, orangeMat);
      cup.position.set(0.34, 0, 0);
      cup.rotation.x = Math.PI / 2;
      pivot.add(cup);

      this.anemometer.add(pivot);
    }
    this.stationTower.add(this.anemometer);

    // 風向袋（Windsock）：位於頂部平台左後側桅杆，紅白相間錐筒隨風擺動
    const sockMast = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 1.15, 8), steelMat);
    sockMast.position.set(-0.62, platformY + 0.62, -0.28);
    this.stationTower.add(sockMast);

    this.windsock = new THREE.Group();
    this.windsock.position.set(-0.62, platformY + 1.14, -0.28);

    const sockSegments = [
      { r1: 0.13, r2: 0.105, len: 0.2, x: 0.12, mat: orangeMat },
      { r1: 0.105, r2: 0.08, len: 0.2, x: 0.32, mat: whiteMat },
      { r1: 0.08, r2: 0.055, len: 0.2, x: 0.52, mat: orangeMat }
    ];
    sockSegments.forEach((seg) => {
      const sGeo = new THREE.CylinderGeometry(seg.r1, seg.r2, seg.len, 12, 1, true);
      sGeo.rotateZ(Math.PI / 2);
      const sMesh = new THREE.Mesh(sGeo, seg.mat);
      sMesh.position.set(seg.x, -0.02, 0);
      this.windsock.add(sMesh);
    });
    this.stationTower.add(this.windsock);

    this.group.add(this.stationTower);
  }

  /**
   * 建立蓬鬆平滑球體雲朵（上半 0xffffff、下半 0xcbd5e1 體積陰影、無描邊、不投射陰影）與高空半透明雲霧層
   */
  buildClouds(isLow = false) {
    this.clouds = [];
    this.mistClouds = [];
    this.cloudMeshes = [];

    const sphereGeo = new THREE.SphereGeometry(1.0, isLow ? 16 : 20, isLow ? 12 : 16);

    const topMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf1f5f9,
      emissiveIntensity: 0.24,
      roughness: 1.0,
      metalness: 0.0
    });

    const bottomMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      emissive: 0x94a3b8,
      emissiveIntensity: 0.15,
      roughness: 1.0,
      metalness: 0.0
    });

    // 每朵雲由 6~9 顆大小不一的球體疊成蓬鬆形狀，底部略扁平
    const puffTemplate = [
      // 下層體積陰影球體（略扁平）
      { x: -1.15, y: -0.18, z: 0.12, sx: 1.15, sy: 0.68, sz: 1.0, isTop: false },
      { x: 0.0, y: -0.22, z: 0.2, sx: 1.35, sy: 0.65, sz: 1.12, isTop: false },
      { x: 1.18, y: -0.16, z: 0.08, sx: 1.1, sy: 0.66, sz: 0.98, isTop: false },
      { x: -0.55, y: -0.12, z: -0.45, sx: 1.05, sy: 0.68, sz: 0.95, isTop: false },
      // 上層亮白蓬鬆球體
      { x: -0.68, y: 0.34, z: 0.05, sx: 1.08, sy: 0.96, sz: 1.02, isTop: true },
      { x: 0.18, y: 0.52, z: 0.0, sx: 1.26, sy: 1.12, sz: 1.15, isTop: true },
      { x: 0.92, y: 0.28, z: 0.12, sx: 0.96, sy: 0.88, sz: 0.94, isTop: true },
      { x: -1.35, y: 0.12, z: -0.05, sx: 0.82, sy: 0.76, sz: 0.82, isTop: true },
      { x: 0.45, y: 0.24, z: -0.48, sx: 0.92, sy: 0.85, sz: 0.9, isTop: true }
    ];
    const activePuffs = isLow ? puffTemplate.slice(0, 6) : puffTemplate;

    const cloudLayouts = [
      { x: -7.5, y: 5.8, z: -3.5, scale: 0.95 },
      { x: -3.2, y: 6.7, z: -1.2, scale: 1.08 },
      { x: 0.8, y: 5.6, z: -4.2, scale: 1.0 },
      { x: 3.8, y: 6.2, z: -0.2, scale: 1.12 }, // 位於探測無人機發射路徑正上方
      { x: 7.2, y: 5.9, z: -2.8, scale: 0.96 },
      { x: -0.5, y: 7.4, z: -6.5, scale: 1.18 }
    ];

    cloudLayouts.forEach((cfg, idx) => {
      const cloud = new THREE.Group();
      cloud.name = `Cloud_${idx}`;

      activePuffs.forEach((p, pIdx) => {
        const puff = new THREE.Mesh(sphereGeo, p.isTop ? topMat : bottomMat);
        // 加入以 ground 結尾的名稱，讓 SceneManager.applyShadowFlags 自動跳過 castShadow，同時在 update 雙重保險關閉
        puff.name = `cloud_puff_${pIdx}_ground`;
        const jitter = 1 + Math.sin(idx * 3.1 + pIdx * 1.7) * 0.08;
        puff.position.set(p.x * cfg.scale, p.y * cfg.scale, p.z * cfg.scale);
        puff.scale.set(
          p.sx * cfg.scale * jitter,
          p.sy * cfg.scale,
          p.sz * cfg.scale * jitter
        );
        puff.castShadow = false;
        puff.receiveShadow = false;
        cloud.add(puff);
        this.cloudMeshes.push(puff);
      });

      cloud.position.set(cfg.x, cfg.y, cfg.z);
      this.group.add(cloud);
      this.clouds.push(cloud);
    });

    // 後方與上方的半透明高空雲霧層，強化「穿破雲層」的縱深感
    const mistMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe2e8f0,
      emissiveIntensity: 0.28,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true,
      opacity: 0.38,
      depthWrite: false
    });

    const mistLayouts = isLow
      ? [
          { x: -4.0, y: 7.6, z: -7.5, sx: 4.5, sy: 0.85, sz: 2.2 },
          { x: 3.8, y: 7.5, z: -1.5, sx: 4.2, sy: 0.8, sz: 2.4 }
        ]
      : [
          { x: -5.5, y: 7.5, z: -7.5, sx: 4.8, sy: 0.85, sz: 2.4 },
          { x: 0.5, y: 8.2, z: -8.5, sx: 5.5, sy: 0.95, sz: 2.6 },
          { x: 4.0, y: 7.6, z: -1.2, sx: 4.2, sy: 0.78, sz: 2.4 },
          { x: 6.2, y: 7.9, z: -6.8, sx: 4.6, sy: 0.85, sz: 2.2 }
        ];

    mistLayouts.forEach((mCfg, mIdx) => {
      const mistGroup = new THREE.Group();
      mistGroup.name = `MistLayer_${mIdx}`;
      for (let k = -1; k <= 1; k++) {
        const mistPuff = new THREE.Mesh(sphereGeo, mistMat);
        mistPuff.name = `mist_puff_${k}_ground`;
        mistPuff.position.set(k * 1.8, (k === 0 ? 0.18 : -0.1), 0);
        mistPuff.scale.set(
          mCfg.sx * (k === 0 ? 0.68 : 0.52),
          mCfg.sy * (k === 0 ? 1.0 : 0.78),
          mCfg.sz * 0.6
        );
        mistPuff.castShadow = false;
        mistPuff.receiveShadow = false;
        mistGroup.add(mistPuff);
        this.cloudMeshes.push(mistPuff);
      }
      mistGroup.position.set(mCfg.x, mCfg.y, mCfg.z);
      this.group.add(mistGroup);
      this.mistClouds.push(mistGroup);
    });
  }

  reset() {
    this.isLaunching = false;
    this.launchHeight = 0;
    this.failMode = null;
    this.failAnimTimer = 0;
    if (this.drone) {
      this.drone.position.set(4, 0.6, 0);
      this.drone.rotation.set(0, 0, 0);
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
      try { soundManager.playThrust(); } catch (e) {}
    } else if (actionType === 'LEVEL_SUCCESS') {
      this.failMode = null;
      this.isLaunching = true;
      try { soundManager.playLaunch(); } catch (e) {}
    } else if (actionType === 'LEVEL_FAIL') {
      this.isLaunching = false;
      this.failAnimTimer = 0;
      this.failMode = payload.evaluation?.failReason || 'WIND';
      try { soundManager.playError(); } catch (e) {}
    }
  }

  update(delta) {
    this.windTime += delta;

    // 確保所有雲體與雲霧皆不投射或接收陰影（防止 SceneManager.applyShadowFlags 覆寫）
    for (let i = 0; i < this.cloudMeshes.length; i++) {
      this.cloudMeshes[i].castShadow = false;
      this.cloudMeshes[i].receiveShadow = false;
    }

    // Spin radar dish continuously
    if (this.radarDish && this.radarDish.userData.head) {
      this.radarDish.userData.head.rotation.y += delta * 1.5;
    }

    // 風速計三杯旋轉與風向袋隨風擺動（強風失敗模式下劇烈加速）
    const isHighWind = this.failMode === 'WIND';
    if (this.anemometer) {
      this.anemometer.rotation.y += delta * (isHighWind ? 18.0 : 6.0);
    }
    if (this.windsock) {
      this.windsock.rotation.y = Math.sin(this.windTime * (isHighWind ? 12.0 : 2.4)) * (isHighWind ? 0.45 : 0.18);
      this.windsock.rotation.z = Math.cos(this.windTime * (isHighWind ? 15.0 : 3.1)) * (isHighWind ? 0.22 : 0.06);
    }

    // Spin drone rotors (unless frozen in icing fail mode)
    const rotorSpeed = this.failMode === 'TEMP' ? Math.max(0, 25 - this.failAnimTimer * 15) : 25;
    if (this.drone && this.drone.userData.rotors) {
      this.drone.userData.rotors.forEach(r => {
        r.rotation.y += delta * rotorSpeed;
      });
    }

    // 雲層微幅自然漂移（發射升空時加速流動）
    const driftSpeed = this.isLaunching ? 0.65 : (isHighWind ? 1.8 : 0.18);
    this.clouds.forEach((c) => {
      c.position.x += delta * driftSpeed;
      if (c.position.x > 14) c.position.x = -14;
    });
    this.mistClouds.forEach((m, idx) => {
      m.position.x += delta * driftSpeed * (0.55 + (idx % 2) * 0.2);
      if (m.position.x > 15) m.position.x = -15;
    });

    // 1. Success Animation: Drone launches up smoothly into clouds
    if (this.isLaunching && this.drone) {
      this.launchHeight += delta * 9;
      this.drone.position.y = 0.6 + this.launchHeight;
      this.drone.rotation.x = Math.sin(this.launchHeight * 0.4) * 0.1;
      this.drone.rotation.z = Math.cos(this.launchHeight * 0.3) * 0.05;
    }

    // 2. Failure Animations
    if (this.failMode && this.drone) {
      this.failAnimTimer += delta;

      if (this.failMode === 'WIND') {
        // Drone lifts off slightly, wobbles violently in high wind, then tilts and crashes down
        if (this.failAnimTimer < 1.2) {
          this.drone.position.y = 0.6 + Math.sin(this.failAnimTimer * Math.PI) * 1.8;
          this.drone.rotation.z = Math.sin(this.failAnimTimer * 18) * 0.55;
          this.drone.rotation.x = Math.cos(this.failAnimTimer * 12) * 0.4;
          this.drone.position.x = 4 + Math.sin(this.failAnimTimer * 8) * 0.8;
        } else {
          // Lands back on pad tilted
          this.drone.position.set(4.3, 0.6, 0);
          this.drone.rotation.set(0.1, 0, 0.4);
        }
      } else if (this.failMode === 'TEMP') {
        // Jitters due to freezing, rotors slow down, drops onto pad
        if (this.failAnimTimer < 1.5) {
          const jitter = (Math.random() - 0.5) * 0.08;
          this.drone.position.y = 0.6 + Math.min(this.failAnimTimer * 0.4, 0.5) + jitter;
          this.drone.position.x = 4 + jitter;
        } else {
          this.drone.position.set(4, 0.6, 0);
          this.drone.rotation.set(0, 0, 0);
        }
      } else if (this.failMode === 'PRECIP') {
        // Rotor twitching / descending in rain
        if (this.failAnimTimer < 1.2) {
          this.drone.position.y = 0.6 + Math.sin(this.failAnimTimer * 2) * 0.6;
          this.drone.rotation.z = Math.sin(this.failAnimTimer * 25) * 0.2;
        } else {
          this.drone.position.set(4, 0.6, 0);
          this.drone.rotation.set(0, 0, 0);
        }
      } else if (this.failMode === 'DISCONNECT') {
        // Drone remains grounded, slight vibration then stops
        if (this.failAnimTimer < 0.6) {
          this.drone.position.y = 0.6 + (Math.random() - 0.5) * 0.04;
        } else {
          this.drone.position.set(4, 0.6, 0);
          this.drone.rotation.set(0, 0, 0);
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
