<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import CareerGames from './CareerGames.vue'
import { startCareerRound, submitCareerRound, type GameState, type Profession, type CareerSubmission } from '../game/engine'

const props = defineProps<{ state: GameState }>()
const emit = defineEmits<{ notify: [message: string, error?: boolean] }>()
function changeCareer(job: Profession) {
  const result = startCareerRound(props.state, job)
  if (!result.ok) emit('notify', result.message, true)
}
function completeCareer(_job: Profession, submission: CareerSubmission) {
  if (!props.state.careerRound) return
  const result = submitCareerRound(props.state, props.state.careerRound.id, submission)
  emit('notify', result.message, !result.ok)
}
function ensureRound() {
  if (!props.state.careerRound || (props.state.careerRound.claimed && Date.now() >= (props.state.lastCareerRewardAt ?? 0) + 60_000)) {
    startCareerRound(props.state, props.state.profession)
  }
}
let interval: ReturnType<typeof setInterval>
onMounted(() => { ensureRound(); interval = setInterval(ensureRound, 1000) })
onUnmounted(() => clearInterval(interval))
</script>

<template>
  <CareerGames :profession="state.profession" :round="state.careerRound" :cooldown-until="(state.lastCareerRewardAt ?? 0) + 60000" @change="changeCareer" @complete="completeCareer" />
</template>
