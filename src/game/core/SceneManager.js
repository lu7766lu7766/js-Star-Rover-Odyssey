/**
 * Star Rover Odyssey - Scene Manager (B-scheme upgrade)
 * PBR lighting + soft shadows + gradient sky + ground disc + auto shadow flags
 */

import * as THREE from 'three';
import { CameraController } from './CameraController.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class SceneManager {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.cameraController = null;
    this.activeGameScene = null;

    this.clock = new THREE.Clock();
    this.animationFrameId = null;
    this.isContextLost = false;
    this.isLowPerformance = localStorage.getItem('star_rover_low_perf') === 'true';

    this.onContextLostCallback = null;
    this.onContextRestoredCallback = null;

    this.skyDome = null;
    this.groundDisc = null;
    this.groundGrid = null;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // 1. Scene - soft daylight with distance haze
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeaf2ff);
    this.scene.fog = new THREE.Fog(0xeaf2ff, 38, 120);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500);
    this.camera.position.set(0, 7, 12);

    // 3. Renderer - PBR + shadows
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isLowPerformance,
        powerPreference: 'high-performance',
        alpha: false
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(this.isLowPerformance ? 1.0 : Math.min(window.devicePixelRatio, 2.0));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.shadowMap.enabled = !this.isLowPerformance;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // Image-based lighting for realistic metal / glass
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
      this.scene.environmentIntensity = 0.55;
      pmrem.dispose();

      this.container.appendChild(this.renderer.domElement);
    } catch (err) {
      console.error('[SceneManager] WebGL creation failed:', err);
      if (this.onContextLostCallback) this.onContextLostCallback(err);
      return;
    }

    // 4. Controls
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);

    // 5. Lighting + sky + ground
    this.setupLighting();
    this.setupSkyAndGround();
    this.setupStarfield();

    // 6. Events
    this.bindEvents();

    // 7. Loop
    this.startLoop();
  }

  setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0xf8fafc, 0.85);
    this.scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambientLight);

    // Key sun with shadows
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(14, 26, 16);
    dirLight.castShadow = !this.isLowPerformance;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -28;
    dirLight.shadow.camera.right = 28;
    dirLight.shadow.camera.top = 28;
    dirLight.shadow.camera.bottom = -28;
    dirLight.shadow.bias = -0.0004;
    dirLight.shadow.normalBias = 0.02;
    this.scene.add(dirLight);
    this.sunLight = dirLight;

    // Cool lilac rim from behind
    const rimLight = new THREE.DirectionalLight(0xc4b5fd, 0.9);
    rimLight.position.set(-18, 10, -16);
    this.scene.add(rimLight);

    // Warm bounce from below-front for friendly classroom look
    const bounce = new THREE.DirectionalLight(0xfdf4ff, 0.35);
    bounce.position.set(0, 4, 18);
    this.scene.add(bounce);
  }

  setupSkyAndGround() {
    // Gradient sky dome (BackSide shader, no texture needed)
    const skyGeo = new THREE.SphereGeometry(220, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0xbfdbfe) },
        midColor: { value: new THREE.Color(0xeaf2ff) },
        bottomColor: { value: new THREE.Color(0xf8fafc) }
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 midColor; uniform vec3 bottomColor;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y;
          vec3 col = h > 0.12
            ? mix(midColor, topColor, smoothstep(0.12, 0.75, h))
            : mix(bottomColor, midColor, smoothstep(-0.25, 0.12, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // Large soft ground disc receiving shadows
    // 深色機甲甲板：與白色探測車、白色塔台形成高對比，避免白 on 白看不清
    const groundGeo = new THREE.CircleGeometry(90, 64);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.95,
      metalness: 0.0
    });
    this.groundDisc = new THREE.Mesh(groundGeo, groundMat);
    this.groundDisc.position.y = -0.03;
    this.groundDisc.receiveShadow = true;
    this.scene.add(this.groundDisc);

    // Faint radial grid overlay handled per-level; keep a very subtle global grid
    // 深色地板上改用亮青 + 中灰，確保網格線清晰可見
    const grid = new THREE.GridHelper(140, 70, 0x38bdf8, 0x475569);
    grid.position.y = -0.015;
    grid.material.transparent = true;
    grid.material.opacity = 0.6;
    this.scene.add(grid);
    this.groundGrid = grid;
  }

  createStarTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.35, 'rgba(219, 234, 254, 0.8)');
    grad.addColorStop(0.7, 'rgba(147, 197, 253, 0.25)');
    grad.addColorStop(1, 'rgba(147, 197, 253, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  setupStarfield() {
    const particleCount = this.isLowPerformance ? 150 : 500;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 180;
      positions[i + 1] = Math.random() * 55 + 4;
      positions[i + 2] = (Math.random() - 0.5) * 180;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      map: this.createStarTexture(),
      size: 0.85,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      alphaTest: 0.02,
      sizeAttenuation: true
    });

    this.starfield = new THREE.Points(geo, mat);
    this.scene.add(this.starfield);
  }

  applyShadowFlags(object3D) {
    object3D.traverse((obj) => {
      if (obj.isMesh) {
        const name = (obj.name || '').toLowerCase();
        const isGroundLike = name.includes('grid') || name.includes('ground') || obj === this.groundDisc;
        if (!isGroundLike) {
          obj.castShadow = !this.isLowPerformance;
        }
        if (obj.position.y < 0.3 || isGroundLike) {
          obj.receiveShadow = true;
        }
        // Text plates / beacons should not cast harsh shadows
        if (obj.material && obj.material.isMeshBasicMaterial && obj.geometry && obj.geometry.type === 'PlaneGeometry') {
          obj.castShadow = false;
        }
      }
    });
  }

  bindEvents() {
    this.handleResize = this.onResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    // 拖曳分隔線、窄螢幕切換抽屜時，只有面板變大小、視窗沒變，也要重新調整畫布
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.container);
    }

    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.isContextLost = true;
      if (this.onContextLostCallback) this.onContextLostCallback();
    });

    canvas.addEventListener('webglcontextrestored', () => {
      this.isContextLost = false;
      this.init();
      if (this.onContextRestoredCallback) this.onContextRestoredCallback();
    });
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  setLowPerformance(isLow) {
    this.isLowPerformance = isLow;
    if (this.renderer) {
      this.renderer.setPixelRatio(isLow ? 1.0 : Math.min(window.devicePixelRatio, 2.0));
      this.renderer.shadowMap.enabled = !isLow;
      if (this.sunLight) this.sunLight.castShadow = !isLow;
    }
    if (this.activeGameScene) {
      this.applyShadowFlags(this.activeGameScene.group);
    }
  }

  switchGameScene(gameSceneInstance) {
    if (this.activeGameScene) {
      this.activeGameScene.dispose();
      if (this.activeGameScene.group) {
        this.scene.remove(this.activeGameScene.group);
      }
    }

    this.activeGameScene = gameSceneInstance;
    if (this.activeGameScene) {
      this.cameraController.reset();
      this.activeGameScene.init(this);
      const showGround = this.activeGameScene.showGlobalGround !== false;
      if (this.groundDisc) this.groundDisc.visible = showGround;
      if (this.groundGrid) this.groundGrid.visible = showGround;
      if (this.activeGameScene.group) {
        this.applyShadowFlags(this.activeGameScene.group);
        this.scene.add(this.activeGameScene.group);
      }
    } else {
      if (this.groundDisc) this.groundDisc.visible = true;
      if (this.groundGrid) this.groundGrid.visible = true;
    }
  }

  resetCurrentScene() {
    if (this.activeGameScene) {
      this.activeGameScene.reset();
      this.applyShadowFlags(this.activeGameScene.group);
    }
    if (this.cameraController) {
      this.cameraController.reset();
    }
  }

  startLoop() {
    const loop = () => {
      this.animationFrameId = requestAnimationFrame(loop);

      const delta = Math.min(this.clock.getDelta(), 0.1);

      if (this.starfield) {
        this.starfield.rotation.y += delta * 0.015;
      }

      if (this.cameraController) {
        this.cameraController.update(delta);
      }

      if (this.activeGameScene) {
        this.activeGameScene.update(delta);
      }

      if (this.renderer && this.scene && this.camera && !this.isContextLost) {
        this.renderer.render(this.scene, this.camera);
      }
    };

    loop();
  }

  stopLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  dispose() {
    this.stopLoop();
    window.removeEventListener('resize', this.handleResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.activeGameScene) {
      this.activeGameScene.dispose();
    }

    if (this.cameraController) {
      this.cameraController.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
