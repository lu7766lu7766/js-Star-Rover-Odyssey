/**
 * Level 6 Scene: 太空艙控制中心
 * 網頁（終端機螢幕）是真的 DOM；這裡的 3D 氣閘只負責「反映」DOM 狀態：
 * disarmed → 警報停、鎖栓縮回、狀態燈轉綠；airlockOpen → 艙門滑開，看到門後的探測船。
 */

import * as THREE from 'three';
import { BaseGameScene } from './BaseGameScene.js';
import {
  createSciFiGrid,
  createAirlockBulkhead,
  createControlTerminal,
  createSciFiRover,
  createGlowSprite,
  createTextTexture
} from '../models/ProceduralMeshes.js';

const RED = new THREE.Color(0xef4444);
const GREEN = new THREE.Color(0x10b981);
const CYAN = new THREE.Color(0x38bdf8);
const AMBER = new THREE.Color(0xf59e0b);

export class Level6Scene extends BaseGameScene {
  constructor() {
    super(6);
    this.bulkhead = null;
    this.terminal = null;
    this.rover = null;

    // 目標狀態（來自 DOM），動畫值會慢慢追上
    this.disarmed = false;
    this.airlockOpen = false;
    this.unlockProgress = 0;
    this.openProgress = 0;

    this.time = 0;
    this.deniedFlash = 0;
    this.eventFlash = 0;
    this.successGlow = 0;

    // 鏡位：終端展開時畫面下半被蓋住，要拉遠才放得下整扇門；收合後推近
    this.dockedView = { pos: new THREE.Vector3(0, 5.6, 30), target: new THREE.Vector3(0, 3.3, 0) };
    this.fullView = { pos: new THREE.Vector3(0, 4.2, 19), target: new THREE.Vector3(0, 2.6, 0) };
    this.cineView = { pos: new THREE.Vector3(3.2, 4.4, 18.5), target: new THREE.Vector3(0, 1.7, 1.2) };
    this.view = this.dockedView;
    this.fly = null;

    // 通關運鏡：鏡頭推近門口、探測船從機庫開出來
    this.cinematicTime = -1;
    this.driveTime = 0;

    // 終端台座螢幕：縮小版的網頁畫面，網頁狀態一變就重畫
    this.screenCanvas = null;
    this.screenTexture = null;
    this.screenKey = '';
  }

  init(sceneManager) {
    this.sceneManager = sceneManager;
    this.build();
    this.resetCamera();
  }

  resetCamera() {
    const cc = this.sceneManager?.cameraController;
    this.fly = null;
    if (cc) {
      cc.defaultCamPos.copy(this.view.pos);
      cc.defaultTarget.copy(this.view.target);
      cc.reset(this.view.pos, this.view.target);
    }
  }

  /** SceneManager 通知：終端機展開 / 收合，蓋住的高度變了 */
  onViewInsetChange(inset, height) {
    const view = inset > height * 0.3 ? this.dockedView : this.fullView;
    if (view === this.view) return;
    this.view = view;
    const cc = this.sceneManager?.cameraController;
    if (cc) {
      cc.defaultCamPos.copy(view.pos);
      cc.defaultTarget.copy(view.target);
    }
    // 通關運鏡播放中鏡頭歸運鏡管；播完（-2）或沒在播（-1）才重新取景
    if (this.cinematicTime < 0) this.flyTo(view, 0.9);
  }

  flyTo(view, duration) {
    const cc = this.sceneManager?.cameraController;
    if (!cc?.controls) return;
    this.fly = {
      fromPos: cc.camera.position.clone(),
      fromTarget: cc.controls.target.clone(),
      view,
      t: 0,
      duration
    };
  }

  updateFly(delta) {
    const cc = this.sceneManager?.cameraController;
    if (!this.fly || !cc?.controls) return;
    const f = this.fly;
    f.t += delta;
    const k = easeInOut(Math.min(1, f.t / f.duration));
    cc.camera.position.lerpVectors(f.fromPos, f.view.pos, k);
    cc.controls.target.lerpVectors(f.fromTarget, f.view.target, k);
    if (k >= 1) this.fly = null;
  }

  build() {
    const isLow = Boolean(this.sceneManager?.isLowPerformance);

    const grid = createSciFiGrid(50, 50, 0x38bdf8);
    this.group.add(grid);

    this.bulkhead = createAirlockBulkhead();
    this.group.add(this.bulkhead);

    // 地板導引線：從鏡頭前一路通到門口，顏色跟著門的狀態走
    this.guideMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: RED, emissiveIntensity: 1.2 });
    [-1.6, 1.6].forEach((x) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 12), this.guideMat);
      strip.position.set(x, 0.02, 6.6);
      strip.name = 'guide_ground';
      this.group.add(strip);
    });

    // 控制終端放在門左前方，學生點的網頁就是它的螢幕
    this.terminal = createControlTerminal();
    this.terminal.position.set(-4.1, 0, 1.7);
    this.terminal.rotation.y = 0.3;
    this.terminal.scale.setScalar(1.35);
    this.group.add(this.terminal);
    this.setupTerminalScreen();

    // 門後：學生的探測船停在機庫裡等出發
    this.rover = createSciFiRover();
    this.rover.position.set(0, 0, ROVER_HOME_Z);
    this.group.add(this.rover);
    this.defaultLabelMap = this.rover.userData.nameLabel?.material.map || null;
    this.setRoverThrust(0);

    this.hangarGlow = createGlowSprite(0x7dd3fc, 7, 0.0);
    this.hangarGlow.position.set(0, 2.2, -1.2);
    this.group.add(this.hangarGlow);

    // 警報紅光（脈動）與門後機庫燈（開門才亮）
    this.alarmLight = new THREE.PointLight(0xef4444, 0, 16, 1.6);
    this.alarmLight.position.set(0, 6.2, 3);
    this.group.add(this.alarmLight);
    if (!isLow) {
      this.hangarLight = new THREE.PointLight(0x7dd3fc, 0, 14, 1.4);
      this.hangarLight.position.set(0, 3, -2.5);
      this.group.add(this.hangarLight);
    }

    this.syncInstant();
  }

  reset() {
    this.disarmed = false;
    this.airlockOpen = false;
    this.deniedFlash = 0;
    this.eventFlash = 0;
    this.successGlow = 0;
    this.parkRover();
  }

  parkRover() {
    this.cinematicTime = -1;
    if (this.rover) {
      this.rover.position.set(0, 0, ROVER_HOME_Z);
      this.setRoverThrust(0);
      this.setRoverLabel(this.defaultLabelMap);
    }
  }

  setRoverLabel(map) {
    const label = this.rover?.userData.nameLabel;
    if (!label || !map || label.material.map === map) return;
    label.material.map = map;
    label.material.needsUpdate = true;
  }

  setRoverThrust(amount) {
    const { flame, flameGlow } = this.rover?.userData || {};
    if (flame) flame.material.opacity = 0.75 * amount;
    if (flameGlow) flameGlow.material.opacity = 0.7 * amount;
  }

  startCinematic() {
    this.cinematicTime = 0;
    this.driveTime = 0;
    this.flyTo(this.cineView, 2.4);
    this.readyLabelMap ??= createTextTexture('LAUNCH READY ✓', '#ffffff', '#10b981');
    this.setRoverLabel(this.readyLabelMap);
  }

  updateCinematic(delta, open) {
    if (this.cinematicTime < 0) return;
    this.cinematicTime += delta;

    // 門滑開九成後再等 0.3 秒才點火，免得船撞上還沒開好的門（學生解除警報後立刻開門時很常見）
    if (open > 0.9) this.driveTime += delta;
    const driveK = Math.min(1, Math.max(0, (this.driveTime - 0.3) / 2.8));
    const drive = easeInOut(driveK);
    this.rover.position.z = ROVER_HOME_Z + (ROVER_OUT_Z - ROVER_HOME_Z) * drive;
    const moving = driveK > 0 && driveK < 1;
    this.setRoverThrust(moving ? 1 : 0);
    if (moving) {
      this.rover.userData.wheels?.forEach((w) => {
        w.children[0].rotation.x += delta * 9;
      });
    }
    if (driveK >= 1) this.cinematicTime = -2; // 演完，保留停在門前的樣子
  }

  setupTerminalScreen() {
    if (typeof document === 'undefined' || !this.terminal) return;
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 512;
    this.screenCanvas.height = 296;
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    const { screen } = this.terminal.userData;
    screen.material.map = this.screenTexture;
    screen.material.emissiveMap = this.screenTexture;
    screen.material.color.setHex(0xffffff);
    screen.material.needsUpdate = true;
    // 冷啟動時中文字型可能還沒載入，載入後清掉快取讓螢幕重畫
    document.fonts?.ready.then(() => {
      this.screenKey = '';
    });
  }

  /** 把網頁目前的狀態畫成終端機螢幕：狀態燈、艙門、兩顆按鈕 */
  drawTerminalScreen() {
    const key = `${this.disarmed}|${this.airlockOpen}`;
    if (!this.screenCanvas || key === this.screenKey) return;
    this.screenKey = key;
    const ctx = this.screenCanvas.getContext('2d');
    const W = this.screenCanvas.width;
    const H = this.screenCanvas.height;
    const font = '"Noto Sans TC", Outfit, sans-serif';

    ctx.fillStyle = '#081225';
    ctx.fillRect(0, 0, W, H);

    // 網址列
    ctx.fillStyle = '#16233d';
    ctx.fillRect(0, 0, W, 44);
    ['#f87171', '#fbbf24', '#34d399'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(24 + i * 22, 22, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#94a3b8';
    ctx.font = `22px ${font}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('station-control.local', 100, 23);

    // 狀態燈卡
    const statusColor = this.disarmed ? '#10b981' : '#ef4444';
    roundRect(ctx, 20, 62, W - 40, 82, 14);
    ctx.fillStyle = this.disarmed ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = statusColor;
    ctx.stroke();
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(64, 103, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold 40px ${font}`;
    ctx.fillText(this.disarmed ? '警報系統關閉' : '警戒鎖定中', 100, 105);

    // 艙門狀態
    const doorText = this.airlockOpen ? 'OPEN 已開啟' : this.disarmed ? 'UNLOCKED 待開啟' : 'LOCKED 鎖定中';
    const doorColor = this.airlockOpen ? '#10b981' : this.disarmed ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = doorColor;
    ctx.font = `bold 30px ${font}`;
    ctx.fillText(`艙門：${doorText}`, 24, 180);

    // 兩顆按鈕
    [['解除警報', this.disarmed, '#ef4444'], ['開啟氣閘門', this.airlockOpen, '#38bdf8']].forEach(([label, done, color], i) => {
      const x = 20 + i * ((W - 52) / 2 + 12);
      const w = (W - 52) / 2;
      roundRect(ctx, x, 214, w, 62, 12);
      ctx.fillStyle = done ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.12)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = done ? '#10b981' : color;
      ctx.stroke();
      ctx.fillStyle = '#f1f5f9';
      ctx.font = `bold 28px ${font}`;
      ctx.textAlign = 'center';
      ctx.fillText(done ? `${label} ✓` : label, x + w / 2, 246);
      ctx.textAlign = 'left';
    });

    this.screenTexture.needsUpdate = true;
  }

  /** 直接跳到目前狀態（剛進關卡、從存檔還原時不用重播動畫） */
  syncInstant() {
    this.unlockProgress = this.disarmed ? 1 : 0;
    this.openProgress = this.airlockOpen ? 1 : 0;
    this.update(0);
  }

  handleAction(actionType, payload = {}) {
    if (actionType === 'DOM_STATE') {
      this.disarmed = Boolean(payload.disarmed);
      this.airlockOpen = Boolean(payload.airlockOpen);
      if (payload.instant) this.syncInstant();
      return;
    }
    if (actionType === 'DOM_EVENT') {
      this.eventFlash = 1;
      return;
    }
    if (actionType === 'CAMERA_RESET') {
      // HUD「視角復位」：停掉飛行中的鏡頭，不然下一幀又被拉回去
      this.fly = null;
      return;
    }
    if (actionType === 'DOM_DENIED') {
      this.deniedFlash = 1;
      this.sceneManager?.cameraController?.kick(0.18);
      return;
    }
    if (actionType === 'RESET_SCENE' || actionType === 'RESET_POSITION') {
      // 3D 只是 DOM 的鏡子：場景還原只把鏡頭和探測船擺回去，不動網頁狀態
      this.parkRover();
      this.resetCamera();
      return;
    }
    if (actionType === 'RESET') {
      this.reset();
      this.resetCamera();
      return;
    }
    if (actionType === 'LEVEL_SUCCESS') {
      this.successGlow = 1;
      this.startCinematic();
    } else if (actionType === 'LEVEL_FAIL') {
      this.deniedFlash = 1;
    }
  }

  update(delta) {
    if (!this.bulkhead) return;
    this.time += delta;
    const t = this.time;
    const ud = this.bulkhead.userData;

    // 追目標：解鎖快、開門慢一點，像真的機械門
    this.unlockProgress = approach(this.unlockProgress, this.disarmed ? 1 : 0, delta * 2.2);
    const canOpen = this.airlockOpen && this.unlockProgress > 0.95;
    this.openProgress = approach(this.openProgress, canOpen ? 1 : 0, delta * 0.9);
    this.deniedFlash = Math.max(0, this.deniedFlash - delta * 1.4);
    this.eventFlash = Math.max(0, this.eventFlash - delta * 2.5);
    this.successGlow = Math.max(0, this.successGlow - delta * 0.35);

    const alarm = 1 - this.unlockProgress;
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    const open = easeInOut(this.openProgress);

    // 艙門滑進牆裡
    const half = ud.openWidth / 4;
    ud.doors.forEach((door, i) => {
      const side = i === 0 ? -1 : 1;
      door.position.x = side * (half + open * ud.openWidth * 0.52);
    });

    // 鎖栓：解除警報後縮回門裡
    ud.bolts.forEach((bolt) => {
      bolt.scale.y = Math.max(0.05, 1 - this.unlockProgress);
      bolt.visible = this.unlockProgress < 0.98;
    });

    // 狀態燈：紅色閃爍 → 綠色常亮
    const lampColor = lampTmp.copy(RED).lerp(GREEN, this.unlockProgress);
    ud.statusLamp.material.color.copy(lampColor);
    ud.statusLamp.material.emissive.copy(lampColor);
    ud.statusLamp.material.emissiveIntensity = 1.4 + alarm * pulse * 1.6 + 0.6 * this.unlockProgress;
    ud.statusGlow.material.color.copy(lampColor);
    ud.statusGlow.material.opacity = 0.35 + alarm * pulse * 0.4 + this.successGlow * 0.4;

    // 頂部燈條：警報時紅色脈動，解除後平靜青色
    const stripColor = tmpColor.copy(RED).lerp(CYAN, this.unlockProgress);
    ud.alarmStrip.material.color.copy(stripColor);
    ud.alarmStrip.material.emissive.copy(stripColor);
    ud.alarmStrip.material.emissiveIntensity = 0.6 + alarm * pulse * 1.6 + this.unlockProgress * 0.6;

    // 旋轉警示燈：警報時轉、解除後停下並轉綠
    ud.beacons.forEach(({ dome, beam }, i) => {
      beam.rotation.y = t * 4 + i * Math.PI;
      beam.material.opacity = 0.3 * alarm;
      beam.visible = alarm > 0.02;
      dome.material.color.copy(lampColor);
      dome.material.emissive.copy(lampColor);
      dome.material.emissiveIntensity = 0.8 + alarm * (0.6 + pulse * 1.2);
    });

    // 門框光條：被擋下時閃紅、解鎖時琥珀、開門時綠
    let frameColor = AMBER;
    let frameIntensity = this.unlockProgress * 0.8 * (1 - open);
    if (open > 0.01) {
      frameColor = GREEN;
      frameIntensity = 1.6 * open;
    }
    if (this.deniedFlash > 0) {
      frameColor = RED;
      frameIntensity = Math.max(frameIntensity, 2.5 * this.deniedFlash * (0.5 + 0.5 * Math.sin(t * 30)));
    }
    ud.frameGlowMat.emissive.copy(frameColor);
    ud.frameGlowMat.emissiveIntensity = frameIntensity;

    // 地板導引線
    const guideColor = tmpColor.copy(RED).lerp(AMBER, this.unlockProgress).lerp(GREEN, open);
    this.guideMat.emissive.copy(guideColor);
    this.guideMat.emissiveIntensity = 0.7 + alarm * pulse * 0.8 + open * 0.6;

    // 燈光
    this.alarmLight.intensity = alarm * (6 + pulse * 18) + this.deniedFlash * 20;
    if (this.hangarLight) this.hangarLight.intensity = open * 12 + this.successGlow * 12;
    this.hangarGlow.material.opacity = open * 0.28 + this.successGlow * 0.25;

    // 控制終端：網頁一有事件，螢幕就亮一下
    if (this.terminal) {
      const { screen, glow } = this.terminal.userData;
      this.drawTerminalScreen();
      // 螢幕本身已有網頁畫面，這裡只調亮度；被擋下時偏紅
      const screenColor = tmpColor.setHex(0xffffff).lerp(RED, this.deniedFlash * 0.7);
      screen.material.emissive.copy(screenColor);
      screen.material.emissiveIntensity = 0.5 + 0.06 * Math.sin(t * 2.2) + this.eventFlash * 0.5;
      glow.material.opacity = 0.2 + this.eventFlash * 0.5;
    }

    // 門後的探測船輕輕待機浮動；通關時開出氣閘
    if (this.rover) {
      this.rover.position.y = 0.04 + Math.sin(t * 2.4) * 0.03 * open;
      // 門被關上時，已經開出來的船要退回機庫，免得卡在門上（運鏡播放中門還在開，不算）
      if (open < 0.5 && this.cinematicTime < 0 && this.rover.position.z !== ROVER_HOME_Z) this.parkRover();
      this.updateCinematic(delta, open);
    }
    this.updateFly(delta);
  }

  dispose() {
    // 鏡位預設值是共用的，離開本關要還原，免得下一關沿用氣閘的遠景
    const cc = this.sceneManager?.cameraController;
    if (cc) {
      cc.defaultCamPos.set(0, 5, 10);
      cc.defaultTarget.set(0, 1, 0);
    }
    // 本關自己建的貼圖：BaseGameScene 只釋放 geometry / material，不會處理 map
    this.screenTexture?.dispose();
    this.readyLabelMap?.dispose();
    super.dispose();
  }
}

const ROVER_HOME_Z = -6.5;
const ROVER_OUT_Z = 3.2;

const tmpColor = new THREE.Color();
const lampTmp = new THREE.Color();

function approach(value, target, step) {
  if (value < target) return Math.min(target, value + step);
  return Math.max(target, value - step);
}

function easeInOut(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
