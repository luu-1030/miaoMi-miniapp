<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Check, Clock3, CodeXml, Coins, Palette, PenLine, RotateCcw, Sparkles } from 'lucide-vue-next'
import { PAINT_COLORS, PAINTING_REFERENCE, PROGRAMMING_QUESTIONS, WRITING_TOPIC, type Profession } from '../game/data'
import type { CareerRound, CareerSubmission } from '../game/engine'

type Job = Profession

const props = defineProps<{ profession: string; cooldownUntil?: number; round?: CareerRound | null }>()
const emit = defineEmits<{ complete: [job: Job, submission: CareerSubmission]; change: [job: Job] }>()

const jobs = [
  { id: 'programmer' as const, label: '程序员', icon: CodeXml, description: '用小小的代码，换一份猫粮。' },
  { id: 'writer' as const, label: '作家', icon: PenLine, description: '把与小咪的日常，写成温柔的故事。' },
  { id: 'painter' as const, label: '画家', icon: Palette, description: '一格一格，画出你眼里的小可爱。' },
]
const activeJob = computed<Job>(() => jobs.some(job => job.id === props.profession) ? props.profession as Job : 'programmer')
const activeDescription = computed(() => jobs.find(job => job.id === activeJob.value)!.description)
const now = ref(Date.now())
const submitted = ref(false)
const submittedUntil = ref(0)
const submittedRoundId = ref<string | null>(null)
let timer: ReturnType<typeof setInterval> | undefined
const remainingSeconds = computed(() => Math.max(0, Math.ceil((Math.max(props.cooldownUntil ?? 0, submittedUntil.value) - now.value) / 1000)))
const isCoolingDown = computed(() => remainingSeconds.value > 0)
const cooldownText = computed(() => `${Math.floor(remainingSeconds.value / 60).toString().padStart(2, '0')}:${(remainingSeconds.value % 60).toString().padStart(2, '0')}`)

const questions = computed(() => {
  const ids = props.round?.questionIds ?? PROGRAMMING_QUESTIONS.slice(0, 3).map(question => question.id)
  return ids.map(id => PROGRAMMING_QUESTIONS.find(question => question.id === id)).filter(question => question !== undefined).map(question => {
    const shift = [...`${props.round?.id ?? 'first'}-${question.id}`].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 4
    return { ...question, options: [...question.options.slice(shift), ...question.options.slice(0, shift)] }
  })
})
const questionIndex = ref(0)
const answers = ref<number[]>([-1, -1, -1])
const currentQuestion = computed(() => questions.value[questionIndex.value] ?? PROGRAMMING_QUESTIONS[0])
const answeredCount = computed(() => answers.value.filter(answer => answer >= 0).length)
const story = ref('')
const keywords = WRITING_TOPIC.groups.map(group => group[0]!)
const storyLength = computed(() => story.value.replace(/[\s\p{P}\p{S}]/gu, '').length)
const keywordMatched = (index: number) => WRITING_TOPIC.groups[index]!.some(word => story.value.includes(word))
const keywordCount = computed(() => WRITING_TOPIC.groups.filter((_, index) => keywordMatched(index)).length)

const colors = PAINT_COLORS.map((value, index) => ({ value: index === 0 ? '#fff8e9' : value, label: ['橡皮', '焦糖橘', '奶油黄', '可可棕', '柔软粉'][index]! }))
const referencePixels = PAINTING_REFERENCE
const pixels = ref<number[]>(Array(64).fill(0))
const selectedColor = ref(1)
const painting = ref(false)
const focusedPixel = ref(0)
const paintedCount = computed(() => pixels.value.filter(pixel => pixel !== 0).length)
const waitingForRound = computed(() => props.round !== undefined && (!props.round || props.round.claimed || props.round.profession !== activeJob.value))
const ready = computed(() => {
  if (waitingForRound.value) return false
  if (activeJob.value === 'programmer') return answeredCount.value === questions.value.length
  if (activeJob.value === 'writer') return storyLength.value >= 30
  return paintedCount.value > 0
})
const submitHint = computed(() => {
  if (isCoolingDown.value) return '小咪在帮你接下一份委托，休息一下吧。'
  if (activeJob.value === 'programmer') return `完成 3 道语法题，按答对数量获得报酬（${answeredCount.value}/3）。`
  if (activeJob.value === 'writer') return '至少写 30 字（不含标点），按篇幅与主题关键词评分。'
  return '对照左边的小咪作画，相似度越高，报酬越多。'
})

function chooseJob(job: Job) {
  if (isCoolingDown.value || submitted.value) return
  stopPainting()
  if (job !== activeJob.value) emit('change', job)
}

async function jobKeys(event: KeyboardEvent) {
  if (isCoolingDown.value || submitted.value) return
  const index = jobs.findIndex(job => job.id === activeJob.value)
  let next = index
  if (event.key === 'ArrowRight') next = (index + 1) % jobs.length
  else if (event.key === 'ArrowLeft') next = (index + jobs.length - 1) % jobs.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = jobs.length - 1
  else return
  event.preventDefault()
  const tablist = event.currentTarget as HTMLElement
  chooseJob(jobs[next]!.id)
  await nextTick()
  tablist.querySelector<HTMLButtonElement>(`[data-job="${activeJob.value}"]`)?.focus()
}

function paint(index: number) {
  if (isCoolingDown.value || submitted.value) return
  pixels.value[index] = selectedColor.value
}

function startPainting(event: PointerEvent, index: number) {
  if (event.button !== 0 || !event.isPrimary || isCoolingDown.value || submitted.value) return
  event.preventDefault()
  focusedPixel.value = index
  ;(event.currentTarget as HTMLButtonElement).focus({ preventScroll: true })
  painting.value = true
  paint(index)
}

function pixelKeys(event: KeyboardEvent, index: number) {
  let next = index
  if (event.key === 'ArrowRight') next = Math.min(63, index + 1)
  else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1)
  else if (event.key === 'ArrowDown') next = Math.min(63, index + 8)
  else if (event.key === 'ArrowUp') next = Math.max(0, index - 8)
  else if (event.key === 'Home') next = event.ctrlKey ? 0 : Math.floor(index / 8) * 8
  else if (event.key === 'End') next = event.ctrlKey ? 63 : Math.floor(index / 8) * 8 + 7
  else return
  event.preventDefault()
  focusedPixel.value = next
  const grid = (event.currentTarget as HTMLElement).parentElement
  grid?.querySelector<HTMLButtonElement>(`[data-pixel="${next}"]`)?.focus()
}

function movePainting(event: PointerEvent) {
  if (!painting.value) return
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>('[data-pixel]')
  if (cell && event.currentTarget instanceof HTMLElement && event.currentTarget.contains(cell)) {
    const index = Number(cell.dataset.pixel)
    if (Number.isInteger(index) && index >= 0 && index < 64) paint(index)
  }
}

function stopPainting() {
  painting.value = false
}

async function submit() {
  if (!ready.value || isCoolingDown.value || submitted.value) return
  submitted.value = true
  submittedRoundId.value = props.round?.id ?? null
  // Keep the button locked while the parent validates and updates the shared cooldown.
  submittedUntil.value = Date.now() + 60_000
  const submission: CareerSubmission = activeJob.value === 'programmer'
    ? { answers: Object.fromEntries(questions.value.map((question, index) => [question.id, question.options[answers.value[index]!]!])) }
    : activeJob.value === 'writer'
      ? { text: story.value.trim() }
      : { pixels: [...pixels.value] }
  emit('complete', activeJob.value, submission)
  await nextTick()
  if (props.round !== undefined && (props.cooldownUntil ?? 0) <= Date.now()) {
    // A rejected submission can be corrected and retried immediately.
    submitted.value = false
    submittedUntil.value = 0
    submittedRoundId.value = null
  }
}

watch(() => props.cooldownUntil, value => {
  if (value && value > now.value) submittedUntil.value = value
})
watch(() => props.round?.id, (_, previous) => {
  if (previous === submittedRoundId.value) {
    story.value = ''
    pixels.value = Array(64).fill(0)
    submittedRoundId.value = null
  }
  answers.value = [-1, -1, -1]
  questionIndex.value = 0
  submitted.value = false
  stopPainting()
})
watch(isCoolingDown, (cooling, previous) => {
  if (!cooling && previous && submitted.value) {
    submitted.value = false
    submittedUntil.value = 0
    submittedRoundId.value = null
    answers.value = [-1, -1, -1]
    questionIndex.value = 0
    story.value = ''
    pixels.value = Array(64).fill(0)
  }
})
onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 1000)
  window.addEventListener('pointerup', stopPainting)
  window.addEventListener('pointercancel', stopPainting)
  window.addEventListener('blur', stopPainting)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('pointerup', stopPainting)
  window.removeEventListener('pointercancel', stopPainting)
  window.removeEventListener('blur', stopPainting)
})
</script>

<template>
  <section class="career-games" aria-label="职业小游戏">
    <div class="career-intro">
      <span class="intro-icon"><Coins :size="24" :stroke-width="1.5" /></span>
      <div><h2>努力一点点，生活甜一点</h2><p>接一份小委托，给小咪攒下一罐快乐。</p></div>
    </div>

    <div class="job-tabs" role="tablist" aria-label="选择职业" @keydown="jobKeys">
      <button v-for="job in jobs" :id="`career-tab-${job.id}`" :key="job.id" :data-job="job.id" type="button" role="tab" aria-controls="career-assignment" :tabindex="activeJob === job.id ? 0 : -1" :aria-selected="activeJob === job.id" :class="{ active: activeJob === job.id }" :disabled="isCoolingDown || submitted" :title="isCoolingDown ? '休息一分钟后，可以选择下一份职业委托' : job.label" @click="chooseJob(job.id)">
        <component :is="job.icon" :size="19" :stroke-width="1.7" /><span>{{ job.label }}</span><Check v-if="activeJob === job.id" :size="15" class="job-check" />
      </button>
    </div>

    <div id="career-assignment" class="assignment" role="tabpanel" :aria-labelledby="`career-tab-${activeJob}`">
      <div class="assignment-topline"><span class="eyebrow">TODAY'S LITTLE TASK</span><span class="task-tag"><Sparkles :size="13" /> 小咪的生活基金</span></div>
      <p class="job-description">{{ activeDescription }}</p>

      <div v-if="activeJob === 'programmer'" class="code-game">
        <div class="question-heading"><h3>{{ currentQuestion.prompt }}</h3><span>{{ questionIndex + 1 }} / 3</span></div>
        <div class="code-window"><div class="code-toolbar"><i></i><i></i><i></i><span>hello-miaomi.js</span></div><code><span class="code-line">01</span>{{ currentQuestion.code }}</code></div>
        <div class="answer-options">
          <button v-for="(option, index) in currentQuestion.options" :key="index" type="button" :class="{ selected: answers[questionIndex] === index }" :disabled="isCoolingDown || submitted" :aria-pressed="answers[questionIndex] === index" @click="answers[questionIndex] = index">
            <span class="option-letter">{{ ['A', 'B', 'C', 'D'][index] }}</span><code>{{ option }}</code><Check v-if="answers[questionIndex] === index" :size="16" />
          </button>
        </div>
        <div class="question-navigation">
          <button type="button" :disabled="questionIndex === 0" @click="questionIndex--"><ArrowLeft :size="15" /> 上一题</button>
          <div class="question-dots"><button v-for="(_, index) in questions" :key="index" type="button" :class="{ current: questionIndex === index, answered: answers[index]! >= 0 }" :aria-label="`跳到第 ${index + 1} 题`" @click="questionIndex = index"></button></div>
          <button type="button" :disabled="questionIndex === questions.length - 1" @click="questionIndex++">下一题 <ArrowRight :size="15" /></button>
        </div>
      </div>

      <div v-else-if="activeJob === 'writer'" class="writing-game">
        <div class="writing-prompt"><span class="prompt-mark">“</span><div><span class="prompt-label">今日写作主题</span><h3>{{ WRITING_TOPIC.title }}</h3><p>{{ WRITING_TOPIC.prompt }}</p></div></div>
        <div class="keyword-row"><span>灵感关键词</span><span v-for="(keyword, index) in keywords" :key="keyword" class="keyword" :class="{ included: keywordMatched(index) }" :title="WRITING_TOPIC.groups[index]!.join(' / ')"><Check v-if="keywordMatched(index)" :size="12" />{{ keyword }}</span></div>
        <label for="miaomi-story" class="visually-hidden">写下雨天与小咪的故事，至少 30 字</label>
        <textarea id="miaomi-story" v-model="story" maxlength="600" :disabled="isCoolingDown || submitted" placeholder="雨水轻轻敲着窗台，小猫把脑袋搁在我的手边。有它陪伴的日子……" />
        <div class="writing-count"><span>已点亮 {{ keywordCount }} / {{ keywords.length }} 组主题词</span><span :class="{ enough: storyLength >= 30 }">正文 {{ storyLength }} 字 · 输入上限 600 字符</span></div>
      </div>

      <div v-else class="painting-game">
        <h3>画一只暖暖的小橘猫</h3><p id="painting-instructions" class="painting-description">选色后点击或拖动涂色，白色可以擦除。键盘方向键移动，空格涂色。</p>
        <div class="pixel-canvases">
          <figure><div class="pixel-grid reference-grid" role="img" aria-label="8 乘 8 像素橘猫参考图"><span v-for="(pixel, index) in referencePixels" :key="index" :style="{ backgroundColor: colors[pixel]!.value }"></span></div><figcaption>小咪的模样</figcaption></figure>
          <span class="canvas-arrow"><ArrowRight :size="20" /></span>
          <figure><div class="pixel-grid painting-grid" role="group" aria-label="8 乘 8 像素画布" aria-describedby="painting-instructions" @pointermove="movePainting"><button v-for="(pixel, index) in pixels" :key="index" type="button" :data-pixel="index" :tabindex="focusedPixel === index ? 0 : -1" :style="{ backgroundColor: colors[pixel]!.value }" :disabled="isCoolingDown || submitted" :aria-label="`第 ${Math.floor(index / 8) + 1} 行，第 ${index % 8 + 1} 列，${colors[pixel]!.label}`" @pointerdown="startPainting($event, index)" @pointerenter="painting && paint(index)" @focus="focusedPixel = index" @keydown="pixelKeys($event, index)" @click="paint(index)"></button></div><figcaption>你的画布</figcaption></figure>
        </div>
        <div class="painting-tools"><div class="palette" role="group" aria-label="选择画笔颜色"><button v-for="(color, index) in colors" :key="color.value" type="button" :style="{ '--swatch': color.value }" :class="{ chosen: selectedColor === index }" :aria-label="color.label" :aria-pressed="selectedColor === index" :disabled="isCoolingDown || submitted" @click="selectedColor = index"><Check v-if="selectedColor === index" :size="16" :style="{ color: index === 3 ? '#fff8e9' : '#625448' }" /></button></div><button class="clear-canvas" type="button" :disabled="paintedCount === 0 || isCoolingDown || submitted" @click="pixels = Array(64).fill(0)"><RotateCcw :size="14" /> 清空画布</button></div>
      </div>
    </div>

    <div class="career-footer">
      <p>{{ submitHint }}</p>
      <button class="submit-work" type="button" :disabled="!ready || isCoolingDown || submitted" @click="submit"><Clock3 v-if="isCoolingDown" :size="17" /><Coins v-else :size="17" /><span>{{ isCoolingDown ? `下一份委托 · ${cooldownText}` : waitingForRound ? '正在准备下一份委托…' : '交上作品，领取报酬' }}</span><ArrowRight v-if="!isCoolingDown" :size="16" /></button>
    </div>
    <p v-if="submitted" class="submitted-message" role="status"><Check :size="14" /> 作品已交上，小咪陪你等下一份委托。</p>
  </section>
</template>

<style scoped>
.career-games{color:#575d50;font-family:inherit;max-width:800px;margin:0 auto}
.career-games button,.career-games textarea{font:inherit}
.career-games button{cursor:pointer;transition:background .18s,border-color .18s,transform .18s;color:inherit}
.career-games button:disabled{cursor:default;opacity:.5}
.career-games button:focus-visible,.career-games textarea:focus-visible{outline:3px solid #b7c39a;outline-offset:3px}
.career-intro{display:flex;align-items:center;gap:15px;margin-bottom:25px}
.intro-icon{display:grid;place-items:center;width:54px;height:54px;background:#f1ecd8;color:#a19462;border-radius:17px;flex-shrink:0}
.career-intro h2{font-size:19px;letter-spacing:1px;margin:0 0 7px;font-weight:600;color:#465142}
.career-intro p{font-size:12px;color:#96998b;margin:0;line-height:1.7}
.job-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;padding:5px;background:#f0f0e8;border-radius:15px;margin-bottom:22px}
.job-tabs button{display:flex;align-items:center;justify-content:center;gap:8px;padding:13px 10px;background:transparent;border:1px solid transparent;border-radius:11px;font-size:13px;color:#929487}
.job-tabs button.active{background:#fcfdf8;border-color:#e1e6d5;color:#73895d;box-shadow:0 3px 9px #5b67460a}
.job-check{margin-left:2px}
.assignment{border:1px solid #e8e9dd;border-radius:19px;background:#fffef9;padding:25px}
.assignment-topline{display:flex;align-items:center;justify-content:space-between;gap:10px}
.eyebrow{font-size:9px;font-weight:700;letter-spacing:2px;color:#acb29d}
.task-tag{display:flex;align-items:center;gap:5px;font-size:10px;color:#9f956e}
.job-description{font-size:12px;color:#999c8c;margin:11px 0 26px}
.question-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:15px}
.question-heading h3,.painting-game h3{font-size:16px;margin:0;color:#535d4b;font-weight:600}
.question-heading>span{font-size:12px;letter-spacing:2px;color:#a5aa99}
.code-window{overflow:hidden;border:1px solid #e9e8da;border-radius:12px;background:#f7f7ed;margin-bottom:15px}
.code-toolbar{display:flex;align-items:center;gap:5px;padding:11px 13px;border-bottom:1px solid #eaeadd}
.code-toolbar i{width:6px;height:6px;background:#d8d9c8;border-radius:50%}
.code-toolbar i:first-child{background:#dabbb0}.code-toolbar i:nth-child(2){background:#e2d3a7}.code-toolbar i:nth-child(3){background:#b7c5a6}
.code-toolbar span{font-size:10px;margin-left:auto;color:#adaf9d;letter-spacing:.5px}
.code-window>code{display:flex;align-items:center;gap:23px;padding:25px 17px;font-size:15px;color:#778966;font-family:Consolas,monospace;overflow:auto}
.code-line{color:#bbbfae;font-size:11px}
.answer-options{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.answer-options button{display:flex;align-items:center;gap:10px;min-height:47px;padding:10px 13px;background:#fffefb;border:1px solid #e9eade;border-radius:10px;text-align:left}
.answer-options button.selected{background:#edf2e6;border-color:#a4b88c;color:#6e8756}
.answer-options button:hover:not(:disabled){border-color:#adbc98}
.answer-options button>svg{margin-left:auto}
.option-letter{display:grid;place-items:center;width:22px;height:22px;font-size:10px;background:#f1f2e9;border-radius:6px;color:#a4aa98}
.selected .option-letter{background:#dfe9d3;color:#70845d}
.answer-options code{font-size:13px;font-family:Consolas,monospace}
.question-navigation{display:flex;align-items:center;justify-content:space-between;margin-top:21px}
.question-navigation>button{display:flex;gap:5px;align-items:center;border:0;background:transparent;padding:7px 0;font-size:11px;color:#8a947e}
.question-dots{display:flex;gap:7px}
.question-dots button{width:7px;height:7px;padding:0;border:0;background:#e2e5d7;border-radius:50%}
.question-dots button.answered{background:#b7c59f}.question-dots button.current{width:19px;border-radius:6px;background:#8ca671}
.writing-prompt{display:flex;gap:11px;background:#f8f3e8;padding:18px 18px 17px;border-radius:13px}
.prompt-mark{font-family:Georgia,serif;font-size:48px;height:32px;line-height:1;color:#c7b48c}
.prompt-label{font-size:10px;color:#aea17d;letter-spacing:1px}
.writing-prompt h3{font-size:16px;color:#827657;margin:7px 0;font-weight:500}
.writing-prompt p{font-size:11px;line-height:1.9;color:#a29a83;margin:0}
.keyword-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:11px;color:#a5a695;margin:17px 0 12px}
.keyword-row>span:first-child{margin-right:4px}
.keyword{display:flex;align-items:center;gap:3px;padding:4px 9px;background:#f1f1e8;border-radius:5px;color:#a3a891}
.keyword.included{background:#eaf1df;color:#7b9562}
.writing-game textarea{width:100%;min-height:185px;resize:vertical;box-sizing:border-box;border:1px solid #e7e9dc;border-radius:12px;background:#fffefb;padding:16px;line-height:2;color:#6d745f;font-size:12px}
.writing-game textarea::placeholder{color:#b8bcab}
.writing-count{display:flex;justify-content:space-between;font-size:10px;color:#acb09e;margin-top:8px;gap:8px}.writing-count .enough{color:#8a9d71}
.painting-description{font-size:11px;color:#a0a590;line-height:1.8;margin:9px 0 20px}
.pixel-canvases{display:flex;justify-content:center;align-items:center;gap:24px;margin-top:10px}
.pixel-canvases figure{margin:0;flex:1;max-width:200px;min-width:0}
.pixel-grid{display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1;border:1px solid #e5dfce;border-radius:10px;overflow:hidden;background:#e7dfcf;gap:1px;padding:1px}
.pixel-grid span,.pixel-grid button{display:block;border:0;border-radius:0;padding:0;aspect-ratio:1;min-width:0;width:100%}
.painting-grid{touch-action:none}
.pixel-grid button{transition:none}
.pixel-grid button:hover:not(:disabled){box-shadow:inset 0 0 0 2px #90816866}
.pixel-grid button:focus-visible{position:relative;z-index:1;outline:2px solid #66774f;outline-offset:-2px}
.pixel-grid button:disabled{opacity:1}
.canvas-arrow{color:#c7ccba;flex-shrink:0}
.pixel-canvases figcaption{font-size:11px;text-align:center;color:#9ba28e;margin-top:11px;letter-spacing:1px}
.painting-tools{display:flex;justify-content:center;align-items:center;gap:25px;margin-top:22px}
.palette{display:flex;gap:10px}.palette button{display:grid;place-items:center;width:29px;height:29px;border:3px solid #fffef9;box-shadow:0 0 0 1px #e2e2d7;border-radius:50%;background:var(--swatch)}
.palette button.chosen{box-shadow:0 0 0 2px #9caf82}
.clear-canvas{display:flex;gap:5px;align-items:center;border:0;background:transparent;font-size:11px;color:#a4a88f;padding:7px 0}
.career-footer{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-top:23px}
.career-footer p{font-size:11px;line-height:1.9;color:#a5aa97;margin:0;max-width:290px}
.submit-work{display:flex;align-items:center;justify-content:center;gap:8px;padding:13px 18px;border:1px solid #83966c;border-radius:11px;background:#889d71;color:#fffef8!important;font-size:12px;white-space:nowrap}
.submit-work:hover:not(:disabled){background:#798f61;transform:translateY(-1px)}.submit-work:disabled{border-color:#c8d1bb;background:#b5c2a5;opacity:.8}
.submitted-message{display:flex;justify-content:flex-end;align-items:center;gap:5px;font-size:11px;color:#8b9c76;margin:14px 0 0}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(max-width:600px){.career-intro h2{font-size:16px;letter-spacing:.5px}.intro-icon{width:45px;height:45px;border-radius:14px}.career-intro{gap:11px}.assignment{padding:19px 16px}.eyebrow{font-size:8px;letter-spacing:1.3px}.task-tag{font-size:9px;gap:3px}.job-description{margin-bottom:22px}.career-footer{flex-direction:column;align-items:stretch;gap:13px}.career-footer p{max-width:none}.submit-work{min-height:46px}.pixel-canvases{gap:12px}.canvas-arrow svg{width:16px}.painting-tools{gap:18px}.palette{gap:8px}.painting-game h3{font-size:15px}.submitted-message{justify-content:center}.job-tabs button{gap:6px;padding:12px 5px}.job-check{display:none}.question-heading h3{font-size:14px}.code-window>code{font-size:13px;gap:15px}.writing-prompt{padding:15px 12px}}
@media(prefers-reduced-motion:reduce){.career-games button{transition:none}.submit-work:hover:not(:disabled){transform:none}}
</style>
