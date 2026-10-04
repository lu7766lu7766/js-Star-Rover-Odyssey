<template>
  <div class="control-deck-wrapper" :key="level.id + '-' + levelStore.resetNonce">
    <VariableDeclarationControl v-if="level.controlType === 'variable-declaration'" />
    <CommandSequenceControl v-else-if="level.controlType === 'command-sequence'" />
    <ParamAdjusterControl v-else-if="level.controlType === 'parameter-adjuster'" />
    <ConditionBuilderControl v-else-if="level.controlType === 'condition-builder'" />
    <ParkourControl v-else-if="level.controlType === 'parkour'" />
    <LoopBlocksControl v-else-if="level.controlType === 'loop-blocks'" />
    <ModuleObjectControl v-else-if="level.controlType === 'module-object'" />
    <DomEventsControl v-else-if="level.controlType === 'dom-events'" />
    <ArrayFleetControl v-else-if="level.controlType === 'array-fleet'" />
    <WeatherApiControl v-else-if="level.controlType === 'weather-api'" />
    <div v-else class="unknown-control card">
      <span>尚未配置此關卡操作介面</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useLevelStore } from '../../stores/levelStore.js';
import VariableDeclarationControl from './VariableDeclarationControl.vue';
import CommandSequenceControl from './CommandSequenceControl.vue';
import ParamAdjusterControl from './ParamAdjusterControl.vue';
import ConditionBuilderControl from './ConditionBuilderControl.vue';
import ParkourControl from './ParkourControl.vue';
import LoopBlocksControl from './LoopBlocksControl.vue';
import ModuleObjectControl from './ModuleObjectControl.vue';
import DomEventsControl from './DomEventsControl.vue';
import ArrayFleetControl from './ArrayFleetControl.vue';
import WeatherApiControl from './WeatherApiControl.vue';

const levelStore = useLevelStore();
const level = computed(() => levelStore.currentLevel);
</script>

<style scoped>
.control-deck-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.unknown-control {
  margin: 1.5rem;
  text-align: center;
  color: var(--text-muted);
}
</style>
