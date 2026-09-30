<script setup lang="ts">
import CatPortrait from './CatPortrait.vue'
defineProps<{ breed: string; name: string; sleeping?: boolean; accessory?: string; secondBreed?: string; reaction?: string; away?: boolean }>()
defineEmits<{ pet: [] }>()
</script>

<template>
  <div class="cozy-room">
    <div class="room-grain"></div>
    <svg class="room-art" viewBox="0 0 1000 475" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="wall" x2="0" y2="1"><stop stop-color="#f4eedc"/><stop offset="1" stop-color="#ece5d0"/></linearGradient>
        <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#dce7d5"/><stop offset="1" stop-color="#eef1d7"/></linearGradient>
        <pattern id="floor" width="195" height="53" patternUnits="userSpaceOnUse"><path d="M0 52h195M96 0v52" stroke="#c7b799" stroke-width="1" opacity=".28" /></pattern>
      </defs>
      <path fill="url(#wall)" d="M0 0h1000v340H0z"/><path fill="#e5d9bb" d="M0 331h1000v144H0z"/><path fill="url(#floor)" d="M0 338h1000v137H0z"/>
      <path d="M0 331h1000" stroke="#d5c8a9" stroke-width="7"/>
      <path d="m397 204 235-52 120 211-337 45z" fill="#fff9db" opacity=".36"/>
      <rect x="418" y="30" width="225" height="224" rx="8" fill="#d6c8aa"/><rect x="426" y="37" width="209" height="209" rx="4" fill="url(#sky)"/>
      <path d="M427 177c54-52 71-8 112-21s51-52 96-22v112H427" fill="#bac9aa" opacity=".6"/>
      <path d="M426 200c67-35 94-11 129-27s65 0 80 14v59H426" fill="#aabd95" opacity=".6"/>
      <path d="M530 36v208m-104-98h209" stroke="#fff6e1" stroke-width="9"/><path d="M412 250h240" stroke="#cdbd9a" stroke-width="12" stroke-linecap="round"/>
      <path d="M404 20h23c3 41 1 101-24 128l-23 6c17-40 10-87 24-134" fill="#e1d3b3"/><path d="M641 20h22c17 47 7 96 25 134l-26-7c-22-33-23-81-21-127" fill="#e1d3b3"/>
      <path d="M384 22h298" stroke="#b4a489" stroke-width="5" stroke-linecap="round"/>
      <g transform="translate(520 -40)"><rect x="213" y="96" width="73" height="84" rx="2" fill="#cbb992"/><rect x="220" y="103" width="59" height="70" fill="#faf5e6"/><path d="M248 159c-4-27 10-32 4-48m-2 29c-26 0-18-23-9-10m11-4c23-5 14-23 6-9" stroke="#9aa386" stroke-width="3" fill="none"/></g>
      <ellipse cx="230" cy="371" rx="149" ry="18" fill="#b3a98d" opacity=".17"/>
      <path d="M97 343v37m240-37v37" stroke="#9b886a" stroke-width="10" stroke-linecap="round"/>
      <rect x="92" y="219" width="249" height="129" rx="37" fill="#a4ad85"/><path d="M127 230h181c12 0 19 15 19 38v41H108v-51c0-16 7-28 19-28" fill="#b4bc95"/>
      <rect x="94" y="291" width="247" height="62" rx="22" fill="#a5ae86"/><rect x="79" y="272" width="41" height="77" rx="19" fill="#a5ad86"/><rect x="316" y="272" width="41" height="77" rx="19" fill="#a5ad86"/>
      <path d="M132 302h173" stroke="#8d9974" stroke-width="2" opacity=".7"/><rect x="133" y="247" width="68" height="57" rx="14" fill="#eae4c9" transform="rotate(-12 167 276)"/><path d="m148 256 36 38m-34-15 27-15" stroke="#d2c8a7" stroke-width="2"/>
      <path d="M249 258c35-15 55-4 57 19l-3 66c-27 1-47-4-51-16z" fill="#e4c99c"/><path d="m262 262 2 71m10-72 2 75m9-73 2 74m10-70 1 70" stroke="#cbae81" stroke-width="2" opacity=".5"/>
      <ellipse cx="569" cy="404" rx="173" ry="45" fill="#d0bd99" opacity=".7"/><ellipse cx="569" cy="400" rx="163" ry="39" fill="#ded0ac"/><ellipse cx="569" cy="400" rx="145" ry="30" fill="none" stroke="#caba94" stroke-width="2" stroke-dasharray="4 5"/>
      <path d="M797 246v103m88-103v103" stroke="#ac9673" stroke-width="7"/><path d="M782 249h119" stroke="#baa17b" stroke-width="14" stroke-linecap="round"/>
      <path d="M817 240h49l-7-44h-36z" fill="#c3a585"/><path d="M842 206c-5-27 0-49 11-81m-10 54c-34-2-43-29-25-29 10 0 19 17 24 29m4-22c32-5 36-31 20-30-10 0-16 14-20 30m4-15c-20-2-29-26-17-27 11-1 16 16 17 27m-9 51c30-2 46-25 27-26-14-1-20 15-27 26" fill="#8c9f75" stroke="#85976c" stroke-width="3"/>
      <path d="M907 378v-90m-27 28h56m-48 39h45" stroke="#bbaa89" stroke-width="12" stroke-linecap="round"/><path d="M876 282h63" stroke="#c7b595" stroke-width="17" stroke-linecap="round"/><ellipse cx="907" cy="389" rx="41" ry="12" fill="#bba887"/>
      <ellipse cx="742" cy="386" rx="29" ry="9" fill="#cfbea0"/><path d="M715 375h54l-7 15h-40z" fill="#aab99e"/><ellipse cx="742" cy="375" rx="27" ry="8" fill="#ced9bb"/><ellipse cx="742" cy="375" rx="21" ry="4" fill="#aebfad"/>
      <ellipse cx="380" cy="407" rx="12" ry="10" fill="#cba282"/><path d="m372 401 15 12m-5-16-7 18" stroke="#e6c4a2" stroke-width="2"/><path d="M390 408c24-3 20 18 37 13" fill="none" stroke="#cba282" stroke-width="2"/>
      <path d="M17 363h48l-8 56H25z" fill="#c9b48e"/><path d="M40 370v-83m0 51c-29 0-41-28-24-29 14-1 22 20 24 29m1-20c30-8 35-37 19-34-13 2-17 24-19 34m-1-16c-26-9-25-34-14-31 12 4 14 19 14 31" fill="#8e9d76" stroke="#82956b" stroke-width="3"/>
    </svg>
    <div class="room-label"><span></span> {{ sleeping ? '安静陪伴中' : '窝在一起，就是好时光' }}</div>
    <div v-if="reaction" class="cat-bubble">{{ reaction }}</div>
    <button v-if="!away" class="room-cat" @click="$emit('pet')" :aria-label="`摸摸${name}`"><CatPortrait :breed="breed" :sleeping="sleeping" :accessory="accessory" /></button>
    <div v-if="secondBreed" class="room-second-cat"><CatPortrait :breed="secondBreed" sleeping /></div>
    <span class="room-hint">{{away ? '小窝在等它回家' : `轻轻点一下，摸摸${name}`}}</span>
    <span class="room-sparkle sparkle-one">✦</span><span class="room-sparkle sparkle-two">✧</span>
  </div>
</template>
