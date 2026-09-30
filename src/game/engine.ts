import {
  ACTIVITIES, ADOPTION_PRICE, BREEDS, CARE_ACTIONS, ENCOUNTER_SOURCES, MAX_CATS,
  PAINT_COLORS, PAINTING_REFERENCE, PERSONALITIES, PROFESSIONS, PROGRAMMING_QUESTIONS,
  RANDOM_EVENTS, SHOP_ITEMS, STORAGE_KEY, WRITING_TOPIC,
  type Activity, type Breed, type CareAction, type CatStat, type Gender, type Personality, type Profession,
} from './data.ts'

export type { Activity, Breed, CareAction, CatStat, Gender, Personality, Profession } from './data.ts'
export interface Cat {
  id: string; name: string; breed: Breed; gender: Gender; personality: Personality
  food: number; water: number; cleanliness: number; mood: number; energy: number; affection: number
  status: 'home' | 'away'; joinedAt: number; warnedAt: number | null; outfit: string | null
  lastCareAt: Partial<Record<CareAction, number>>
}
export interface DiaryEntry { id: string; time: number; text: string; kind: 'care' | 'event' | 'adoption' | 'career' | 'companion' | 'system' }
export interface EventInstance { id: string; eventId: string; catIds: string[]; createdAt: number }
export interface Encounter { id: string; sourceId: string; breed: Breed; gender: Gender; personality: Personality; createdAt: number }
export interface Companion { id: string; catId: string; activity: Activity; startedAt: number; endsAt: number; durationMinutes: number }
export interface CareerRound { id: string; profession: Profession; questionIds: string[]; createdAt: number; claimed: boolean }
export interface GameState {
  version: 1; initialized: boolean; playerName: string; coins: number; profession: Profession
  cats: Cat[]; activeCatId: string | null; inventory: Record<string, number>; diary: DiaryEntry[]
  pendingEvent: EventInstance | null; pendingEncounter: Encounter | null; companion: Companion | null
  careerRound: CareerRound | null; lastCareerRewardAt: number | null; completedJobIds: string[]
  nextEventAt: number; nextEncounterAt: number; lastUpdatedAt: number; sequence: number
  neglectDay: string; neglectLossToday: Record<string, number>; remindersEnabled: boolean; reminderMinutes: number
}
export interface ActionResult { ok: boolean; message: string; reward?: number; score?: number; cat?: Cat }
export interface NewGameOptions { playerName?: string; catName?: string; breed?: Breed; gender?: Gender; profession?: Profession }
type Random = () => number
const HOUR = 3_600_000
const MINUTE = 60_000
const MAX_INVENTORY = 9999
const MAX_COINS = 1_000_000
const stats: CatStat[] = ['food', 'water', 'cleanliness', 'mood', 'energy', 'affection']
const personalityIds = Object.keys(PERSONALITIES) as Personality[]
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const sample = <T>(items: readonly T[], random: Random): T => items[Math.min(items.length - 1, Math.floor(clamp(random(), 0, 0.999999) * items.length))]!
const dayKey = (now: number) => {
  const date = new Date(now)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const nextId = (state: GameState, prefix: string) => `${prefix}-${++state.sequence}`
const ok = (message: string, extra: Partial<ActionResult> = {}): ActionResult => ({ ok: true, message, ...extra })
const fail = (message: string): ActionResult => ({ ok: false, message })

function log(state: GameState, text: string, kind: DiaryEntry['kind'], now: number) {
  state.diary.unshift({ id: nextId(state, 'diary'), time: now, text, kind })
  state.diary = state.diary.slice(0, 60)
}
function effects(cat: Cat, values: Partial<Record<CatStat, number>>) {
  for (const key of stats) if (values[key] !== undefined) cat[key] = clamp(cat[key] + values[key]!)
  if (cat.affection >= 20) cat.warnedAt = null
}
export function getActiveCat(state: GameState): Cat | undefined { return state.cats.find(cat => cat.id === state.activeCatId) ?? state.cats[0] }
export function affectionLabel(value: number): string { return value >= 85 ? '最特别的家人' : value >= 65 ? '越来越依赖你' : value >= 40 ? '慢慢熟悉彼此' : value >= 20 ? '需要一点陪伴' : '有些想念你' }
export function getCatMessage(cat: Cat, kind: 'pet' | 'idle' | 'companion' = 'idle', random: Random = Math.random): string {
  if (cat.status === 'away') return '小咪出去散散心了，带上熟悉的毯子去接它吧。'
  const messages = PERSONALITIES[cat.personality][kind]
  return typeof messages === 'string' ? messages : sample(messages, random)
}

export function createInitialState(now = Date.now(), random: Random = Math.random): GameState {
  return {
    version: 1, initialized: false, playerName: '小咪的朋友', coins: 180 + Math.floor(clamp(random(), 0, 0.99999) * 61), profession: 'programmer',
    cats: [], activeCatId: null, inventory: { food: 5, treat: 2, ribbon: 0, scarf: 0 }, diary: [],
    pendingEvent: null, pendingEncounter: null, companion: null, careerRound: null, lastCareerRewardAt: null, completedJobIds: [],
    nextEventAt: now + 90_000, nextEncounterAt: now + 150_000, lastUpdatedAt: now, sequence: 0,
    neglectDay: dayKey(now), neglectLossToday: {}, remindersEnabled: true, reminderMinutes: 30,
  }
}
export function createGame(options: NewGameOptions = {}, now = Date.now(), random: Random = Math.random): GameState {
  const state = createInitialState(now, random)
  state.playerName = options.playerName?.trim().slice(0, 20) || '小咪的朋友'
  state.profession = options.profession ?? 'programmer'
  adoptCat(state, { name: options.catName || '小橘', breed: options.breed ?? 'orange', gender: options.gender ?? 'female', source: 'initial' }, now, random)
  return state
}
export interface AdoptOptions { name?: string; breed: Breed; gender: Gender; source?: 'initial' | 'shop' }
function addCat(state: GameState, options: { name?: string; breed: Breed; gender: Gender; personality: Personality }, now: number): Cat {
  const cat: Cat = { id: nextId(state, 'cat'), name: options.name?.trim().slice(0, 12) || (state.cats.length ? `小咪${state.cats.length + 1}` : '小橘'),
    breed: options.breed, gender: options.gender, personality: options.personality, food: 75, water: 80, cleanliness: 75, mood: 70, energy: 80,
    affection: 55, status: 'home', joinedAt: now, warnedAt: null, outfit: null, lastCareAt: {} }
  state.cats.push(cat)
  state.activeCatId = cat.id
  state.initialized = true
  log(state, `${cat.name}来到家里。属于你们的小小日常，从今天开始。`, 'adoption', now)
  return cat
}
export function adoptCat(state: GameState, options: AdoptOptions, now = Date.now(), random: Random = Math.random): ActionResult {
  if (!BREEDS.some(breed => breed.id === options.breed) || !['female', 'male'].includes(options.gender)) return fail('请选择小猫的品种和性别。')
  if (state.cats.length >= MAX_CATS) return fail(`家里最多可以照顾 ${MAX_CATS} 只小咪。`)
  const first = !state.initialized && state.cats.length === 0
  if (!first && options.source === 'initial') return fail('你已经接到了第一只小咪。')
  if (!first && state.coins < ADOPTION_PRICE) return fail(`接新小咪回家需要 ${ADOPTION_PRICE} 枚金币。`)
  if (!first) state.coins -= ADOPTION_PRICE
  const cat = addCat(state, { ...options, personality: sample(personalityIds, random) }, now)
  return ok(`${cat.name}到家啦！`, { cat })
}

export function careForCat(state: GameState, catId: string, action: CareAction, now = Date.now(), random: Random = Math.random): ActionResult {
  if (!timestamp(now)) return fail('时间暂时不太准确，稍后再试试吧。')
  const cat = state.cats.find(item => item.id === catId)
  const care = CARE_ACTIONS.find(item => item.id === action)
  if (!cat || !care) return fail('没有找到这只小咪或照料方式。')
  if (cat.status === 'away') return fail('先把小咪接回家，再照顾它吧。')
  const last = cat.lastCareAt[action]
  if (last !== undefined && last > now) cat.lastCareAt[action] = now
  if (last !== undefined && now - last < 30_000) return fail('刚刚已经照顾过啦，让小咪享受一会儿吧。')
  if ((action === 'feed' || action === 'snack') && cat.food >= 98) return fail('小肚子已经饱饱的，留着下一顿吧。')
  if (action === 'water' && cat.water >= 98) return fail('水碗还是满满的。')
  if ((action === 'play' || action === 'bath') && cat.energy < 10) return fail('小咪有些困了，先一起休息一下吧。')
  if (care.cost && (state.inventory[care.cost] ?? 0) < 1) return fail('家里的存货用完啦，可以去小铺补充一点。')
  if (care.cost) state.inventory[care.cost]!--
  const values = { ...care.effects }
  if (PERSONALITIES[cat.personality].preferred.includes(action)) values.affection = (values.affection ?? 0) + 1
  if (action === 'bath' && cat.cleanliness >= 80) values.affection = 0
  effects(cat, values)
  cat.lastCareAt[action] = now
  const message = action === 'pet' ? getCatMessage(cat, 'pet', random) : `${care.name}完成，${cat.name}${action === 'feed' ? '满足地舔了舔嘴巴。' : action === 'water' ? '低头喝了几口水。' : '看起来又开心了一点。'}`
  log(state, message, 'care', now)
  return ok(message)
}
export const petCat = (state: GameState, catId: string, now = Date.now(), random: Random = Math.random) => careForCat(state, catId, 'pet', now, random)

export function advanceTime(state: GameState, now = Date.now(), options: { offline?: boolean } = {}): void {
  if (!timestamp(now) || now <= state.lastUpdatedAt) return
  const elapsed = Math.min(now - state.lastUpdatedAt, 8 * HOUR)
  const offlineLoss: Record<string, number> = {}
  let cursor = now - elapsed
  // Split at local midnight so frequent ticks and one long update have the same result.
  while (cursor < now) {
    const tomorrow = new Date(cursor)
    tomorrow.setHours(24, 0, 0, 0)
    const end = Math.min(now, tomorrow.getTime())
    const hours = (end - cursor) / HOUR
    if (state.neglectDay !== dayKey(cursor)) { state.neglectDay = dayKey(cursor); state.neglectLossToday = {} }
    for (const cat of state.cats) {
      if (cat.status === 'away') continue
      const healthyHours = Math.max(0, Math.min((cat.food - 15) / 3, (cat.water - 15) / 4))
      const neglectedHours = Math.max(0, hours - healthyHours)
      effects(cat, { food: -3 * hours, water: -4 * hours, cleanliness: -hours, mood: -hours, energy: 4 * hours })
      const prior = state.neglectLossToday[cat.id] ?? 0
      const offlineRemaining = options.offline ? 6 - (offlineLoss[cat.id] ?? 0) : Infinity
      const loss = Math.max(0, Math.min(6 - prior, neglectedHours * 12, offlineRemaining))
      if (loss > 0) {
        effects(cat, { affection: -loss })
        state.neglectLossToday[cat.id] = prior + loss
        offlineLoss[cat.id] = (offlineLoss[cat.id] ?? 0) + loss
      }
    }
    cursor = end
  }
  if (state.neglectDay !== dayKey(now)) { state.neglectDay = dayKey(now); state.neglectLossToday = {} }
  for (const cat of state.cats) {
    if (cat.status === 'away') continue
    if (cat.affection < 20 && cat.warnedAt === null) {
      cat.warnedAt = now
      log(state, `${cat.name}最近总爱安静地趴在门边。它需要一点陪伴。`, 'system', now)
    }
    // Returning players always get an online grace period, including older warnings.
    if (options.offline && cat.warnedAt !== null) cat.warnedAt = now
    if (!options.offline && cat.affection < 10 && cat.warnedAt !== null && now - cat.warnedAt >= 5 * MINUTE) {
      cat.status = 'away'
      if (state.companion?.catId === cat.id) state.companion = null
      log(state, `${cat.name}出去散散心了。带着熟悉的毯子去接它回家吧。`, 'system', now)
    }
  }
  state.lastUpdatedAt = now
}
export function retrieveCat(state: GameState, catId: string, now = Date.now()): ActionResult {
  const cat = state.cats.find(item => item.id === catId)
  if (!cat || cat.status !== 'away') return fail('小咪就在家里，去摸摸它吧。')
  cat.status = 'home'; cat.affection = 25; cat.warnedAt = null; cat.food = Math.max(cat.food, 35); cat.water = Math.max(cat.water, 40)
  log(state, `你带着熟悉的毯子找到了${cat.name}。它闻了闻，终于跟着你回了家。`, 'event', now)
  return ok(`${cat.name}回家了，慢慢重新熟悉彼此吧。`)
}

export function buyItem(state: GameState, itemId: string, quantity = 1, now = Date.now()): ActionResult {
  const item = SHOP_ITEMS.find(entry => entry.id === itemId)
  if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return fail('请选择有效的商品数量。')
  if (item.category === 'outfit' && (quantity !== 1 || state.inventory[item.id]! > 0)) return fail('这件装扮已经在衣橱里啦。')
  const cost = item.price * quantity
  if (state.coins < cost) return fail('金币还差一点，完成一份小工作就能攒起来。')
  if ((state.inventory[item.id] ?? 0) + item.quantity * quantity > MAX_INVENTORY) return fail('背包里的存货已经够多啦，先用掉一些再补充吧。')
  state.coins -= cost
  state.inventory[item.id] = (state.inventory[item.id] ?? 0) + item.quantity * quantity
  log(state, `买到了${item.name} ×${item.quantity * quantity}。`, 'system', now)
  return ok(`${item.name}已经放进背包。`)
}
export function equipOutfit(state: GameState, catId: string, itemId: string | null): ActionResult {
  const cat = state.cats.find(item => item.id === catId)
  if (!cat) return fail('没有找到这只小咪。')
  if (itemId !== null && (!SHOP_ITEMS.some(item => item.id === itemId && item.category === 'outfit') || !(state.inventory[itemId]! > 0))) return fail('先把这件装扮带回家吧。')
  cat.outfit = itemId
  return ok(itemId ? '今天的小咪也很可爱。' : '换回毛茸茸的日常模样。')
}

function eventTargetsValid(state: GameState, event: EventInstance): boolean {
  const definition = RANDOM_EVENTS.find(item => item.id === event.eventId)
  return !!definition && event.catIds.length === definition.minCats && new Set(event.catIds).size === event.catIds.length && event.catIds.every(id => {
    const cat = state.cats.find(item => item.id === id)
    return cat?.status === 'home' && (!definition.personality || cat.personality === definition.personality)
  })
}
export function rollEvent(state: GameState, now = Date.now(), random: Random = Math.random, force = false): EventInstance | null {
  if (state.pendingEvent && eventTargetsValid(state, state.pendingEvent)) return state.pendingEvent
  if (state.pendingEvent) { state.pendingEvent = null; state.nextEventAt = now + 3 * MINUTE }
  if (!force && now < state.nextEventAt) return null
  const cats = state.cats.filter(cat => cat.status === 'home')
  const available = RANDOM_EVENTS.filter(event => cats.length >= event.minCats && (!event.personality || cats.some(cat => cat.personality === event.personality)))
  if (!available.length) return null
  const event = sample(available, random)
  const pool = cats.filter(cat => !event.personality || cat.personality === event.personality)
  const targets: Cat[] = []
  while (targets.length < event.minCats) { const target = sample(pool, random); targets.push(target); pool.splice(pool.indexOf(target), 1) }
  state.pendingEvent = { id: nextId(state, 'event'), eventId: event.id, catIds: targets.map(cat => cat.id), createdAt: now }
  return state.pendingEvent
}
export function resolveEvent(state: GameState, eventInstanceId: string, choiceIndex: number, now = Date.now(), random: Random = Math.random): ActionResult {
  const pending = state.pendingEvent
  if (!pending || pending.id !== eventInstanceId) return fail('这段小插曲已经结束啦。')
  if (!eventTargetsValid(state, pending)) {
    state.pendingEvent = null; state.nextEventAt = now + 3 * MINUTE
    return fail('小咪已经去做别的事情了，下一次再一起回应它吧。')
  }
  const event = RANDOM_EVENTS.find(item => item.id === pending.eventId)
  const choice = Number.isInteger(choiceIndex) ? event?.choices[choiceIndex] : undefined
  if (!choice) return fail('请选择一个回应。')
  for (const id of pending.catIds) { const cat = state.cats.find(item => item.id === id); if (cat?.status === 'home') effects(cat, choice.effects) }
  state.pendingEvent = null
  state.nextEventAt = now + (3 + clamp(random(), 0, 1) * 3) * MINUTE
  log(state, `${event!.title}：${choice.response}`, 'event', now)
  return ok(choice.response)
}

export function maybeEncounter(state: GameState, now = Date.now(), random: Random = Math.random, force = false): Encounter | null {
  if (state.pendingEncounter) return state.pendingEncounter
  if (state.cats.length >= MAX_CATS || !state.initialized || (!force && now < state.nextEncounterAt)) return null
  const source = sample(ENCOUNTER_SOURCES, random)
  let ticket = clamp(random(), 0, 0.99999) * source.weights.reduce((sum, value) => sum + value, 0)
  let personality: Personality = 'shy'
  for (let index = 0; index < source.weights.length; index++) { ticket -= source.weights[index]!; if (ticket < 0) { personality = personalityIds[index]!; break } }
  state.pendingEncounter = { id: nextId(state, 'encounter'), sourceId: source.id, breed: sample(BREEDS, random).id, gender: random() < 0.5 ? 'female' : 'male', personality, createdAt: now }
  return state.pendingEncounter
}
export function acceptEncounter(state: GameState, name = '', now = Date.now()): ActionResult {
  if (!state.pendingEncounter) return fail('新的缘分还在路上。')
  if (state.cats.length >= MAX_CATS) return fail(`家里最多可以照顾 ${MAX_CATS} 只小咪。`)
  const cost = ENCOUNTER_SOURCES.find(source => source.id === state.pendingEncounter!.sourceId)?.price ?? 0
  if (state.coins < cost) return fail(`这次相遇需要 ${cost} 枚金币。可以先完成一份小工作，再回来接它。`)
  state.coins -= cost
  const cat = addCat(state, { ...state.pendingEncounter, name }, now)
  state.pendingEncounter = null; state.nextEncounterAt = now + 24 * HOUR
  return ok(`${cat.name}也成为这个家的一员啦。`, { cat })
}
export function dismissEncounter(state: GameState, now = Date.now()): ActionResult {
  if (!state.pendingEncounter) return fail('暂时没有等待回应的相遇。')
  state.pendingEncounter = null; state.nextEncounterAt = now + 24 * HOUR
  log(state, '你把这份小小的缘分交给了更合适的家。好好照顾眼前的小咪，也很温柔。', 'event', now)
  return ok('它会继续寻找适合自己的家，不用感到抱歉。')
}

export function startCompanion(state: GameState, activity: Activity, durationMinutes = 5, now = Date.now(), catId = state.activeCatId): ActionResult {
  const cat = state.cats.find(item => item.id === catId)
  if (!cat || cat.status !== 'home') return fail('先接一只小咪回家吧。')
  if (state.companion) return fail('你和小咪已经在一起度过一段时间啦。')
  if (!ACTIVITIES.some(item => item.id === activity) || !Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 120) return fail('请选择 1 到 120 分钟的陪伴时间。')
  state.companion = { id: nextId(state, 'companion'), catId: cat.id, activity, startedAt: now, endsAt: now + durationMinutes * MINUTE, durationMinutes }
  return ok(getCatMessage(cat, 'companion'))
}
export function finishCompanion(state: GameState, now = Date.now()): ActionResult {
  const session = state.companion
  if (!session) return fail('这次陪伴已经记录好了。')
  if (now < session.endsAt) return fail('这段陪伴还在继续，慢慢来。')
  const cat = state.cats.find(item => item.id === session.catId)
  state.companion = null
  if (!cat || cat.status !== 'home') return fail('小咪暂时不在家。')
  effects(cat, { affection: 4, mood: 8, ...(session.activity === 'sleep' ? { energy: 15 } : {}) })
  log(state, `你和${cat.name}一起${ACTIVITIES.find(item => item.id === session.activity)!.name}了 ${session.durationMinutes} 分钟。平凡的一刻，也被好好收藏。`, 'companion', now)
  return ok('陪伴完成。和你在一起，就是小咪喜欢的日常。')
}
export function stopCompanion(state: GameState): ActionResult { state.companion = null; return ok('先去忙吧，小咪会等你。下次再继续。') }

export interface ScoreResult { score: number; valid: boolean; feedback: string }
export function scoreProgramming(answers: Record<string, string>, questionIds: readonly string[] = PROGRAMMING_QUESTIONS.slice(0, 3).map(item => item.id)): ScoreResult {
  const questions = questionIds.map(id => PROGRAMMING_QUESTIONS.find(item => item.id === id)).filter(item => item !== undefined)
  if (!questions.length || questions.some(question => !answers[question.id])) return { score: 0, valid: false, feedback: '还有题目没有选择答案，慢慢想一想。' }
  const correct = questions.filter(question => answers[question.id] === question.answer).length
  return { score: Math.round(correct / questions.length * 100), valid: true, feedback: `答对 ${correct} / ${questions.length} 题，每一次尝试都会有收获。` }
}
export function scoreWriting(text: string): ScoreResult {
  const count = text.replace(/[\s\p{P}\p{S}]/gu, '').length
  if (count < 30) return { score: 0, valid: false, feedback: `已经写了 ${count} 字，再写到 30 字就可以交稿啦。` }
  const matches = WRITING_TOPIC.groups.filter(group => group.some(word => text.includes(word))).length
  const score = 30 + matches * 20 + (count >= 80 ? 10 : 0)
  return { score, valid: true, feedback: `正文 ${count} 字 · 命中 ${matches} / 3 组主题词。这里按篇幅和关键词评分，记录你的创作练习。` }
}
export function scorePainting(pixels: readonly number[]): ScoreResult {
  if (pixels.length !== 64 || pixels.some(color => !Number.isInteger(color) || color < 0 || color >= PAINT_COLORS.length)) return { score: 0, valid: false, feedback: '画布需要是完整的 8 × 8 像素。' }
  if (pixels.every(color => color === 0)) return { score: 0, valid: false, feedback: '先在画布上画几笔，再把作品交给小咪看看。' }
  let union = 0; let correct = 0
  pixels.forEach((color, index) => { if (color !== 0 || PAINTING_REFERENCE[index] !== 0) { union++; if (color === PAINTING_REFERENCE[index]) correct++ } })
  const score = union ? Math.round(correct / union * 100) : 0
  return { score, valid: true, feedback: `颜色与位置的一致度 ${score}%，小咪已经认真欣赏过你的画啦。` }
}
export function startCareerRound(state: GameState, profession: Profession = state.profession, now = Date.now(), random: Random = Math.random): ActionResult {
  if (!PROFESSIONS.some(item => item.id === profession)) return fail('请选择一份小工作。')
  if (state.lastCareerRewardAt !== null && now - state.lastCareerRewardAt < MINUTE) return fail('刚刚已经完成了一份工作，休息一分钟再开始吧。')
  if (state.careerRound && !state.careerRound.claimed && state.careerRound.profession === profession) return ok('这份工作还在等你完成。')
  const remaining = [...PROGRAMMING_QUESTIONS]
  const questionIds: string[] = []
  while (questionIds.length < 3) { const question = sample(remaining, random); questionIds.push(question.id); remaining.splice(remaining.indexOf(question), 1) }
  state.profession = profession
  state.careerRound = { id: nextId(state, 'job'), profession, questionIds, createdAt: now, claimed: false }
  return ok('一份小小的工作，换一点给小咪的心意。')
}
export interface CareerSubmission { answers?: Record<string, string>; text?: string; pixels?: number[] }
export function submitCareerRound(state: GameState, roundId: string, submission: CareerSubmission, now = Date.now()): ActionResult {
  const round = state.careerRound
  if (!round || round.id !== roundId || round.claimed || state.completedJobIds.includes(roundId)) return fail('这份工作的奖励已经结算过啦。')
  if (state.lastCareerRewardAt !== null && now - state.lastCareerRewardAt < MINUTE) return fail('休息一分钟，再来完成下一份工作吧。')
  const result = round.profession === 'programmer' ? scoreProgramming(submission.answers ?? {}, round.questionIds) : round.profession === 'writer' ? scoreWriting(submission.text ?? '') : scorePainting(submission.pixels ?? [])
  if (!result.valid) return fail(result.feedback)
  const reward = Math.min(MAX_COINS - state.coins, 10 + Math.floor(result.score * 0.3))
  state.coins += reward; round.claimed = true; state.lastCareerRewardAt = now
  state.completedJobIds = [...state.completedJobIds, round.id].slice(-50)
  log(state, `完成了一份${PROFESSIONS.find(item => item.id === round.profession)!.name}小工作，获得 ${reward} 枚金币。`, 'career', now)
  return ok(`${result.feedback} 获得 ${reward} 枚金币。`, { score: result.score, reward })
}

export function serializeGame(state: GameState): string { return JSON.stringify(state) }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const timestamp = (value: unknown): value is number => finite(value) && value >= 0 && value <= 8.64e15
const cleanString = (value: unknown, fallback: string, limit = 100) => typeof value === 'string' ? value.slice(0, limit) : fallback
const validId = (value: unknown, prefix?: string): value is string => {
  if (typeof value !== 'string' || value.length > 80 || !/^(cat|diary|event|encounter|companion|job)-[1-9]\d*$/.test(value)) return false
  const number = Number(value.slice(value.lastIndexOf('-') + 1))
  return Number.isSafeInteger(number) && number < Number.MAX_SAFE_INTEGER - 1000 && (!prefix || value.startsWith(`${prefix}-`))
}

// Validate all persisted fields before rehydrating. No browser globals are needed by the engine.
export function deserializeGame(raw: string | null, now = Date.now()): GameState | null {
  if (!raw || raw.length > 300_000) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!record(parsed) || parsed.version !== 1 || !Array.isArray(parsed.cats) || parsed.cats.length > MAX_CATS) return null
    const state = createInitialState(now, () => 0.5)
    state.sequence = finite(parsed.sequence) ? Math.floor(clamp(parsed.sequence, 0, Number.MAX_SAFE_INTEGER - 1000)) : 0
    const persistedIds: unknown[] = parsed.cats.filter(record).map(cat => cat.id)
    if (Array.isArray(parsed.diary)) persistedIds.push(...parsed.diary.filter(record).map(item => item.id))
    if (Array.isArray(parsed.completedJobIds)) persistedIds.push(...parsed.completedJobIds)
    for (const key of ['pendingEvent', 'pendingEncounter', 'companion', 'careerRound']) if (record(parsed[key])) persistedIds.push(parsed[key].id)
    // Reserve every existing id before generating any fallback diary ids.
    for (const id of persistedIds) if (validId(id)) state.sequence = Math.max(state.sequence, Number(id.slice(id.lastIndexOf('-') + 1)))
    const ids = new Set<string>()
    for (const value of parsed.cats) {
      if (!record(value) || !validId(value.id, 'cat') || ids.has(value.id) || !BREEDS.some(breed => breed.id === value.breed) || !personalityIds.includes(value.personality as Personality) || !['female', 'male'].includes(value.gender as string) || stats.some(key => !finite(value[key]))) return null
      ids.add(value.id)
      const lastCareAt: Cat['lastCareAt'] = {}
      if (record(value.lastCareAt)) for (const care of CARE_ACTIONS) if (timestamp(value.lastCareAt[care.id])) lastCareAt[care.id] = Math.min(value.lastCareAt[care.id] as number, now)
      const cat: Cat = { id: value.id, name: cleanString(value.name, '小咪', 12), breed: value.breed as Breed, gender: value.gender as Gender, personality: value.personality as Personality,
        food: clamp(value.food as number), water: clamp(value.water as number), cleanliness: clamp(value.cleanliness as number), mood: clamp(value.mood as number), energy: clamp(value.energy as number), affection: clamp(value.affection as number),
        status: value.status === 'away' ? 'away' : 'home', joinedAt: timestamp(value.joinedAt) ? Math.min(value.joinedAt, now) : now,
        warnedAt: timestamp(value.warnedAt) ? Math.min(value.warnedAt, now) : null, outfit: SHOP_ITEMS.some(item => item.id === value.outfit && item.category === 'outfit') ? value.outfit as string : null, lastCareAt }
      state.cats.push(cat)
    }
    state.initialized = state.cats.length > 0
    state.activeCatId = state.cats.some(cat => cat.id === parsed.activeCatId) ? parsed.activeCatId as string : state.cats[0]?.id ?? null
    state.playerName = cleanString(parsed.playerName, '小咪的朋友', 20)
    state.profession = PROFESSIONS.some(item => item.id === parsed.profession) ? parsed.profession as Profession : 'programmer'
    state.coins = finite(parsed.coins) ? Math.floor(clamp(parsed.coins, 0, MAX_COINS)) : 180
    if (record(parsed.inventory)) for (const item of SHOP_ITEMS) if (finite(parsed.inventory[item.id])) state.inventory[item.id] = Math.floor(clamp(parsed.inventory[item.id] as number, 0, item.category === 'outfit' ? 1 : MAX_INVENTORY))
    for (const cat of state.cats) if (cat.outfit && !state.inventory[cat.outfit]) cat.outfit = null
    state.lastUpdatedAt = timestamp(parsed.lastUpdatedAt) ? Math.min(parsed.lastUpdatedAt, now) : now
    state.nextEventAt = timestamp(parsed.nextEventAt) ? Math.min(parsed.nextEventAt, now + 6 * MINUTE) : now + 90_000
    state.nextEncounterAt = timestamp(parsed.nextEncounterAt) ? Math.min(parsed.nextEncounterAt, now + 24 * HOUR) : now + 150_000
    state.lastCareerRewardAt = timestamp(parsed.lastCareerRewardAt) ? Math.min(parsed.lastCareerRewardAt, now) : null
    state.completedJobIds = Array.isArray(parsed.completedJobIds) ? [...new Set(parsed.completedJobIds.filter((item): item is string => validId(item, 'job')))].slice(-50) : []
    state.remindersEnabled = parsed.remindersEnabled !== false
    state.reminderMinutes = [15, 30, 60].includes(parsed.reminderMinutes as number) ? parsed.reminderMinutes as number : 30
    const diaryIds = new Set<string>()
    if (Array.isArray(parsed.diary)) state.diary = parsed.diary.filter(record).filter(item => typeof item.text === 'string' && timestamp(item.time)).slice(0, 60).map(item => {
      const id = validId(item.id, 'diary') && !diaryIds.has(item.id) ? item.id : nextId(state, 'diary')
      diaryIds.add(id)
      return { id, time: item.time as number, text: cleanString(item.text, '', 500), kind: ['care', 'event', 'adoption', 'career', 'companion', 'system'].includes(item.kind as string) ? item.kind as DiaryEntry['kind'] : 'system' }
    })
    state.neglectDay = dayKey(state.lastUpdatedAt)
    if (parsed.neglectDay === state.neglectDay && record(parsed.neglectLossToday)) for (const cat of state.cats) if (finite(parsed.neglectLossToday[cat.id])) state.neglectLossToday[cat.id] = clamp(parsed.neglectLossToday[cat.id] as number, 0, 6)
    const event = parsed.pendingEvent
    if (record(event) && validId(event.id, 'event') && typeof event.eventId === 'string' && RANDOM_EVENTS.some(item => item.id === event.eventId) && Array.isArray(event.catIds) && event.catIds.length && event.catIds.every(id => typeof id === 'string' && ids.has(id)) && timestamp(event.createdAt)) {
      const candidate: EventInstance = { id: event.id, eventId: event.eventId, catIds: event.catIds as string[], createdAt: event.createdAt }
      if (eventTargetsValid(state, candidate)) state.pendingEvent = candidate
    }
    const encounter = parsed.pendingEncounter
    if (record(encounter) && validId(encounter.id, 'encounter') && ENCOUNTER_SOURCES.some(item => item.id === encounter.sourceId) && BREEDS.some(item => item.id === encounter.breed) && personalityIds.includes(encounter.personality as Personality) && ['female', 'male'].includes(encounter.gender as string) && timestamp(encounter.createdAt) && state.cats.length < MAX_CATS) state.pendingEncounter = { id: encounter.id, sourceId: encounter.sourceId as string, breed: encounter.breed as Breed, gender: encounter.gender as Gender, personality: encounter.personality as Personality, createdAt: encounter.createdAt }
    const companion = parsed.companion
    if (record(companion) && validId(companion.id, 'companion') && typeof companion.catId === 'string' && state.cats.some(cat => cat.id === companion.catId && cat.status === 'home') && ACTIVITIES.some(item => item.id === companion.activity) && timestamp(companion.startedAt) && timestamp(companion.endsAt) && finite(companion.durationMinutes) && companion.durationMinutes >= 1 && companion.durationMinutes <= 120 && companion.endsAt === companion.startedAt + companion.durationMinutes * MINUTE) {
      const rollback = Math.max(0, companion.startedAt - now)
      state.companion = { id: companion.id, catId: companion.catId, activity: companion.activity as Activity, startedAt: companion.startedAt - rollback, endsAt: companion.endsAt - rollback, durationMinutes: companion.durationMinutes }
    }
    const round = parsed.careerRound
    if (record(round) && validId(round.id, 'job') && PROFESSIONS.some(item => item.id === round.profession) && Array.isArray(round.questionIds) && round.questionIds.length === 3 && new Set(round.questionIds).size === 3 && round.questionIds.every(id => PROGRAMMING_QUESTIONS.some(item => item.id === id)) && timestamp(round.createdAt)) state.careerRound = { id: round.id, profession: round.profession as Profession, questionIds: round.questionIds as string[], createdAt: round.createdAt, claimed: round.claimed === true || state.completedJobIds.includes(round.id) }
    return state
  } catch { return null }
}
export function saveGame(state: GameState, storage: Pick<Storage, 'setItem'>): boolean {
  try { storage.setItem(STORAGE_KEY, serializeGame(state)); return true } catch { return false }
}
export function loadGame(storage: Pick<Storage, 'getItem'>, now = Date.now()): GameState | null {
  try { const state = deserializeGame(storage.getItem(STORAGE_KEY), now); if (state) advanceTime(state, now, { offline: true }); return state } catch { return null }
}
