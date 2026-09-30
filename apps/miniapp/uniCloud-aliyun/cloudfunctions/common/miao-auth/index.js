'use strict'
const crypto = require('crypto')
const TOKEN_LIFETIME = 2 * 60 * 60 * 1000
const CLOCK_ALLOWANCE = 60_000
const MAX_SAVE_BYTES = 300_000

function getConfig() {
  let file = {}
  try { file = require('./config.json') } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error
  }
  const config = {
    appId: process.env.MIAOMI_WX_APP_ID || file.appId,
    appSecret: process.env.MIAOMI_WX_APP_SECRET || file.appSecret,
    tokenSecret: process.env.MIAOMI_TOKEN_SECRET || file.tokenSecret
  }
  if (!/^wx[a-f\d]{16}$/i.test(config.appId || '') ||
      typeof config.appSecret !== 'string' || config.appSecret.length < 16 ||
      typeof config.tokenSecret !== 'string' || Buffer.byteLength(config.tokenSecret) < 32 ||
      /填写|替换/.test(config.appSecret + config.tokenSecret)) {
    throw new Error('SERVER_NOT_CONFIGURED')
  }
  return config
}

function userId(openid) {
  return crypto.createHash('sha256').update(getConfig().appId + ':' + openid).digest('hex')
}

function sign(payload) {
  return crypto.createHmac('sha256', getConfig().tokenSecret).update(payload).digest('hex')
}

function createToken(uid) {
  if (typeof uid !== 'string' || !/^[a-f\d]{64}$/.test(uid)) throw new Error('UNAUTHORIZED')
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + TOKEN_LIFETIME })).toString('base64')
  return payload + '.' + sign(payload)
}

function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 1024) throw new Error('UNAUTHORIZED')
  const parts = token.split('.')
  if (parts.length !== 2 || !/^[A-Za-z0-9+/]+={0,2}$/.test(parts[0]) || !/^[a-f\d]{64}$/.test(parts[1])) throw new Error('UNAUTHORIZED')
  const expected = Buffer.from(sign(parts[0]), 'hex')
  const supplied = Buffer.from(parts[1], 'hex')
  if (!crypto.timingSafeEqual(expected, supplied)) throw new Error('UNAUTHORIZED')
  let claims
  try { claims = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8')) } catch (_) { throw new Error('UNAUTHORIZED') }
  if (!claims || typeof claims.uid !== 'string' || !/^[a-f\d]{64}$/.test(claims.uid) ||
      !Number.isSafeInteger(claims.exp) || claims.exp <= Date.now() ||
      claims.exp > Date.now() + TOKEN_LIFETIME + CLOCK_ALLOWANCE) throw new Error('UNAUTHORIZED')
  return claims.uid
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const within = (value, maximum) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum
const integerWithin = (value, maximum) => Number.isSafeInteger(value) && within(value, maximum)

// The first miniapp release stored a single cat using Chinese breed names.
// Migration is deterministic and retains the old cat, wallet and care cooldowns.
function migrateLegacyState(value, now) {
  const { createGame } = require('miao-game')
  const breeds = { '橘猫': 'orange', '布偶猫': 'ragdoll', '英短蓝猫': 'british', '奶牛猫': 'tuxedo' }
  if (value.schemaVersion !== 1 || value.adopted !== true ||
      !Object.hasOwn(breeds, value.breed) ||
      !['妹妹', '弟弟'].includes(value.gender)) throw new Error('INVALID_STATE')
  const limits = { personality: 2, affection: 100, hunger: 100, thirst: 100, coins: 1000000 }
  for (const [field, maximum] of Object.entries(limits)) {
    if (!integerWithin(value[field], maximum)) throw new Error('INVALID_STATE')
  }
  for (const field of ['adoptedAt', 'updatedAt', 'lastPetAt', 'lastGroomAt']) {
    if (!integerWithin(value[field], now + CLOCK_ALLOWANCE)) throw new Error('INVALID_STATE')
  }
  const state = createGame({ catName: '小咪', breed: breeds[value.breed], gender: value.gender === '妹妹' ? 'female' : 'male' }, Math.min(value.adoptedAt, now), () => 0)
  const cat = state.cats[0]
  cat.personality = ['clingy', 'proud', 'curious'][value.personality]
  cat.affection = value.affection
  cat.food = value.hunger
  cat.water = value.thirst
  if (value.lastPetAt > 0) cat.lastCareAt.pet = Math.min(value.lastPetAt, now)
  if (value.lastGroomAt > 0) cat.lastCareAt.brush = Math.min(value.lastGroomAt, now)
  state.coins = value.coins
  state.lastUpdatedAt = Math.min(value.updatedAt, now)
  state.nextEventAt = now + 90_000
  state.nextEncounterAt = now + 150_000
  return state
}

function validateState(value, now = Date.now()) {
  if (!record(value)) throw new Error('INVALID_STATE')
  let raw
  try { raw = JSON.stringify(value) } catch (_) { throw new Error('INVALID_STATE') }
  if (Buffer.byteLength(raw, 'utf8') > MAX_SAVE_BYTES) throw new Error('INVALID_STATE')
  if (value.schemaVersion === 1 && value.version === undefined) {
    value = migrateLegacyState(value, now)
    raw = JSON.stringify(value)
  }
  // Reject impossible balances instead of silently converting them to a cap.
  // This is a backup API, not an authoritative game economy.
  if (value.version !== 1 || value.initialized !== true ||
      !Array.isArray(value.cats) || value.cats.length < 1 || value.cats.length > 4 ||
      !integerWithin(value.coins, 1_000_000) || !record(value.inventory) ||
      !within(value.lastUpdatedAt, now + CLOCK_ALLOWANCE)) throw new Error('INVALID_STATE')
  for (const [item, cap] of Object.entries({ food: 9999, treat: 9999, ribbon: 1, scarf: 1 })) {
    if (!integerWithin(value.inventory[item], cap)) throw new Error('INVALID_STATE')
  }
  for (const cat of value.cats) {
    if (!record(cat) || ['food', 'water', 'cleanliness', 'mood', 'energy', 'affection'].some(key => !within(cat[key], 100)) ||
        !within(cat.joinedAt, now + CLOCK_ALLOWANCE) ||
        (cat.warnedAt !== null && !within(cat.warnedAt, now + CLOCK_ALLOWANCE)) || !record(cat.lastCareAt) ||
        Object.values(cat.lastCareAt).some(time => !within(time, now + CLOCK_ALLOWANCE))) throw new Error('INVALID_STATE')
  }
  if (value.lastCareerRewardAt !== null && !within(value.lastCareerRewardAt, now + CLOCK_ALLOWANCE)) throw new Error('INVALID_STATE')
  for (const key of ['pendingEvent', 'pendingEncounter', 'careerRound']) {
    if (value[key] !== null && (!record(value[key]) || !within(value[key].createdAt, now + CLOCK_ALLOWANCE))) throw new Error('INVALID_STATE')
  }
  if (value.companion !== null && (!record(value.companion) || !within(value.companion.startedAt, now + CLOCK_ALLOWANCE))) throw new Error('INVALID_STATE')
  if (!Array.isArray(value.diary) || value.diary.length > 60 || value.diary.some(entry => !record(entry) || !within(entry.time, now + CLOCK_ALLOWANCE))) throw new Error('INVALID_STATE')
  const { deserializeGame } = require('miao-game')
  const state = deserializeGame(raw, now)
  if (!state || !state.initialized) throw new Error('INVALID_STATE')
  return state
}

module.exports = { getConfig, userId, createToken, verifyToken, validateState }
