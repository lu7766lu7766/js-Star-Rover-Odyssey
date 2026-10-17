/**
 * Level 7 Scene: 無人機編隊
 */

import * as THREE from 'three';
import { BaseGameScene } from './BaseGameScene.js';
import { createSciFiGrid, createDrone } from '../models/ProceduralMeshes.js';
import { soundManager } from '../core/SoundManager.js';

export class Level7Scene extends BaseGameScene {
  constructor() {
    super(7);
    this.drones = [];
    this.padsGroup = null;
    this.isDeployed = false;
    this.hoverTime = 0;

    // 俯視偏高視角：讓 x=-6~7、y=4~7 的 4 台無人機落在畫面中下段（避開左上 55%x30% HUD），同時納入地面停機坪
    this.camPos = new THREE.Vector3(0.5, 9.5, 26.0);
    this.camTarget = new THREE.Vector3(0.5, 6.2, -0.5);
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

    const grid = createSciFiGrid(60, 60, 0x00f2fe);
    this.group.add(grid);

    const initialDrones = [
      { id: "drone-01", x: -6, y: 5, z: 2, battery: 85 },
      { id: "drone-02", x: -2, y: 7, z: -3, battery: 15 },
      { id: "drone-03", x: 3, y: 6, z: 1, battery: 92 },
      { id: "drone-04", x: 7, y: 4, z: -2, battery: 12 }
    ];

    // 建立地面發射/待命平台與每台無人機專屬的小停機坪圓盤，提供懸停高度參照
    this.padsGroup = new THREE.Group();
    this.padsGroup.name = 'DroneStandbyPads_ground';

    const segs = isLow ? 20 : 32;
    const baseRimGeo = new THREE.CylinderGeometry(1.35, 1.5, 0.16, segs);
    const baseDiscGeo = new THREE.CylinderGeometry(1.12, 1.12, 0.18, segs);
    const ringGeo = new THREE.TorusGeometry(0.92, 0.055, 10, segs);
    ringGeo.rotateX(Math.PI / 2);
    const guideBeamGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8);

    const baseRimMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.75
    });
    const baseDiscMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.65,
      metalness: 0.3
    });

    this.drones = [];
    initialDrones.forEach((d) => {
      const droneMesh = createDrone(d.id, d.x, d.y, d.z, d.battery);
      this.group.add(droneMesh);
      this.drones.push(droneMesh);

      // 下方專屬停機坪圓盤
      const pad = new THREE.Group();
      pad.position.set(d.x, 0, d.z);

      const rim = new THREE.Mesh(baseRimGeo, baseRimMat);
      rim.name = 'pad_rim_ground';
      rim.position.y = 0.08;
      pad.add(rim);

      const disc = new THREE.Mesh(baseDiscGeo, baseDiscMat);
      disc.name = 'pad_disc_ground';
      disc.position.y = 0.1;
      pad.add(disc);

      const isWarn = d.battery < 20;
      const statusColor = isWarn ? 0xef4444 : 0x10b981;
      const beaconMat = new THREE.MeshBasicMaterial({
        color: statusColor
      });
      const ring = new THREE.Mesh(ringGeo, beaconMat);
      ring.name = 'pad_ring_ground';
      ring.position.y = 0.2;
      pad.add(ring);

      // 垂直高度參照導引光束（連接地面停機坪與懸停高度）
      const beamMat = new THREE.MeshBasicMaterial({
        color: statusColor,
        transparent: true,
        opacity: 0.22,
        depthWrite: false
      });
      const beam = new THREE.Mesh(guideBeamGeo, beamMat);
      beam.name = 'pad_beam_ground';
      beam.scale.set(1, d.y, 1);
      beam.position.y = d.y * 0.5;
      pad.add(beam);

      droneMesh.userData.beaconMat = beaconMat;
      droneMesh.userData.beamMat = beamMat;
      droneMesh.userData.padBeam = beam;

      this.padsGroup.add(pad);
    });

    this.group.add(this.padsGroup);

    this.reset();
  }

  reset() {
    this.isDeployed = false;
    this.hoverTime = 0;

    const initialDrones = [
      { id: "drone-01", x: -6, y: 5, z: 2, battery: 85 },
      { id: "drone-02", x: -2, y: 7, z: -3, battery: 15 },
      { id: "drone-03", x: 3, y: 6, z: 1, battery: 92 },
      { id: "drone-04", x: 7, y: 4, z: -2, battery: 12 }
    ];

    this.drones.forEach((mesh, idx) => {
      const cfg = initialDrones[idx];
      mesh.position.set(cfg.x, cfg.y, cfg.z);
      mesh.rotation.set(0, 0, 0);
      mesh.userData.baseY = cfg.y;
      mesh.userData.status = cfg.battery < 20 ? 'WARNING' : 'PATROL';
      const col = cfg.battery < 20 ? 0xef4444 : 0x10b981;
      if (mesh.userData.beaconMat) {
        mesh.userData.beaconMat.color.setHex(col);
      }
      if (mesh.userData.beamMat) {
        mesh.userData.beamMat.color.setHex(col);
      }
    });

    this.resetCamera();
  }

  handleAction(actionType, payload = {}) {
    if (actionType === 'RESET_SCENE' || actionType === 'RESET_POSITION' || actionType === 'RESET') {
      this.reset();
      return;
    }

    if (actionType === 'EXECUTE_START') {
      this.reset();
      this.isDeployed = true;
      try { soundManager.playDroneFly(); } catch (e) {}

      const fleetConfig = payload.payload?.fleetConfig || payload.fleetConfig || {};
      const threshold = fleetConfig.batteryThreshold || 20;

      const deployCalls = payload.payload?.apiCalls?.filter(c => c.api === 'droneFleet.deploy') || [];
      const deployedList = deployCalls.length > 0 ? deployCalls[deployCalls.length - 1].args[0] : null;

      this.drones.forEach((mesh, idx) => {
        let isLow = false;
        if (deployedList && deployedList[idx]) {
          const d = deployedList[idx];
          const order = d.order ?? d.status;
          isLow = order === 'RETURN_BASE' || (Number(d.battery) < threshold);
        } else {
          isLow = mesh.userData.battery < threshold;
        }
        mesh.userData.status = isLow ? 'WARNING' : 'PATROL';
        const col = isLow ? 0xef4444 : 0x10b981;
        if (mesh.userData.beaconMat) {
          mesh.userData.beaconMat.color.setHex(col);
        }
        if (mesh.userData.beamMat) {
          mesh.userData.beamMat.color.setHex(col);
        }
      });
    } else if (actionType === 'LEVEL_SUCCESS') {
      this.isDeployed = true;
      try { soundManager.playDroneFly(); } catch (e) {}
    }
  }

  update(delta) {
    this.hoverTime += delta * 2.5;

    this.drones.forEach((drone, idx) => {
      const { baseY, status, rotors, padBeam } = drone.userData;

      // 旋翼持續高速旋轉
      if (rotors) {
        for (let r = 0; r < rotors.length; r++) {
          rotors[r].rotation.y += delta * 22;
        }
      }

      // Bobbing
      drone.position.y = baseY + Math.sin(this.hoverTime + idx) * 0.25;

      if (padBeam) {
        const h = Math.max(0.2, drone.position.y);
        padBeam.scale.set(1, h, 1);
        padBeam.position.y = h * 0.5;
      }

      if (this.isDeployed) {
        if (status === 'PATROL') {
          // Patrol orbital circular flight
          drone.rotation.y += delta * 1.2;
          drone.position.x += Math.cos(this.hoverTime + idx) * delta * 2;
          drone.position.z += Math.sin(this.hoverTime + idx) * delta * 2;
        } else if (status === 'WARNING') {
          // Low battery warning pulse and descent to deck
          if (drone.position.y > 1.2) {
            drone.userData.baseY = Math.max(1.0, baseY - delta * 2);
          }
          if (drone.userData.beaconMat) {
            const pulse = (Math.sin(this.hoverTime * 8) + 1) / 2;
            drone.userData.beaconMat.color.setRGB(1.0, pulse * 0.2, pulse * 0.2);
            if (drone.userData.beamMat) {
              drone.userData.beamMat.color.setRGB(1.0, pulse * 0.2, pulse * 0.2);
            }
          }
        }
      }
    });
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
