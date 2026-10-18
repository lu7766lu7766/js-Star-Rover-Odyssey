/**
 * Level 5 Scene: 深空普查
 * 學生的 scanPlanet 每呼叫一次就打出一道脈衝：半徑 = 參數算出來的 range，
 * 打中就顯影星體；全部掃完後依 rover.flyTo 的座標飛過去。
 */

import * as THREE from 'three';
import { BaseGameScene } from './BaseGameScene.js';
import { createSciFiRover, createSciFiGrid, createScannerDish, createTextTexture, createGlowSprite } from '../models/ProceduralMeshes.js';
import { soundManager } from '../core/SoundManager.js';
import { VISIBLE_PLANETS, PULSE_SECONDS, FLY_SECONDS, scanAnimationPlan } from '../sim/scanner.js';

const PLANET_COLORS = [0xf59e0b, 0x10b981, 0x8b5cf6];
const PLANET_HEIGHT = 2.2;
/** 飛到星體前方多遠停下 */
const STOP_SHORT = 2.8;

const PULSE_COLORS = {
  OK: 0x00f2fe,
  TOO_SHORT: 0xf59e0b,
  OVERHEAT: 0xef4444,
  LOW_RES: 0xa78bfa,
  OVEREXPOSED: 0xfacc15
};

const PULSE_LABELS = {
  TOO_SHORT: 'OUT OF RANGE',
  OVERHEAT: 'OVERHEAT!',
  LOW_RES: 'LOW RES',
  OVEREXPOSED: 'OVEREXPOSED',
  NO_TARGET: 'NO TARGET',
  BAD_PARAMS: 'BAD PARAMS',
  BAD_RANGE: 'RANGE = NaN',
  BAD_MODE: 'BAD MODE'
};

function makeLabelSprite(text, bg, fg, scale = [3.4, 0.85]) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createTextTexture(text, bg, fg),
    transparent: true,
    depthWrite: false
  }));
  sprite.scale.set(scale[0], scale[1], 1);
  return sprite;
}

function setLabel(sprite, text, bg, fg) {
  if (!sprite) return;
  // 每次換字都產生新貼圖，舊的要釋放，不然重跑幾十次 GPU 記憶體只增不減
  sprite.material.map?.dispose();
  sprite.material.map = createTextTexture(text, bg, fg);
  sprite.material.needsUpdate = true;
}

export class Level5Scene extends BaseGameScene {
  constructor() {
    super(5);
    this.rover = null;
    this.scannerDish = null;
    this.pulseRing = null;
    this.statusLabel = null;
    this.planets = [];
    this.queue = [];
    this.current = null;
    this.timer = 0;
    this.speed = 1;
  }

  build() {
    this.group.add(createSciFiGrid(70, 70, 0x00f2fe));

    this.rover = createSciFiRover();
    this.group.add(this.rover);

    this.scannerDish = createScannerDish();
    this.scannerDish.position.set(0, 1.45, 0.4);
    this.rover.add(this.scannerDish);

    // 擴散脈衝：平放的細環，縮放成 range 的半徑（場景 1 單位 = 距離 1 單位）
    const ringGeo = new THREE.RingGeometry(0.96, 1.0, 96);
    ringGeo.rotateX(-Math.PI / 2);
    this.pulseRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: PULSE_COLORS.OK, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    this.pulseRing.position.y = 0.3;
    this.group.add(this.pulseRing);

    this.statusLabel = makeLabelSprite('RADAR READY', '#ffffff', '#2563eb');
    this.statusLabel.position.set(0, 3.9, 0);
    this.group.add(this.statusLabel);

    this.planets = VISIBLE_PLANETS.map((data, i) => {
      const color = PLANET_COLORS[i % PLANET_COLORS.length];
      const group = new THREE.Group();
      group.position.set(data.coords.x, PLANET_HEIGHT, data.coords.z);
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.3, 32, 20),
        new THREE.MeshStandardMaterial({
          color, roughness: 0.45, metalness: 0.15, emissive: color, emissiveIntensity: 0,
          transparent: true, opacity: 0.12
        })
      );
      group.add(sphere);
      const glow = createGlowSprite(color, 4.2, 0.75);
      glow.visible = false;
      group.add(glow);
      const label = makeLabelSprite('? ? ?', '#ffffff', '#64748b', [3.0, 0.75]);
      label.position.y = 2.1;
      group.add(label);
      this.group.add(group);
      return { data, group, sphere, glow, label, flicker: false };
    });

    this.reset();
  }

  reset() {
    this.queue = [];
    this.current = null;
    this.timer = 0;
    this.speed = 1;
    if (this.rover) {
      this.rover.position.set(0, 0, 0);
      this.rover.rotation.y = 0;
    }
    if (this.pulseRing) {
      this.pulseRing.position.set(0, 0.3, 0);
      this.pulseRing.material.opacity = 0;
    }
    if (this.statusLabel) {
      this.statusLabel.position.set(0, 3.9, 0);
      setLabel(this.statusLabel, 'RADAR READY', '#ffffff', '#2563eb');
    }
    for (const p of this.planets) this.hidePlanet(p);
  }

  init(sceneManager) {
    this.sceneManager = sceneManager;
    this.build();
    this.resetCamera();
  }

  resetCamera() {
    const cc = this.sceneManager?.cameraController;
    if (cc) {
      // 俯瞰：探測船在畫面下方，三顆星排在前方
      cc.defaultCamPos.set(0, 22, 12);
      cc.defaultTarget.set(0, 0, -9);
      cc.reset(cc.defaultCamPos, cc.defaultTarget);
    }
  }

  dispose() {
    // 預設視角是所有關卡共用的，離開時還原，免得下一關沿用這關的俯瞰角度
    const cc = this.sceneManager?.cameraController;
    if (cc) {
      cc.defaultCamPos.set(0, 5, 10);
      cc.defaultTarget.set(0, 1, 0);
    }
    for (const sprite of [this.statusLabel, ...this.planets.map((p) => p.label)]) {
      sprite?.material.map?.dispose();
    }
    super.dispose();
  }

  hidePlanet(p) {
    p.flicker = false;
    p.sphere.material.opacity = 0.12;
    p.sphere.material.emissiveIntensity = 0;
    p.glow.visible = false;
    setLabel(p.label, '? ? ?', '#ffffff', '#64748b');
  }

  revealPlanet(p) {
    p.flicker = false;
    p.sphere.material.opacity = 1;
    p.sphere.material.emissiveIntensity = 0.35;
    p.glow.visible = true;
    setLabel(p.label, `${p.data.name} ✓`, '#ffffff', '#10b981');
  }

  handleAction(actionType, payload = {}) {
    if (actionType === 'RESET_SCENE' || actionType === 'RESET_POSITION' || actionType === 'RESET') {
      this.reset();
      return;
    }

    if (actionType === 'EXECUTE_START') {
      this.reset();
      const inner = payload.payload || payload || {};
      const calls = Array.isArray(inner.apiCalls) ? inner.apiCalls : [];
      this.speed = scanAnimationPlan(calls).speed;
      for (const c of calls) {
        if (c.api === 'scanner.pulse') {
          const params = c.args?.[0] || {};
          this.queue.push({ type: 'pulse', target: params.target, range: params.range, status: c.status });
        } else if (c.api === 'rover.flyTo') {
          this.queue.push({ type: 'fly', coords: c.args?.[0] });
        }
      }
      if (this.queue.length === 0) {
        setLabel(this.statusLabel, 'NO PULSE', '#ffffff', '#ef4444');
      }
    } else if (actionType === 'LEVEL_SUCCESS') {
      setLabel(this.statusLabel, 'SURVEY COMPLETE', '#ffffff', '#10b981');
    } else if (actionType === 'LEVEL_FAIL') {
      setLabel(this.statusLabel, 'SURVEY FAILED', '#ffffff', '#ef4444');
    }
  }

  startAction(action) {
    this.current = action;
    this.timer = 0;
    if (action.type === 'pulse') {
      const status = action.status;
      this.pulseRing.position.set(this.rover.position.x, 0.3, this.rover.position.z);
      this.pulseRing.material.color.setHex(PULSE_COLORS[status] ?? 0x94a3b8);
      const r = typeof action.range === 'number' && !Number.isNaN(action.range) ? action.range : '?';
      setLabel(this.statusLabel, `PULSE R:${r}`, '#ffffff', '#2563eb');
      try { soundManager.playRadarPing(); } catch (e) {}
    } else if (action.type === 'fly') {
      const { coords } = action;
      const valid = coords && Number.isFinite(coords.x) && Number.isFinite(coords.z);
      if (!valid) {
        setLabel(this.statusLabel, 'NO COORDS', '#ffffff', '#ef4444');
        this.current = null;
        return;
      }
      const from = this.rover.position.clone();
      const dx = coords.x - from.x;
      const dz = coords.z - from.z;
      const len = Math.hypot(dx, dz);
      const keep = len > STOP_SHORT ? (len - STOP_SHORT) / len : 0;
      action.from = from;
      action.to = new THREE.Vector3(from.x + dx * keep, 0, from.z + dz * keep);
      action.rotFrom = this.rover.rotation.y;
      action.rotTo = Math.atan2(dx, dz);
      setLabel(this.statusLabel, 'NAV: EN ROUTE', '#ffffff', '#2563eb');
      try { soundManager.playThruster(); } catch (e) {}
    }
  }

  finishPulse(action) {
    const planet = this.planets.find((p) => p.data.name === action.target);
    if (action.status === 'OK') {
      if (planet) this.revealPlanet(planet);
      setLabel(this.statusLabel, `LOCK ${action.target}`, '#ffffff', '#10b981');
      return;
    }
    setLabel(this.statusLabel, PULSE_LABELS[action.status] || 'SCAN FAILED', '#ffffff', '#ef4444');
    if (planet && action.status === 'LOW_RES') {
      planet.flicker = true;
      setLabel(planet.label, 'LOW RES', '#ffffff', '#a78bfa');
    }
    if (action.status === 'OVERHEAT' || action.status === 'OVEREXPOSED') {
      this.sceneManager?.cameraController?.kick(0.3);
    }
    try { soundManager.playError(); } catch (e) {}
  }

  update(delta) {
    const head = this.scannerDish?.userData.head;
    if (head) head.rotation.y += delta * 2.5;

    for (const p of this.planets) {
      p.group.rotation.y += delta * 0.4;
      if (p.flicker) p.sphere.material.opacity = 0.3 + 0.2 * Math.sin(performance.now() / 90);
    }

    if (!this.current && this.queue.length > 0) {
      this.startAction(this.queue.shift());
    }
    const action = this.current;
    if (!action) return;
    this.timer += delta * this.speed;

    if (action.type === 'pulse') {
      const t = Math.min(1, this.timer / (PULSE_SECONDS * 0.8));
      const ease = 1 - Math.pow(1 - t, 3);
      const radius = typeof action.range === 'number' && action.range > 0 ? Math.min(action.range, 40) : 1.5;
      const s = 0.5 + (radius - 0.5) * ease;
      this.pulseRing.scale.set(s, 1, s);
      this.pulseRing.material.opacity = 0.95 * (1 - Math.max(0, (this.timer / PULSE_SECONDS) - 0.6) * 2.5);
      if (t >= 1 && !action.done) {
        action.done = true;
        this.finishPulse(action);
      }
      if (this.timer >= PULSE_SECONDS) {
        this.pulseRing.material.opacity = 0;
        this.current = null;
      }
    } else if (action.type === 'fly') {
      const t = Math.min(1, this.timer / FLY_SECONDS);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this.rover.position.lerpVectors(action.from, action.to, ease);
      this.rover.position.y = Math.sin(t * Math.PI) * 1.2;
      this.rover.rotation.y = THREE.MathUtils.lerp(action.rotFrom, action.rotTo, Math.min(1, t * 3));
      this.statusLabel.position.set(this.rover.position.x, this.rover.position.y + 3.9, this.rover.position.z);
      if (t >= 1) {
        setLabel(this.statusLabel, 'ARRIVED', '#ffffff', '#10b981');
        this.current = null;
      }
    }
  }
}
