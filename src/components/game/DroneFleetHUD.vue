<template>
  <div class="drone-fleet-hud glass-panel">
    <!-- Matrix Header -->
    <div class="hud-header">
      <div class="header-left">
        <Radio :size="15" class="icon-radio" />
        <span class="hud-title">DRONE FLEET TELEMETRY MATRIX</span>
      </div>
      <span class="beacon-dot"></span>
    </div>

    <!-- Drone Fleet Grid -->
    <div class="drone-grid">
      <div
        v-for="d in drones"
        :key="d.id"
        class="drone-card"
        :class="{ 'card-warning': d.status === 'WARNING' || d.battery < 20 }"
      >
        <div class="card-top">
          <span class="drone-id">{{ d.id.toUpperCase() }}</span>
          <span
            :class="[
              'badge',
              (d.status === 'WARNING' || d.battery < 20)
                ? 'badge-danger'
                : d.status === 'PATROL'
                ? 'badge-emerald'
                : 'badge-cyan'
            ]"
          >
            {{ d.status || 'STANDBY' }}
          </span>
        </div>

        <div class="drone-coords">
          <span class="coord-label">POS:</span>
          <span class="coord-val">[{{ d.x }}, {{ d.y }}, {{ d.z }}]</span>
        </div>

        <div class="battery-section">
          <div class="battery-header">
            <span class="battery-label">PWR CELLS</span>
            <span
              class="battery-val"
              :class="{ 'text-danger': d.battery < 20 }"
            >
              {{ d.battery }}%
            </span>
          </div>
          <div class="battery-track">
            <div
              class="battery-fill"
              :style="{
                width: `${d.battery}%`,
                background: d.battery < 20
                  ? 'var(--danger-crimson)'
                  : d.battery < 50
                  ? 'var(--warning-amber)'
                  : 'var(--success-emerald)'
              }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Radio } from 'lucide-vue-next';

defineProps({
  drones: {
    type: Array,
    default: () => [
      { id: "drone-01", x: -6, y: 5, z: 2, battery: 85, status: 'STANDBY' },
      { id: "drone-02", x: -2, y: 7, z: -3, battery: 15, status: 'STANDBY' },
      { id: "drone-03", x: 3, y: 6, z: 1, battery: 92, status: 'STANDBY' },
      { id: "drone-04", x: 7, y: 4, z: -2, battery: 12, status: 'STANDBY' }
    ]
  }
});
</script>

<style scoped>
.drone-fleet-hud {
  position: absolute;
  top: 1rem;
  left: 1rem;
  width: 320px;
  background: rgba(10, 15, 27, 0.92);
  border: 1px solid var(--border-accent);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 229, 255, 0.15);
  border-radius: var(--radius-md);
  z-index: 10;
  pointer-events: auto;
  overflow: hidden;
}

.hud-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0.85rem;
  background: #0f182c;
  border-bottom: 1px solid var(--border-subtle);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon-radio {
  color: var(--cyan-primary);
}

.hud-title {
  font-family: var(--font-display);
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--cyan-primary);
  letter-spacing: 0.05em;
}

.drone-grid {
  padding: 0.65rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.drone-card {
  background: #060911;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-sm);
  padding: 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  transition: all var(--transition-fast);
}

.drone-card.card-warning {
  border-color: rgba(244, 63, 94, 0.35);
  background: rgba(244, 63, 94, 0.04);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drone-id {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  color: #f1f5f9;
}

.drone-coords {
  display: flex;
  gap: 0.3rem;
  font-family: var(--font-mono);
  font-size: 0.64rem;
}

.coord-label {
  color: var(--text-muted);
}

.coord-val {
  color: #94a3b8;
}

.battery-section {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.battery-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-family: var(--font-mono);
  font-size: 0.62rem;
}

.battery-label {
  color: var(--text-muted);
  font-weight: 600;
}

.battery-val {
  color: #cbd5e1;
  font-weight: 700;
}

.battery-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.battery-fill {
  height: 100%;
  transition: width 0.3s ease;
  box-shadow: 0 0 6px currentColor;
}
</style>
