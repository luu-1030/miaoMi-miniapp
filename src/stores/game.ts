import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { createInitialState, loadGame, saveGame } from '../game/engine'

export const useGameStore = defineStore('game', () => {
  const state = ref(loadGame(localStorage) ?? createInitialState())
  const saveError = ref(false)
  watch(state, () => { saveError.value = !saveGame(state.value, localStorage) }, { deep: true })
  return { state, saveError }
})
