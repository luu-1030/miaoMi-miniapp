<script setup lang="ts">
withDefaults(defineProps<{ breed?: string; sleeping?: boolean; accessory?: string }>(), { breed: 'orange', sleeping: false, accessory: '' })
</script>

<template>
  <svg class="cat-portrait" :class="[breed, { sleeping }]" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="一只圆乎乎的小猫咪" role="img">
    <ellipse cx="120" cy="211" rx="76" ry="12" fill="#74684c" opacity=".09" />
    <path class="cat-tail" d="M177 188C229 194 229 139 205 141c-18 1-8 27-29 23" stroke="var(--cat-fur)" stroke-width="24" stroke-linecap="round" />
    <path d="M63 174c-1-36 19-61 55-61s62 24 62 60l-7 28H71z" fill="var(--cat-fur)" />
    <ellipse cx="124" cy="181" rx="31" ry="29" fill="var(--cat-light)" />
    <path d="m57 84-2-51c0-8 4-9 10-5l37 26m80 30 3-51c0-8-4-9-10-5l-37 26" fill="var(--cat-fur)" stroke="var(--cat-outline)" stroke-width="2" stroke-linejoin="round" />
    <path d="m64 68-1-27 24 19m71 0 19-18-1 29" fill="#e8aaa2" />
    <path d="M48 104c0-35 25-58 71-58s76 23 76 58c0 39-31 62-75 62S48 143 48 104" fill="var(--cat-fur)" stroke="var(--cat-outline)" stroke-width="2" />
    <path v-if="breed === 'calico'" d="M48 99c1-29 18-47 44-51l12 46-31 28z" fill="#746554" />
    <path v-if="breed === 'tuxedo'" d="M112 61 91 104l-18 24c13 31 78 35 94 0l-22-23-18-44" fill="#fff8e9" />
    <path v-if="breed === 'orange'" d="m110 49 4 17m11-18 0 19m12-15-5 14M51 104l15 5m-13 9 15 3m122-19-15 7m13 7-14 4" stroke="#bc8954" stroke-width="7" stroke-linecap="round" opacity=".55" />
    <ellipse cx="79" cy="122" rx="12" ry="6" fill="#e6a597" opacity=".55" />
    <ellipse cx="160" cy="122" rx="12" ry="6" fill="#e6a597" opacity=".55" />
    <g v-if="!sleeping" class="cat-eyes" stroke="#554c41" stroke-width="5" stroke-linecap="round"><path d="M88 105v7m63-7v7" /></g>
    <g v-else stroke="#554c41" stroke-width="3.5" stroke-linecap="round"><path d="m79 111 9-5 9 5m44 0 9-5 9 5" /></g>
    <path d="m115 118 5 4 5-4" fill="#a97768" stroke="#a97768" stroke-width="2" stroke-linejoin="round" />
    <path d="M120 124c0 9-12 9-12 3m12-3c0 9 12 9 12 3" stroke="#756253" stroke-width="2" stroke-linecap="round" />
    <path d="m59 127-23-3m24 11-20 3m141-11 23-3m-24 11 20 3" stroke="#8e785a" stroke-width="1.7" stroke-linecap="round" opacity=".6" />
    <path d="M78 177v23c0 13 30 13 30 0v-19m28 0v19c0 13 29 13 29 0v-23" fill="var(--cat-fur)" stroke="var(--cat-outline)" stroke-width="2" stroke-linecap="round" />
    <path d="M87 199v5m9-5v5m48-5v5m9-5v5" stroke="var(--cat-outline)" stroke-width="1.5" stroke-linecap="round" />
    <g v-if="accessory==='ribbon'"><path d="m104 159-19-10v24l19-9 18 8v-23z" fill="#c68f94" /><circle cx="105" cy="161" r="5" fill="#e3b7b8" /></g>
    <g v-else-if="accessory==='scarf'"><path d="M81 153q39 21 77 0l-2 15q-38 18-72-1z" fill="#a1bcb0"/><path d="m139 166-5 30 17 1 2-34" fill="#8ca99c"/><path d="M136 190h15" stroke="#bed2c4" stroke-width="3"/></g>
  </svg>
</template>

<style scoped>
.cat-portrait { --cat-fur:#e4bc81; --cat-light:#f6dfb5; --cat-outline:#c4a077; width:100%; height:100%; overflow:visible }
.cat-portrait.british { --cat-fur:#a6b1b9; --cat-light:#d3dce0; --cat-outline:#8e9ba5 }
.cat-portrait.ragdoll { --cat-fur:#eee8dc; --cat-light:#fff9ef; --cat-outline:#c5beb2 }
.cat-portrait.calico { --cat-fur:#eed2a4; --cat-light:#fcf4df; --cat-outline:#cfb78f }
.cat-portrait.tuxedo { --cat-fur:#66665f; --cat-light:#f6efde; --cat-outline:#57574f }
.cat-eyes { transform-origin:120px 108px; animation:blink 6s infinite }
.cat-tail { transform-origin:178px 177px; animation:tail 5s ease-in-out infinite }
@keyframes blink { 0%,43%,47%,100% {transform:scaleY(1)} 45% {transform:scaleY(.1)} }
@keyframes tail { 0%,100% {transform:rotate(-4deg)} 50% {transform:rotate(5deg)} }
@media (prefers-reduced-motion:reduce) { .cat-eyes,.cat-tail {animation:none} }
</style>
