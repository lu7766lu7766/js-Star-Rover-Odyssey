/**
 * Star Rover Odyssey - Base Game Scene Class
 */

import * as THREE from 'three';

export class BaseGameScene {
  constructor(id) {
    this.id = id;
    this.group = new THREE.Group();
    this.sceneManager = null;
    this.disposed = false;
    this.showGlobalGround = true;
  }

  init(sceneManager) {
    this.sceneManager = sceneManager;
    this.build();
  }

  build() {
    // Override in child classes
  }

  reset() {
    // Override in child classes
  }

  update(delta) {
    // Override in child classes
  }

  handleAction(actionType, payload) {
    // Override in child classes
  }

  dispose() {
    this.disposed = true;
    // Recursively dispose geometries and materials
    this.group.traverse((obj) => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.group.clear();
  }
}
