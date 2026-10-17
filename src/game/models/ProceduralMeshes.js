/**
 * Star Rover Odyssey 2.0 - Procedural 3D Sci-Fi Meshes (B-scheme realism pass)
 * Native Three.js only, offline. Rounded hulls, PBR, emissive strips, glow sprites.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let _glowTexture = null;
export function createGlowTexture() {
  if (_glowTexture) return _glowTexture;
  if (typeof document === 'undefined') return new THREE.Texture();
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _glowTexture = new THREE.CanvasTexture(c);
  return _glowTexture;
}

export function createGlowSprite(color = 0x38bdf8, scale = 1.6, opacity = 0.7) {
  const mat = new THREE.SpriteMaterial({
    map: createGlowTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

/**
 * Dynamic text plate texture
 */
export function createTextTexture(text, bgColor = '#ffffff', textColor = '#2563eb') {
  if (typeof document === 'undefined') {
    return new THREE.Texture();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = textColor;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  ctx.fillStyle = textColor;
  ctx.font = 'bold 46px Outfit, "Noto Sans TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const safe = String(text).slice(0, 26);
  ctx.fillText(safe, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * 船身噴漆用的文字貼圖：透明底、字太長時自動縮小塞進畫布
 */
function createHullNameTexture(text) {
  if (typeof document === 'undefined') {
    return new THREE.Texture();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const safe = String(text).slice(0, 20);
  let size = 72;
  do {
    ctx.font = `900 ${size}px Outfit, "Noto Sans TC", sans-serif`;
    size -= 4;
  } while (size > 24 && ctx.measureText(safe).width > canvas.width - 24);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(safe, canvas.width / 2, canvas.height / 2);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillText(safe, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// 學生在第 1 關取的船名：之後新建的探測船都會噴上這個名字
let currentHullName = '';
const DEFAULT_HULL_NAME = 'STAR ROVER';

export function setRoverHullName(name) {
  currentHullName = typeof name === 'string' ? name.trim() : '';
}

/** 幫已經在場景裡的探測船換上新船名（例如剛在第 1 關取好名字） */
export function applyHullName(roverGroup, name = currentHullName) {
  const decals = roverGroup?.userData?.hullDecals;
  if (!decals) return;
  const texture = createHullNameTexture(name || DEFAULT_HULL_NAME);
  decals.forEach((mesh) => {
    mesh.material.map?.dispose();
    mesh.material.map = texture;
    mesh.material.needsUpdate = true;
  });
}

let _hazardTexture = null;
export function createHazardTexture() {
  if (_hazardTexture) return _hazardTexture;
  if (typeof document === 'undefined') return new THREE.Texture();
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Vibrant caution amber background
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, 256, 64);

  // High-contrast angled hazard stripes
  ctx.fillStyle = '#0f172a';
  for (let x = -64; x < 320; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 18, 0);
    ctx.lineTo(x - 6, 64);
    ctx.lineTo(x - 24, 64);
    ctx.closePath();
    ctx.fill();
  }

  // Neon crimson safety rims
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 60);

  _hazardTexture = new THREE.CanvasTexture(canvas);
  _hazardTexture.wrapS = THREE.RepeatWrapping;
  _hazardTexture.wrapT = THREE.RepeatWrapping;
  _hazardTexture.repeat.set(4, 1);
  _hazardTexture.colorSpace = THREE.SRGBColorSpace;
  return _hazardTexture;
}

/**
 * Hero exploration rover - rounded, believable, classroom-friendly
 */
export function createSciFiRover() {
  const group = new THREE.Group();
  group.name = 'SciFiRover';

  const whiteBody = new THREE.MeshStandardMaterial({
    color: 0xf8fafc, roughness: 0.32, metalness: 0.35
  });
  const blueAccent = new THREE.MeshStandardMaterial({
    color: 0x2563eb, roughness: 0.28, metalness: 0.55
  });
  const darkTrim = new THREE.MeshStandardMaterial({
    color: 0x1e293b, roughness: 0.55, metalness: 0.6
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x64748b, roughness: 0.3, metalness: 0.85
  });

  // Lower hull
  const hull = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.62, 3.6, 4, 0.14), whiteBody);
  hull.position.y = 0.78;
  group.add(hull);

  // Front nose bumper
  const nose = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.42, 0.7, 3, 0.12), whiteBody);
  nose.position.set(0, 0.66, 1.95);
  group.add(nose);

  // Cobalt spine
  const spine = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.1, 3.3, 2, 0.04), blueAccent);
  spine.position.set(0, 1.12, 0.1);
  group.add(spine);

  // Side skirts
  [-1.16, 1.16].forEach((x) => {
    const skirt = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.4, 2.9, 2, 0.06), darkTrim);
    skirt.position.set(x, 0.55, 0);
    group.add(skirt);
  });

  // Cockpit tub + glass canopy
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.85, 0.35, 24), darkTrim);
  tub.position.set(0, 1.2, 0.35);
  group.add(tub);

  const canopyGeo = new THREE.SphereGeometry(0.68, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2.1);
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc, roughness: 0.06, metalness: 0.1,
    transparent: true, opacity: 0.88, clearcoat: 1.0,
    clearcoatRoughness: 0.08, reflectivity: 0.9
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 1.32, 0.35);
  canopy.rotation.x = -0.18;
  group.add(canopy);

  // Interior pilot glow
  const seatGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0ea5e9, emissiveIntensity: 1.4 })
  );
  seatGlow.position.set(0, 1.38, 0.3);
  group.add(seatGlow);

  // Wheels with suspension + fenders
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9, metalness: 0.05 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.22, metalness: 0.9 });
  const wheels = [];
  const wheelPositions = [
    [-1.28, 0.5, 1.15], [1.28, 0.5, 1.15],
    [-1.28, 0.5, -1.15], [1.28, 0.5, -1.15]
  ];
  wheelPositions.forEach(([x, y, z]) => {
    const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.55, 10);
    const arm = new THREE.Mesh(armGeo, steelMat);
    arm.position.set(x * 0.82, 0.72, z);
    arm.rotation.z = x > 0 ? -0.9 : 0.9;
    group.add(arm);

    const wg = new THREE.Group();
    wg.position.set(x, y, z);

    const tireGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.36, 28);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    wg.add(tire);

    // tread blocks
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.12), tireMat);
      tread.position.set(0, Math.cos(a) * 0.5, Math.sin(a) * 0.5);
      tread.rotation.x = -a;
      wg.add(tread);
    }

    const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.38, 16);
    hubGeo.rotateZ(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    wg.add(hub);

    const fender = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.07, 10, 20, Math.PI), whiteBody);
    fender.position.y = 0.12;
    fender.rotation.y = Math.PI / 2;
    wg.add(fender);

    group.add(wg);
    wheels.push(wg);
  });
  group.userData.wheels = wheels;

  // Antenna mast + tip + mini dish
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.1, 10), steelMat);
  mast.position.set(-0.85, 1.7, -1.2);
  group.add(mast);
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 })
  );
  tip.position.set(-0.85, 2.28, -1.2);
  group.add(tip);
  const tipGlow = createGlowSprite(0xef4444, 0.7, 0.8);
  tipGlow.position.copy(tip.position);
  group.add(tipGlow);
  group.userData.antennaTip = tip;

  // Front light bar
  const lightBar = new THREE.Mesh(
    new RoundedBoxGeometry(1.5, 0.12, 0.1, 2, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe0f2fe, emissiveIntensity: 1.2 })
  );
  lightBar.position.set(0, 0.82, 2.31);
  group.add(lightBar);
  [-0.55, 0.55].forEach((x) => {
    const head = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff7ed })
    );
    head.position.set(x, 0.72, 2.32);
    group.add(head);
    const hg = createGlowSprite(0xfde68a, 0.9, 0.55);
    hg.position.set(x, 0.72, 2.4);
    group.add(hg);
  });

  // Twin ion thrusters
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.25, metalness: 0.9 });
  [-0.55, 0.55].forEach((x) => {
    const nozzleGeo = new THREE.CylinderGeometry(0.24, 0.34, 0.5, 20);
    nozzleGeo.rotateX(Math.PI / 2);
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.position.set(x, 0.78, -1.95);
    group.add(nozzle);
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 20),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    inner.position.set(x, 0.78, -2.2);
    inner.rotation.y = Math.PI;
    group.add(inner);
  });

  // Shared flame (kept for Level scenes API compatibility)
  const flameGeo = new THREE.ConeGeometry(0.42, 1.9, 20);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(0, 0.78, -3.0);
  group.add(flame);
  group.userData.flame = flame;
  const flameGlow = createGlowSprite(0x38bdf8, 2.0, 0.0);
  flameGlow.position.set(0, 0.78, -2.6);
  group.add(flameGlow);
  group.userData.flameGlow = flameGlow;

  // Rear deck battery bar with frame
  const barFrame = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.22, 0.08, 2, 0.03), darkTrim);
  barFrame.position.set(0, 1.32, -0.85);
  group.add(barFrame);
  const barFill = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.12, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  barFill.position.set(0, 1.32, -0.85);
  barFill.scale.x = 0.01;
  group.add(barFill);
  group.userData.batteryBar = barFill;

  // Name plate with backing
  const plateBack = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.5, 0.06, 2, 0.03), darkTrim);
  plateBack.position.set(0, 2.18, -0.05);
  group.add(plateBack);
  const labelMat = new THREE.MeshBasicMaterial({
    map: createTextTexture('STAR ROVER', '#ffffff', '#2563eb'),
    transparent: true
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.39), labelMat);
  label.position.set(0, 2.18, -0.01);
  group.add(label);
  group.userData.nameLabel = label;

  // 船名噴漆：左右兩側（兩個輪子中間）＋後甲板（車尾背板被推進器擋住）
  // 用 alphaTest 挖空背景、不設 transparent：跟車身一起在不透明階段畫，
  // 才不會被第 1 關的半透明防護罩之類的物件蓋掉
  const hullNameMat = new THREE.MeshBasicMaterial({
    map: createHullNameTexture(currentHullName || DEFAULT_HULL_NAME),
    alphaTest: 0.4
  });
  const hullDecals = [];
  [-1, 1].forEach((side) => {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), hullNameMat);
    decal.position.set(side * 1.162, 0.93, 0);
    decal.rotation.y = side * Math.PI / 2;
    group.add(decal);
    hullDecals.push(decal);
  });
  // 平貼在後甲板、略高於中央藍色脊條；字的上方朝車尾，從車頭方向看是正的
  const deckDecal = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), hullNameMat);
  deckDecal.position.set(0, 1.18, -1.4);
  deckDecal.rotation.x = -Math.PI / 2;
  group.add(deckDecal);
  hullDecals.push(deckDecal);
  group.userData.hullDecals = hullDecals;

  // Soft under-glow
  const shadowTex = createGlowTexture();
  const underMat = new THREE.MeshBasicMaterial({
    map: shadowTex, color: 0x2563eb, transparent: true, opacity: 0.22,
    depthWrite: false
  });
  const under = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.4), underMat);
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.02;
  group.add(under);

  return group;
}

/**
 * Grid floor - 高對比：亮青主線 + 中灰副線，深色甲板上清晰可見
 */
export function createSciFiGrid(size = 50, divisions = 50, primaryColor = 0x38bdf8, secondaryColor = 0x64748b) {
  const grid = new THREE.GridHelper(size, divisions, primaryColor, secondaryColor);
  grid.position.y = 0;
  grid.material.transparent = true;
  grid.material.opacity = 0.75;
  return grid;
}

/**
 * Landing pad with emissive ring + beacon column
 */
export function createLandingPad(radius = 1.4, color = 0x10b981) {
  const group = new THREE.Group();
  group.name = 'LandingPad';

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 0.25, radius + 0.35, 0.22, 40),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.8 })
  );
  rim.position.y = 0.11;
  group.add(rim);

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.16, 40),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.15 })
  );
  disc.position.y = 0.16;
  disc.receiveShadow = true;
  group.add(disc);

  const ringGeo = new THREE.TorusGeometry(radius * 0.82, 0.07, 12, 48);
  ringGeo.rotateX(Math.PI / 2);
  const ring = new THREE.Mesh(
    ringGeo,
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 })
  );
  ring.position.y = 0.26;
  group.add(ring);
  group.userData.ring = ring;

  const beaconGeo = new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, 3.2, 32, 1, true);
  const beaconMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.18,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.y = 1.7;
  group.add(beacon);
  group.userData.beacon = beacon;

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bollard = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 10),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.0 })
    );
    bollard.position.set(Math.cos(a) * (radius + 0.25), 0.32, Math.sin(a) * (radius + 0.25));
    group.add(bollard);
    const g = createGlowSprite(color, 0.8, 0.6);
    g.position.copy(bollard.position);
    group.add(g);
  }

  return group;
}

/**
 * 依單位球面頂點座標計算連續平滑岩石雜訊（同一座標必得相同位移，避免網格裂開）
 */
function sampleAsteroidNoise(nx, ny, nz, seed) {
  const s = seed * 17.31;
  const n1 = Math.sin(nx * 2.8 + s) * Math.cos(ny * 2.5 - s * 0.6) * Math.sin(nz * 2.7 + s * 1.2);
  const n2 = Math.sin((nx + ny) * 4.4 + s * 1.7) * Math.cos((ny - nz) * 4.1 - s * 0.9);
  const n3 = Math.cos((nx * 1.6 - nz * 2.2) * 3.9 + s * 0.4) * Math.sin(ny * 5.2 + s * 2.1);
  return n1 * 0.5 + n2 * 0.32 + n3 * 0.18;
}

/**
 * 建立具凹陷隕石坑與不規則稜角的閉合隕石幾何體
 */
function buildCrateredAsteroidGeo(radius = 1.0, seed = 0, detail = 3) {
  const baseGeo = new THREE.IcosahedronGeometry(radius, detail);
  const geo = mergeVertices(baseGeo);
  baseGeo.dispose();

  // 為每顆隕石產生 5 個分布在球面上的凹陷隕石坑中心
  const craters = [];
  const craterCount = 5;
  for (let c = 0; c < craterCount; c++) {
    const phi = Math.acos(1 - (2 * (c + 0.5)) / craterCount);
    const theta = Math.PI * (1 + Math.sqrt(5)) * c + seed * 2.47;
    const cx = Math.sin(phi) * Math.cos(theta);
    const cy = Math.cos(phi);
    const cz = Math.sin(phi) * Math.sin(theta);
    craters.push({
      cx,
      cy,
      cz,
      rad: 0.36 + ((c + seed) % 3) * 0.08,
      depth: 0.22 + (c % 2) * 0.07
    });
  }

  // 三軸不等比例縮放，讓整體輪廓像不規則岩石而非正球體
  const sx = 1.08 + Math.sin(seed * 1.9) * 0.12;
  const sy = 0.84 + Math.cos(seed * 2.3) * 0.08;
  const sz = 0.96 + Math.sin(seed * 3.1) * 0.12;

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x0 = pos.getX(i);
    const y0 = pos.getY(i);
    const z0 = pos.getZ(i);
    const len = Math.hypot(x0, y0, z0) || 1;
    const nx = x0 / len;
    const ny = y0 / len;
    const nz = z0 / len;

    const noise = sampleAsteroidNoise(nx, ny, nz, seed);
    let craterOffset = 0;
    for (let c = 0; c < craters.length; c++) {
      const cr = craters[c];
      const dot = THREE.MathUtils.clamp(nx * cr.cx + ny * cr.cy + nz * cr.cz, -1, 1);
      const ang = Math.acos(dot);
      if (ang < cr.rad * 1.18) {
        const t = ang / cr.rad;
        if (t < 0.82) {
          // 碗狀凹陷坑底
          const bowl = 1 - (t / 0.82) * (t / 0.82);
          craterOffset -= cr.depth * bowl;
        } else {
          // 隕石坑邊緣微凸環形山脊
          const rimT = (t - 0.82) / 0.36;
          craterOffset += cr.depth * 0.26 * Math.sin(rimT * Math.PI);
        }
      }
    }

    const scaleFactor = Math.max(0.52, 1.0 + noise * 0.22 + craterOffset);
    pos.setXYZ(
      i,
      x0 * sx * scaleFactor,
      y0 * sy * scaleFactor,
      z0 * sz * scaleFactor
    );
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Asteroids with merged vertices, smooth rocky displacement, craters, and orbiting debris
 */
export function createAsteroids(positions = null) {
  const group = new THREE.Group();
  group.name = 'AsteroidField';

  const mats = [
    new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.95,
      metalness: 0.08,
      flatShading: true,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.12
    }),
    new THREE.MeshStandardMaterial({
      color: 0x44403c,
      roughness: 0.96,
      metalness: 0.12,
      flatShading: true,
      emissive: 0x9a3412,
      emissiveIntensity: 0.15
    }),
    new THREE.MeshStandardMaterial({
      color: 0x6b5e55,
      roughness: 0.93,
      metalness: 0.06,
      flatShading: true,
      emissive: 0x431407,
      emissiveIntensity: 0.1
    })
  ];

  // 微弱橘紅熾熱裂縫內核材質（在深隕石坑底隱約透出微光）
  const fissureMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    emissive: 0xf97316,
    emissiveIntensity: 1.35,
    roughness: 0.6
  });

  // 共用環繞小碎石幾何體
  const pebbleGeo = buildCrateredAsteroidGeo(0.18, 11, 1);

  const defaultPositions = positions || [
    { x: -1.8, y: 1.0, z: 4.5, scale: 0.95 },
    { x: 2.3, y: 1.15, z: 6.2, scale: 1.15 },
    { x: -3.2, y: 1.35, z: 8.2, scale: 1.35 },
    { x: 0.6, y: 1.45, z: 9.8, scale: 1.25 },
    { x: 3.6, y: 1.5, z: 11.2, scale: 1.45 },
    { x: -2.2, y: 1.3, z: 12.4, scale: 1.2 }
  ];

  const list = [];
  defaultPositions.forEach((cfg, idx) => {
    const r = cfg.scale || 1.0;
    const geo = buildCrateredAsteroidGeo(r, idx + 1, 3);
    const mat = mats[idx % mats.length];
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cfg.x, cfg.y, cfg.z);
    mesh.rotation.set(
      (idx * 1.17) % Math.PI,
      (idx * 2.03) % Math.PI,
      (idx * 0.73) % Math.PI
    );

    // 內層熾熱岩漿核：半徑略大於最深隕石坑底，使坑底浮現橘紅熾熱裂痕
    const coreGeo = new THREE.IcosahedronGeometry(r * 0.64, 1);
    const coreMesh = new THREE.Mesh(coreGeo, fissureMat);
    coreMesh.scale.set(1.04, 0.82, 0.94);
    mesh.add(coreMesh);

    // 環繞主隕石的 2 顆小碎石
    for (let p = 0; p < 2; p++) {
      const pebble = new THREE.Mesh(pebbleGeo, mats[(idx + p + 1) % mats.length]);
      const angle = idx * 1.9 + p * Math.PI * 0.95;
      const dist = r * (1.28 + p * 0.2);
      pebble.position.set(
        Math.cos(angle) * dist,
        (p === 0 ? 0.25 : -0.22) * r,
        Math.sin(angle) * dist
      );
      pebble.rotation.set(angle, angle * 1.3, 0);
      pebble.scale.setScalar(0.75 + (p * 0.3) * Math.min(1.2, r));
      mesh.add(pebble);
    }

    group.add(mesh);
    list.push(mesh);
  });

  group.userData.asteroids = list;
  return group;
}

/**
 * Energy crystals with glow
 */
export function createCrystalMine() {
  const group = new THREE.Group();
  const crystals = [];

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.7, 0.35, 24),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8, metalness: 0.2 })
  );
  base.position.y = 0.17;
  group.add(base);

  const crystalGeo = new THREE.OctahedronGeometry(0.55, 0);
  const colors = [0x06b6d4, 0x8b5cf6, 0x10b981, 0xf59e0b, 0x3b82f6];

  for (let i = 0; i < 5; i++) {
    const col = colors[i % colors.length];
    const mat = new THREE.MeshPhysicalMaterial({
      color: col, emissive: col, emissiveIntensity: 0.55,
      roughness: 0.08, metalness: 0.1, clearcoat: 1.0,
      transparent: true, opacity: 0.96
    });
    const crystal = new THREE.Mesh(crystalGeo, mat);
    crystal.position.set(Math.sin(i * 1.3) * 0.7, 0.75, -4 + i * 2);
    crystal.rotation.y = i * 0.7;
    group.add(crystal);
    const glow = createGlowSprite(col, 1.6, 0.45);
    glow.position.copy(crystal.position);
    group.add(glow);
    crystals.push(crystal);
  }

  group.userData.crystals = crystals;
  return group;
}

/**
 * Robotic arm with joints
 */
export function createRoboticArm() {
  const group = new THREE.Group();
  group.name = 'RoboticArm';

  const darkMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.8 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3, metalness: 0.6 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.3, 20), darkMat);
  base.position.y = 0.15;
  group.add(base);

  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), blueMat);
  shoulder.position.y = 0.45;
  group.add(shoulder);

  const upperArm = new THREE.Mesh(new RoundedBoxGeometry(0.24, 1.15, 0.24, 2, 0.06), blueMat);
  upperArm.position.set(0, 1.05, 0);
  upperArm.rotation.z = 0.18;
  group.add(upperArm);

  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), darkMat);
  elbow.position.set(-0.1, 1.62, 0);
  group.add(elbow);

  const claw = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.45, 4), new THREE.MeshStandardMaterial({
    color: 0x10b981, roughness: 0.3, metalness: 0.5, emissive: 0x10b981, emissiveIntensity: 0.35
  }));
  claw.position.set(-0.14, 1.95, 0);
  claw.rotation.z = Math.PI;
  group.add(claw);

  group.userData.upperArm = upperArm;
  group.userData.claw = claw;
  return group;
}

/**
 * Scanner dish with feed arm + pulse ring
 */
export function createScannerDish() {
  const group = new THREE.Group();
  group.name = 'ScannerDish';

  const steel = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.7 });
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 0.6, 18), steel);
  mount.position.y = 0.3;
  group.add(mount);

  const head = new THREE.Group();
  head.position.y = 0.75;
  group.add(head);

  const dishGeo = new THREE.SphereGeometry(0.75, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2.4);
  dishGeo.rotateX(Math.PI / 3.2);
  const dish = new THREE.Mesh(dishGeo, new THREE.MeshStandardMaterial({
    color: 0xf8fafc, roughness: 0.25, metalness: 0.5, side: THREE.DoubleSide
  }));
  head.add(dish);

  const dishInner = new THREE.Mesh(dishGeo.clone(), new THREE.MeshStandardMaterial({
    color: 0x3b82f6, roughness: 0.2, metalness: 0.4, emissive: 0x1d4ed8, emissiveIntensity: 0.35,
    side: THREE.FrontSide
  }));
  dishInner.scale.setScalar(0.96);
  head.add(dishInner);

  const feedArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), steel);
  feedArm.position.set(0, 0.45, 0.35);
  feedArm.rotation.x = 0.7;
  head.add(feedArm);
  const feed = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshStandardMaterial({
    color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 2.0
  }));
  feed.position.set(0, 0.72, 0.62);
  head.add(feed);

  const ringGeo = new THREE.TorusGeometry(0.7, 0.035, 10, 48);
  ringGeo.rotateX(Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
    color: 0x38bdf8, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  ring.position.y = 0.15;
  head.add(ring);

  group.userData.head = head;
  group.userData.pulseRing = ring;
  return group;
}

/**
 * Airlock doors with panel detail
 */
export function createAirlockDoors() {
  const group = new THREE.Group();
  group.name = 'AirlockDoors';

  const frame = new THREE.Mesh(
    new RoundedBoxGeometry(7.4, 5.0, 0.9, 2, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.3 })
  );
  frame.position.set(0, 2.5, 0);
  group.add(frame);

  const opening = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 4.1),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
  );
  opening.position.set(0, 2.05, 0.46);
  group.add(opening);

  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.28, metalness: 0.65 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5, metalness: 0.4 });

  const doorGeo = new RoundedBoxGeometry(2.35, 4.0, 0.42, 2, 0.06);
  const leftDoor = new THREE.Mesh(doorGeo, doorMat);
  leftDoor.position.set(-1.18, 2.05, 0.55);
  group.add(leftDoor);
  const rightDoor = new THREE.Mesh(doorGeo, doorMat);
  rightDoor.position.set(1.18, 2.05, 0.55);
  group.add(rightDoor);

  [leftDoor, rightDoor].forEach((door) => {
    for (let i = 0; i < 3; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.02), lineMat);
      line.position.set(0, -1.2 + i * 1.1, 0.22);
      door.add(line);
    }
    const win = new THREE.Mesh(
      new RoundedBoxGeometry(0.9, 0.5, 0.05, 2, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.1, metalness: 0.2, emissive: 0x0ea5e9, emissiveIntensity: 0.4 })
    );
    win.position.set(0, 0.9, 0.22);
    door.add(win);
  });

  const lightBar = new THREE.Mesh(
    new RoundedBoxGeometry(1.0, 0.26, 0.16, 2, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.8 })
  );
  lightBar.position.set(0, 4.55, 0.5);
  group.add(lightBar);

  group.userData.leftDoor = leftDoor;
  group.userData.rightDoor = rightDoor;
  group.userData.statusLight = lightBar;
  return group;
}

/**
 * Patrol drone with blur discs + nav lights
 */
export function createPatrolDrone(name = 'DRONE', color = 0x2563eb) {
  const group = new THREE.Group();
  group.name = `Drone_${name}`;

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(0.95, 0.36, 1.25, 3, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.4 })
  );
  group.add(body);

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 18, 12),
    new THREE.MeshPhysicalMaterial({ color: 0x0f172a, roughness: 0.08, clearcoat: 1.0 })
  );
  canopy.scale.set(1, 0.55, 1.2);
  canopy.position.set(0, 0.22, 0.15);
  group.add(canopy);

  const armMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const armGeo = new THREE.BoxGeometry(1.95, 0.09, 0.16);
  const arm1 = new THREE.Mesh(armGeo, armMat);
  arm1.rotation.y = Math.PI / 4;
  group.add(arm1);
  const arm2 = new THREE.Mesh(armGeo, armMat);
  arm2.rotation.y = -Math.PI / 4;
  group.add(arm2);

  const motorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const blurMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd, transparent: true, opacity: 0.28,
    side: THREE.DoubleSide, depthWrite: false
  });
  const rotors = [];
  const rPositions = [
    [0.72, 0.12, 0.72], [-0.72, 0.12, 0.72],
    [0.72, 0.12, -0.72], [-0.72, 0.12, -0.72]
  ];
  rPositions.forEach(([x, y, z]) => {
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 12), motorMat);
    motor.position.set(x, y, z);
    group.add(motor);

    const blades = new THREE.Group();
    blades.position.set(x, y + 0.1, z);
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.015, 0.07), bladeMat);
    blades.add(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.62), bladeMat);
    blades.add(b2);
    const blur = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), blurMat);
    blur.rotation.x = -Math.PI / 2;
    blades.add(blur);
    group.add(blades);
    rotors.push(blades);
  });
  group.userData.rotors = rotors;

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 2.2 })
  );
  eye.position.set(0, 0.0, 0.66);
  group.add(eye);
  const eyeGlow = createGlowSprite(0x38bdf8, 0.7, 0.7);
  eyeGlow.position.set(0, 0.0, 0.72);
  group.add(eyeGlow);

  const navL = createGlowSprite(0xef4444, 0.5, 0.85);
  navL.position.set(-0.55, 0.05, 0);
  group.add(navL);
  const navR = createGlowSprite(0x10b981, 0.5, 0.85);
  navR.position.set(0.55, 0.05, 0);
  group.add(navR);

  return group;
}

/**
 * Drone with telemetry
 */
export function createDrone(id, x = 0, y = 0, z = 0, battery = 100) {
  const color = battery < 20 ? 0xf59e0b : 0x2563eb;
  const drone = createPatrolDrone(id, color);
  drone.position.set(x, y, z);
  drone.userData.droneId = id;
  drone.userData.battery = battery;
  drone.userData.initialPos = new THREE.Vector3(x, y, z);
  return drone;
}

/**
 * 3D Procedural Sci-Fi Parkour Astronaut
 * Articulated limbs for natural running, athletic hurdle jumps, and extreme low-profile baseball slides.
 */
export function createSciFiAstronaut() {
  const group = new THREE.Group();
  group.name = 'SciFiAstronaut';

  const suitWhite = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.35,
    metalness: 0.2
  });
  const armorNavy = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
    metalness: 0.65
  });
  const cyanEnergy = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x00f2ff,
    emissiveIntensity: 1.2,
    roughness: 0.2
  });
  const goldVisorMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    emissive: 0xb45309,
    emissiveIntensity: 0.4,
    roughness: 0.08,
    metalness: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1
  });
  const jointDark = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.7,
    metalness: 0.3
  });
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85
  });

  // Base pivot at ground
  const root = new THREE.Group();
  root.name = 'astronautRoot';
  group.add(root);

  // Pelvis / Hips (pivot for lower body and anchor for upper body)
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.78;
  root.add(pelvis);

  const hipMesh = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.22, 0.26, 2, 0.05), armorNavy);
  pelvis.add(hipMesh);

  // Torso & Upper Body
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.11, 0);
  pelvis.add(torsoGroup);

  // Lower abdomen
  const abMesh = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.20, 0.22, 2, 0.04), jointDark);
  abMesh.position.set(0, 0.09, 0);
  torsoGroup.add(abMesh);

  // Armored chest
  const chestMesh = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.40, 0.30, 3, 0.08), suitWhite);
  chestMesh.position.set(0, 0.36, 0);
  torsoGroup.add(chestMesh);

  // Chest arc reactor
  const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 16), cyanEnergy);
  reactor.rotation.x = Math.PI / 2;
  reactor.position.set(0, 0.38, 0.16);
  torsoGroup.add(reactor);

  // Jetpack on back
  const jetpack = new THREE.Group();
  jetpack.position.set(0, 0.34, -0.22);
  const packBody = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.40, 0.16, 2, 0.04), armorNavy);
  jetpack.add(packBody);

  // Jet thruster nozzles
  const nozzleGeo = new THREE.CylinderGeometry(0.045, 0.075, 0.14, 12);
  const thrusterL = new THREE.Mesh(nozzleGeo, jointDark);
  thrusterL.position.set(-0.11, -0.22, 0);
  jetpack.add(thrusterL);
  const thrusterR = new THREE.Mesh(nozzleGeo, jointDark);
  thrusterR.position.set(0.11, -0.22, 0);
  jetpack.add(thrusterR);

  // Thruster flames (cones)
  const flameGeo = new THREE.ConeGeometry(0.07, 0.35, 12);
  flameGeo.rotateX(Math.PI);
  const flameMeshL = new THREE.Mesh(flameGeo, flameMat);
  flameMeshL.position.set(-0.11, -0.38, 0);
  flameMeshL.visible = false;
  jetpack.add(flameMeshL);

  const flameMeshR = new THREE.Mesh(flameGeo, flameMat);
  flameMeshR.position.set(0.11, -0.38, 0);
  flameMeshR.visible = false;
  jetpack.add(flameMeshR);

  torsoGroup.add(jetpack);

  // Head & Helmet
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.62, 0);
  torsoGroup.add(headGroup);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.20, 24, 20), suitWhite);
  headGroup.add(helmet);

  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16, 0, Math.PI, 0, Math.PI * 0.75), goldVisorMat);
  visor.position.set(0, 0.02, 0.03);
  headGroup.add(visor);

  // Left Leg (pivot at hip)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.15, -0.06, 0);
  pelvis.add(leftLeg);

  const leftThigh = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.36, 0.17, 2, 0.04), suitWhite);
  leftThigh.position.set(0, -0.18, 0);
  leftLeg.add(leftThigh);

  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, -0.36, 0);
  leftLeg.add(leftKnee);

  const leftShin = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.36, 0.16, 2, 0.04), armorNavy);
  leftShin.position.set(0, -0.16, 0);
  leftKnee.add(leftShin);

  const leftFoot = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.11, 0.28, 2, 0.03), suitWhite);
  leftFoot.position.set(0, -0.33, 0.05);
  leftKnee.add(leftFoot);

  const leftSoleLight = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.24), cyanEnergy);
  leftSoleLight.position.set(0, -0.385, 0.05);
  leftKnee.add(leftSoleLight);

  // Right Leg (pivot at hip)
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.15, -0.06, 0);
  pelvis.add(rightLeg);

  const rightThigh = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.36, 0.17, 2, 0.04), suitWhite);
  rightThigh.position.set(0, -0.18, 0);
  rightLeg.add(rightThigh);

  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, -0.36, 0);
  rightLeg.add(rightKnee);

  const rightShin = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.36, 0.16, 2, 0.04), armorNavy);
  rightShin.position.set(0, -0.16, 0);
  rightKnee.add(rightShin);

  const rightFoot = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.11, 0.28, 2, 0.03), suitWhite);
  rightFoot.position.set(0, -0.33, 0.05);
  rightKnee.add(rightFoot);

  const rightSoleLight = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.24), cyanEnergy);
  rightSoleLight.position.set(0, -0.385, 0.05);
  rightKnee.add(rightSoleLight);

  // Left Arm (pivot at shoulder)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.31, 0.44, 0);
  torsoGroup.add(leftArm);

  const leftShoulder = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.16, 0.18, 2, 0.04), armorNavy);
  leftArm.add(leftShoulder);

  const leftBicep = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.26, 0.13, 2, 0.03), suitWhite);
  leftBicep.position.set(0, -0.13, 0);
  leftArm.add(leftBicep);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -0.26, 0);
  leftArm.add(leftElbow);

  const leftForearm = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.24, 0.13, 2, 0.03), suitWhite);
  leftForearm.position.set(0, -0.12, 0);
  leftElbow.add(leftForearm);

  const leftHand = new THREE.Mesh(new RoundedBoxGeometry(0.10, 0.11, 0.12, 2, 0.03), armorNavy);
  leftHand.position.set(0, -0.26, 0);
  leftElbow.add(leftHand);

  // Right Arm (pivot at shoulder)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.31, 0.44, 0);
  torsoGroup.add(rightArm);

  const rightShoulder = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.16, 0.18, 2, 0.04), armorNavy);
  rightArm.add(rightShoulder);

  const rightBicep = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.26, 0.13, 2, 0.03), suitWhite);
  rightBicep.position.set(0, -0.13, 0);
  rightArm.add(rightBicep);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -0.26, 0);
  rightArm.add(rightElbow);

  const rightForearm = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.24, 0.13, 2, 0.03), suitWhite);
  rightForearm.position.set(0, -0.12, 0);
  rightElbow.add(rightForearm);

  const rightHand = new THREE.Mesh(new RoundedBoxGeometry(0.10, 0.11, 0.12, 2, 0.03), armorNavy);
  rightHand.position.set(0, -0.26, 0);
  rightElbow.add(rightHand);

  // Slide sparks particles group
  const slideSparks = new THREE.Group();
  slideSparks.position.set(0, 0.05, 0);
  for (let i = 0; i < 5; i++) {
    const s = createGlowSprite(0x38bdf8, 0.45, 0.85);
    s.visible = false;
    slideSparks.add(s);
  }
  root.add(slideSparks);

  // Store references for animation
  group.userData = {
    root,
    pelvis,
    torsoGroup,
    headGroup,
    leftLeg,
    leftKnee,
    rightLeg,
    rightKnee,
    leftArm,
    leftElbow,
    rightArm,
    rightElbow,
    flameMeshL,
    flameMeshR,
    slideSparks
  };

  return group;
}
