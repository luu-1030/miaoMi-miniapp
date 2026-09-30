import test from 'node:test'
import assert from 'node:assert/strict'
import {
  acceptEncounter, adoptCat, advanceTime, buyItem, careForCat, createGame, createInitialState,
  deserializeGame, dismissEncounter, equipOutfit, finishCompanion, loadGame, maybeEncounter,
  resolveEvent, retrieveCat, rollEvent, saveGame, scorePainting, scoreProgramming, scoreWriting,
  serializeGame, startCareerRound, startCompanion, stopCompanion, submitCareerRound,
} from '../src/game/engine.ts'
import { PAINTING_REFERENCE, PROGRAMMING_QUESTIONS, RANDOM_EVENTS } from '../src/game/data.ts'

const NOW = Date.UTC(2026, 8, 18, 10)
const HOUR = 3_600_000
const rng = () => 0.25
const game = () => createGame({ catName: '团子', breed: 'orange', gender: 'female' }, NOW, rng)

test('街角相遇在确认后扣金币，余额不足及重复确认不会扣款', () => {
  const state = game()
  maybeEncounter(state, NOW, () => 0.999, true)
  assert.equal(state.pendingEncounter?.sourceId, 'seller')
  state.coins = 19
  assert.equal(acceptEncounter(state, '小白', NOW).ok, false)
  assert.equal(state.cats.length, 1)
  assert.equal(state.coins, 19)
  assert.ok(state.pendingEncounter)
  state.coins = 25
  assert.equal(acceptEncounter(state, '小白', NOW).ok, true)
  assert.equal(state.coins, 5)
  assert.equal(state.cats.length, 2)
  assert.equal(acceptEncounter(state, '小白', NOW).ok, false)
  assert.equal(state.coins, 5)
})

test('初始化保留玩家选择、隐藏性格、随机资金与免费首猫', () => {
  const state = createInitialState(NOW, () => 0)
  assert.equal(state.coins, 180)
  assert.equal(createInitialState(NOW, () => 0.999).coins, 240)
  assert.equal(state.initialized, false)
  const adopted = adoptCat(state, { name: '糯米', breed: 'calico', gender: 'female', source: 'initial' }, NOW, () => 0.99)
  assert.equal(adopted.ok, true)
  assert.equal(state.coins, 180)
  assert.equal(state.cats[0]!.name, '糯米')
  assert.equal(state.cats[0]!.personality, 'shy')
  assert.equal(adoptCat(state, { breed: 'orange', gender: 'male', source: 'initial' }, NOW).ok, false)
  assert.equal(state.cats.length, 1)
})

test('照料会消耗库存、有冷却且不会浪费满腹猫咪的食物', () => {
  const state = game(); const cat = state.cats[0]!
  assert.equal(careForCat(state, cat.id, 'feed', NOW).ok, true)
  assert.equal(cat.food, 100)
  assert.equal(state.inventory.food, 4)
  const affection = cat.affection
  assert.equal(careForCat(state, cat.id, 'feed', NOW + 1000).ok, false)
  assert.equal(cat.affection, affection)
  assert.equal(careForCat(state, cat.id, 'feed', NOW + 31_000).ok, false)
  assert.equal(state.inventory.food, 4)
  state.inventory.treat = 0; cat.food = 30
  assert.equal(careForCat(state, cat.id, 'snack', NOW + 32_000).ok, false)
  assert.equal(cat.food, 30)
})

test('忽略时钟回退，离线衰减最多八小时、好感每日最多下降六点', () => {
  const state = game(); const cat = state.cats[0]!
  advanceTime(state, NOW - HOUR)
  assert.equal(cat.food, 75)
  advanceTime(state, NOW + 72 * HOUR, { offline: true })
  assert.equal(cat.food, 51)
  assert.equal(cat.water, 48)
  assert.equal(cat.affection, 55)
  cat.food = 0; cat.water = 0
  advanceTime(state, NOW + 73 * HOUR, { offline: true })
  assert.equal(cat.affection, 49)
  advanceTime(state, NOW + 74 * HOUR, { offline: true })
  assert.equal(cat.affection, 49)
})

test('离线永不直接离家；预警后在线触发、可免费找回且保留装扮', () => {
  const state = game(); const cat = state.cats[0]!
  cat.affection = 8; cat.outfit = 'ribbon'
  advanceTime(state, NOW + HOUR, { offline: true })
  assert.equal(cat.status, 'home')
  assert.notEqual(cat.warnedAt, null)
  advanceTime(state, NOW + HOUR + 4 * 60_000)
  assert.equal(cat.status, 'home')
  advanceTime(state, NOW + HOUR + 5 * 60_000)
  assert.equal(cat.status, 'away')
  const coins = state.coins
  assert.equal(careForCat(state, cat.id, 'pet', NOW + HOUR).ok, false)
  assert.equal(retrieveCat(state, cat.id, NOW + 2 * HOUR).ok, true)
  assert.equal(cat.status, 'home')
  assert.equal(cat.affection, 25)
  assert.equal(cat.outfit, 'ribbon')
  assert.equal(state.coins, coins)
})

test('商城正确扣款和入库，拒绝负数购买、重复装扮与余额不足', () => {
  const state = game(); const coins = state.coins
  assert.equal(buyItem(state, 'food', 2, NOW).ok, true)
  assert.equal(state.coins, coins - 24)
  assert.equal(state.inventory.food, 11)
  assert.equal(buyItem(state, 'food', -1, NOW).ok, false)
  assert.equal(buyItem(state, 'food', Number.NaN, NOW).ok, false)
  assert.equal(buyItem(state, 'ribbon', 1, NOW).ok, true)
  assert.equal(buyItem(state, 'ribbon', 1, NOW).ok, false)
  assert.equal(equipOutfit(state, state.cats[0]!.id, 'ribbon').ok, true)
  assert.equal(equipOutfit(state, state.cats[0]!.id, 'scarf').ok, false)
  state.coins = 0
  assert.equal(buyItem(state, 'food', 1, NOW).ok, false)
})

test('随机事件遵循性格与猫咪数量，选择只结算一次', () => {
  const state = game(); const cat = state.cats[0]!
  cat.personality = 'shy'
  assert.equal(rollEvent(state, NOW), null)
  const event = rollEvent(state, NOW, rng, true)!
  assert.equal(event.eventId, 'cardboard-castle')
  const affection = cat.affection
  assert.equal(resolveEvent(state, event.id, 99, NOW).ok, false)
  assert.equal(resolveEvent(state, event.id, 0, NOW, rng).ok, true)
  assert.equal(cat.affection, affection + 6)
  assert.equal(resolveEvent(state, event.id, 0, NOW).ok, false)
  assert.equal(cat.affection, affection + 6)
})

test('多猫事件的回应同时影响两只猫', () => {
  const state = game()
  adoptCat(state, { name: '芝麻', breed: 'british', gender: 'male', source: 'shop' }, NOW, rng)
  const event = rollEvent(state, NOW, () => 0.99, true)!
  assert.equal(event.eventId, 'sunbeam-nap')
  assert.equal(event.catIds.length, 2)
  assert.equal(RANDOM_EVENTS.find(item => item.id === event.eventId)!.minCats, 2)
  resolveEvent(state, event.id, 0, NOW)
  assert.deepEqual(state.cats.map(cat => cat.affection), [61, 61])
})

test('偶遇领养免费、拒绝无惩罚，四猫容量限制有效', () => {
  const state = game(); const coins = state.coins
  assert.equal(maybeEncounter(state, NOW), null)
  assert.ok(maybeEncounter(state, NOW, rng, true))
  assert.equal(acceptEncounter(state, '豆包', NOW).ok, true)
  assert.equal(state.cats[1]!.name, '豆包')
  assert.equal(state.coins, coins)
  assert.equal(acceptEncounter(state, '重复', NOW).ok, false)
  maybeEncounter(state, NOW, rng, true)
  assert.equal(dismissEncounter(state, NOW).ok, true)
  assert.equal(state.coins, coins)
  for (let i = 0; i < 2; i++) { maybeEncounter(state, NOW, rng, true); acceptEncounter(state, '', NOW) }
  assert.equal(state.cats.length, 4)
  assert.equal(maybeEncounter(state, NOW, rng, true), null)
  assert.equal(adoptCat(state, { breed: 'orange', gender: 'female' }, NOW).ok, false)
})

test('陪伴只能在计时完成后结算一次，提前离开不处罚', () => {
  const state = game(); const cat = state.cats[0]!
  assert.equal(startCompanion(state, 'sleep', 1, NOW).ok, true)
  assert.equal(startCompanion(state, 'work', 1, NOW).ok, false)
  assert.equal(finishCompanion(state, NOW + 59_999).ok, false)
  assert.equal(finishCompanion(state, NOW + 60_000).ok, true)
  assert.equal(cat.affection, 59)
  assert.equal(cat.energy, 95)
  assert.equal(finishCompanion(state, NOW + 61_000).ok, false)
  assert.equal(cat.affection, 59)
  startCompanion(state, 'work', 5, NOW + 120_000)
  stopCompanion(state)
  assert.equal(cat.affection, 59)
})

test('职业评分依据题目答案、中文篇幅主题词和非空像素一致度', () => {
  assert.equal(scoreProgramming({ map: 'map', array: 'isArray', promise: 'all' }).score, 100)
  assert.equal(scoreProgramming({ map: 'map' }).valid, false)
  assert.equal(scoreWriting('雨猫温暖').valid, false)
  const text = '窗外的雨轻轻敲着玻璃，小咪靠在我的身旁。我摸了摸猫咪软软的毛，心里充满了温暖和安心，今天有它陪伴真好。'
  assert.equal(scoreWriting(text).score, 90)
  assert.equal(scoreWriting(text + '这一刻值得被好好记住，慢慢收藏。'.repeat(3)).score, 100)
  assert.equal(scorePainting(Array(64).fill(0)).valid, false)
  assert.equal(scorePainting([...PAINTING_REFERENCE]).score, 100)
  const extra = [...PAINTING_REFERENCE]; extra[0] = 1
  assert.ok(scorePainting(extra).score < 100)
  assert.equal(scorePainting([-1]).valid, false)
})

test('职业奖励防重复提交、刷新重放及一分钟内再次开工', () => {
  const state = game(); const coins = state.coins
  assert.equal(startCareerRound(state, 'programmer', NOW, rng).ok, true)
  const round = state.careerRound!
  const answers = Object.fromEntries(PROGRAMMING_QUESTIONS.map(question => [question.id, question.answer]))
  assert.equal(submitCareerRound(state, round.id, { answers }, NOW).reward, 40)
  assert.equal(state.coins, coins + 40)
  assert.equal(submitCareerRound(state, round.id, { answers }, NOW + 61_000).ok, false)
  assert.equal(startCareerRound(state, 'writer', NOW + 1000).ok, false)
  const restored = deserializeGame(serializeGame(state), NOW + 1000)!
  assert.equal(submitCareerRound(restored, round.id, { answers }, NOW + 61_000).ok, false)
  assert.equal(startCareerRound(restored, 'writer', NOW + 61_000).ok, true)
  assert.notEqual(restored.careerRound!.id, round.id)
})

test('存档保留在途陪伴、事件、职业与库存；损坏数据安全拒绝', () => {
  const state = game()
  startCompanion(state, 'work', 5, NOW)
  rollEvent(state, NOW, rng, true)
  maybeEncounter(state, NOW, rng, true)
  startCareerRound(state, 'painter', NOW, rng)
  const restored = deserializeGame(serializeGame(state), NOW)!
  assert.deepEqual(restored.cats, state.cats)
  assert.deepEqual(restored.inventory, state.inventory)
  assert.deepEqual(restored.companion, state.companion)
  assert.deepEqual(restored.pendingEvent, state.pendingEvent)
  assert.deepEqual(restored.pendingEncounter, state.pendingEncounter)
  assert.deepEqual(restored.careerRound, state.careerRound)
  assert.equal(deserializeGame('not-json', NOW), null)
  assert.equal(deserializeGame('{"version": 2, "cats": []}', NOW), null)
  const broken = JSON.parse(serializeGame(state)); broken.cats[0].personality = '__proto__'
  assert.equal(deserializeGame(JSON.stringify(broken), NOW), null)
  broken.cats[0].personality = 'proud'; broken.cats[0].food = null
  assert.equal(deserializeGame(JSON.stringify(broken), NOW), null)
})

test('存储受限或满额不会抛错；读取存档会温和结算离线时间', () => {
  const state = game()
  assert.equal(saveGame(state, { setItem() { throw new Error('quota') } }), false)
  assert.equal(loadGame({ getItem() { throw new Error('denied') } }, NOW), null)
  let raw = ''
  assert.equal(saveGame(state, { setItem(_key, value) { raw = value } }), true)
  const restored = loadGame({ getItem() { return raw } }, NOW + HOUR)!
  assert.equal(restored.cats[0]!.food, 72)
  assert.equal(restored.lastUpdatedAt, NOW + HOUR)
})

test('存档拒绝超长或重复猫咪 ID，不会截断后产生引用碰撞', () => {
  const state = game()
  const parsed = JSON.parse(serializeGame(state))
  const prefix = 'cat-' + '1'.repeat(80)
  parsed.cats = [{ ...parsed.cats[0], id: prefix + '1' }, { ...parsed.cats[0], id: prefix + '2' }]
  assert.equal(deserializeGame(JSON.stringify(parsed), NOW), null)
  parsed.cats = [{ ...state.cats[0] }, { ...state.cats[0] }]
  assert.equal(deserializeGame(JSON.stringify(parsed), NOW), null)
  parsed.cats = [{ ...state.cats[0], id: '__proto__' }]
  assert.equal(deserializeGame(JSON.stringify(parsed), NOW), null)
})

test('恢复时根据所有对象的 ID 修复序号，重复读取不会增加序号', () => {
  const state = game()
  startCareerRound(state, 'programmer', NOW, rng)
  state.careerRound!.id = 'job-700'
  state.completedJobIds = ['job-900']
  state.diary[0]!.id = 'diary-800'
  state.sequence = 1
  const restored = deserializeGame(serializeGame(state), NOW)!
  assert.equal(restored.sequence, 900)
  const reopened = deserializeGame(serializeGame(restored), NOW)!
  assert.equal(reopened.sequence, 900)
  startCareerRound(reopened, 'writer', NOW, rng)
  assert.equal(reopened.careerRound!.id, 'job-901')
})

test('大步时间结算只处罚真正缺水的时段，与逐分钟更新一致', () => {
  const once = game(); const stepped = game()
  for (const state of [once, stepped]) { state.cats[0]!.food = 60; state.cats[0]!.water = 18.6 }
  advanceTime(once, NOW + HOUR)
  for (let minute = 1; minute <= 60; minute++) advanceTime(stepped, NOW + minute * 60_000)
  assert.ok(Math.abs(once.cats[0]!.affection - 53.8) < 0.00001)
  assert.ok(Math.abs(once.cats[0]!.affection - stepped.cats[0]!.affection) < 0.00001)
})

test('跨本地午夜恢复保留昨天已使用的扣分上限，离线单次最多扣六点', () => {
  const beforeMidnight = new Date(2026, 8, 18, 23, 45).getTime()
  const afterMidnight = beforeMidnight + 30 * 60_000
  const state = createGame({}, beforeMidnight, rng)
  const cat = state.cats[0]!
  cat.food = 0; cat.water = 0
  state.neglectLossToday[cat.id] = 6
  const restored = loadGame({ getItem: () => serializeGame(state) }, afterMidnight)!
  assert.equal(restored.cats[0]!.affection, 52)
  assert.equal(restored.neglectLossToday[cat.id], 3)
  assert.equal(restored.neglectDay, '2026-09-19')

  const long = createGame({}, beforeMidnight - HOUR, rng)
  long.cats[0]!.food = 0; long.cats[0]!.water = 0
  advanceTime(long, afterMidnight + HOUR, { offline: true })
  assert.equal(long.cats[0]!.affection, 49)
})

test('已被预警的猫咪在离线返回后仍获得完整五分钟照料机会', () => {
  const state = game(); const cat = state.cats[0]!
  cat.affection = 8; cat.warnedAt = NOW - 10 * 60_000
  const restored = loadGame({ getItem: () => serializeGame(state) }, NOW + HOUR)!
  assert.equal(restored.cats[0]!.warnedAt, NOW + HOUR)
  advanceTime(restored, NOW + HOUR + 15_000)
  assert.equal(restored.cats[0]!.status, 'home')
  advanceTime(restored, NOW + HOUR + 5 * 60_000)
  assert.equal(restored.cats[0]!.status, 'away')
})

test('照料冷却能跨存档继续，时钟回退不会把操作长期锁住', () => {
  const state = game(); const cat = state.cats[0]!
  assert.equal(careForCat(state, cat.id, 'pet', NOW).ok, true)
  const restored = deserializeGame(serializeGame(state), NOW + 10_000)!
  assert.equal(careForCat(restored, cat.id, 'pet', NOW + 29_999).ok, false)
  assert.equal(careForCat(restored, cat.id, 'pet', NOW + 30_000).ok, true)
  assert.equal(careForCat(state, cat.id, 'pet', NOW - HOUR).ok, false)
  assert.equal(careForCat(state, cat.id, 'pet', NOW - HOUR + 30_000).ok, true)
  assert.equal(careForCat(state, cat.id, 'pet', Number.NaN).ok, false)
})

test('拒绝存档中重复事件目标及错误性格，离家后的事件不能再加好感', () => {
  const state = game()
  const pending = rollEvent(state, NOW, rng, true)!
  const parsed = JSON.parse(serializeGame(state))
  parsed.pendingEvent.catIds.push(parsed.pendingEvent.catIds[0])
  assert.equal(deserializeGame(JSON.stringify(parsed), NOW)!.pendingEvent, null)
  parsed.pendingEvent.catIds.pop()
  parsed.pendingEvent.eventId = 'cardboard-castle'
  assert.equal(deserializeGame(JSON.stringify(parsed), NOW)!.pendingEvent, null)
  state.cats[0]!.status = 'away'
  assert.equal(resolveEvent(state, pending.id, 0, NOW).ok, false)
  assert.equal(state.pendingEvent, null)
  assert.equal(state.cats[0]!.affection, 55)
})

test('库存达到存档上限时不扣款，装扮库存恢复为单件', () => {
  const state = game(); const coins = state.coins
  state.inventory.food = 9998
  assert.equal(buyItem(state, 'food', 1, NOW).ok, false)
  assert.equal(state.coins, coins)
  assert.equal(state.inventory.food, 9998)
  state.inventory.ribbon = 999
  const restored = deserializeGame(serializeGame(state), NOW)!
  assert.equal(restored.inventory.ribbon, 1)
  assert.equal(restored.inventory.food, 9998)
})

test('未来时钟存档的陪伴会重新校准，猫咪离家时不恢复在途陪伴', () => {
  const state = game()
  startCompanion(state, 'work', 5, NOW + HOUR)
  const restored = deserializeGame(serializeGame(state), NOW)!
  assert.equal(restored.companion!.startedAt, NOW)
  assert.equal(restored.companion!.endsAt, NOW + 5 * 60_000)
  state.cats[0]!.status = 'away'
  assert.equal(deserializeGame(serializeGame(state), NOW)!.companion, null)
})
