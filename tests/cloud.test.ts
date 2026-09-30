import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import {
  adoptCat, createGame, deserializeGame, equipOutfit, maybeEncounter, rollEvent,
  startCareerRound, startCompanion,
} from '../src/game/engine.ts'

const NOW = Date.UTC(2026, 8, 20, 10)
const ROOT = resolve(import.meta.dirname, '../apps/miniapp/uniCloud-aliyun/cloudfunctions')
const nativeRequire = createRequire(import.meta.url)
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const ENV = {
  MIAOMI_WX_APP_ID: 'wx0123456789abcdef',
  MIAOMI_WX_APP_SECRET: 'test-wechat-secret-for-unit-tests',
  MIAOMI_TOKEN_SECRET: 'test-signing-secret-at-least-thirty-two-bytes',
}

// Execute the deployable CommonJS sources with real Node crypto and the emitted
// game module. Only the provider SDK, server config and clock are substituted.
function moduleWith(file: string, modules: Record<string, unknown> = {}, globals: Record<string, unknown> = {}) {
  const module = { exports: {} as any }
  const source = readFileSync(resolve(ROOT, file), 'utf8')
  runInNewContext(source, {
    module, exports: module.exports, Buffer,
    Date: class extends Date { static now() { return NOW } },
    process: { env: { ...ENV } },
    require(name: string) {
      if (Object.hasOwn(modules, name)) return modules[name]
      if (name === './config.json') throw Object.assign(new Error('No test config file'), { code: 'MODULE_NOT_FOUND' })
      return nativeRequire(name)
    },
    ...globals,
  }, { filename: file })
  return module.exports
}

function setup() {
  const game = nativeRequire(resolve(ROOT, 'common/miao-game/engine.js'))
  const auth = moduleWith('common/miao-auth/index.js', { 'miao-game': game })
  const records = new Map<string, any>()
  const requests: { url: string; options: any }[] = []
  let failDatabase = false
  let providerReply: unknown = { openid: 'test-player-openid', session_key: 'never-return-this' }
  let failProvider = false
  const collection = {
    doc(id: string) {
      return { async get() {
        if (failDatabase) throw new Error('provider-internal-error-with-secret')
        return { data: records.has(id) ? [clone(records.get(id))] : [] }
      } }
    },
    async add(record: any) {
      if (failDatabase) throw new Error('provider-internal-error-with-secret')
      if (records.has(record._id)) throw new Error('duplicate key')
      records.set(record._id, clone(record))
      return { id: record._id }
    },
    where(query: { _id: string; revision: number }) {
      return { async update(patch: any) {
        if (failDatabase) throw new Error('provider-internal-error-with-secret')
        const current = records.get(query._id)
        if (!current || current.revision !== query.revision) return { updated: 0 }
        records.set(query._id, { ...current, ...clone(patch) })
        return { updated: 1 }
      } }
    },
  }
  const uniCloud = {
    database: () => ({ collection(name: string) { assert.equal(name, 'miao-saves'); return collection } }),
    httpclient: { async request(url: string, options: any) {
      requests.push({ url, options })
      if (failProvider) throw new Error('provider-internal-error-with-secret')
      return { data: providerReply }
    } },
  }
  const save = moduleWith('miao-save/index.js', { 'miao-auth': auth }, { uniCloud }).main
  const session = moduleWith('miao-session/index.js', { 'miao-auth': auth }, { uniCloud }).main
  const uid = auth.userId('test-player-openid')
  const token = auth.createToken(uid)
  return {
    auth, save, session, uid, token, records, requests,
    failDatabase: () => { failDatabase = true },
    failProvider: () => { failProvider = true },
    providerReply: (reply: unknown) => { providerReply = reply },
  }
}

function fullGame() {
  const state = createGame({ catName: '团子', breed: 'ragdoll' }, NOW, () => 0)
  state.coins = 900
  adoptCat(state, { name: '芝麻', breed: 'tuxedo', gender: 'male', source: 'shop' }, NOW, () => 0.5)
  state.inventory.ribbon = 1
  equipOutfit(state, state.cats[0]!.id, 'ribbon')
  rollEvent(state, NOW, () => 0, true)
  maybeEncounter(state, NOW, () => 0.5, true)
  startCareerRound(state, 'writer', NOW, () => 0.25)
  startCompanion(state, 'work', 25, NOW)
  return state
}

function legacyGame() {
  return { schemaVersion: 1, adopted: true, breed: '英短蓝猫', gender: '弟弟', personality: 1,
    affection: 72, hunger: 63, thirst: 59, coins: 163, adoptedAt: NOW - 100_000,
    updatedAt: NOW - 10_000, lastPetAt: NOW - 20_000, lastGroomAt: NOW - 30_000 }
}

function signedClaims(claims: unknown) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64')
  return payload + '.' + createHmac('sha256', ENV.MIAOMI_TOKEN_SECRET).update(payload).digest('hex')
}

test('微信登录仅在云端交换 code，不返回 openid、AppSecret 或 session_key', async () => {
  const server = setup()
  const result = await server.session({ code: 'valid-wechat-code' })
  assert.equal(result.code, 0)
  assert.equal(server.auth.verifyToken(result.token), server.uid)
  assert.deepEqual(Object.keys(result).sort(), ['code', 'token'])
  assert.equal(server.requests[0]!.url, 'https://api.weixin.qq.com/sns/jscode2session')
  assert.equal(server.requests[0]!.options.data.js_code, 'valid-wechat-code')
  assert.equal(server.requests[0]!.options.data.appid, ENV.MIAOMI_WX_APP_ID)
  assert.equal(server.requests[0]!.options.data.secret, ENV.MIAOMI_WX_APP_SECRET)
})

test('无效微信 code 和微信服务错误不会签发登录令牌', async () => {
  const server = setup()
  for (const value of [null, {}, { code: '' }, { code: 12345 }, { code: 'a'.repeat(257) }]) {
    assert.equal((await server.session(value)).code, 400)
  }
  assert.equal(server.requests.length, 0)
  for (const reply of [null, { errcode: 40029 }, { openid: '' }, { openid: 123 }]) {
    server.providerReply(reply)
    assert.equal((await server.session({ code: 'bad-code' })).code, 401)
  }
  server.failProvider()
  const failed = await server.session({ code: 'valid-code' })
  assert.equal(failed.code, 503)
  assert.doesNotMatch(JSON.stringify(failed), /secret|internal-error/)
})

test('真实 HMAC 验签拒绝伪造、过期、异常时长与畸形令牌', async () => {
  const server = setup()
  assert.equal(server.auth.verifyToken(server.token), server.uid)
  const payload = server.token.split('.')[0]
  const fake = payload + '.' + '0'.repeat(64)
  const malformed = [null, '', 'a'.repeat(1025), 'a.b', server.token + '.extra', fake,
    signedClaims({ uid: server.uid, exp: NOW }),
    signedClaims({ uid: server.uid, exp: NOW - 1 }),
    signedClaims({ uid: server.uid, exp: NOW + 3 * 60 * 60 * 1000 }),
    signedClaims({ uid: 'another-user', exp: NOW + 1000 }),
    signedClaims({ uid: server.uid, exp: NOW + 0.5 })]
  for (const token of malformed) {
    assert.throws(() => server.auth.verifyToken(token), /UNAUTHORIZED/)
    assert.equal((await server.save({ action: 'load', token })).code, 401)
  }
  assert.throws(() => server.auth.createToken('client-provided-user-id'), /UNAUTHORIZED/)
})

test('缺少云端配置时返回明确错误且不泄漏配置内容', async () => {
  const auth = moduleWith('common/miao-auth/index.js', {}, { process: { env: {} } })
  assert.throws(() => auth.getConfig(), /SERVER_NOT_CONFIGURED/)
  const session = moduleWith('miao-session/index.js', { 'miao-auth': auth }).main
  const result = await session({ code: 'valid-code' })
  assert.equal(result.code, 503)
  assert.match(result.message, /配置/)
})

test('完整多猫存档保留事件、陪伴、职业、装扮，并丢弃未知字段', async () => {
  const server = setup()
  const state = fullGame()
  const sent = { ...state, uid: 'attacker', extra: 'not persisted' }
  assert.equal((await server.save({ action: 'save', token: server.token, state: sent, expectedRevision: 0 })).code, 0)
  const result = await server.save({ action: 'load', token: server.token })
  assert.equal(result.revision, 1)
  assert.deepEqual(clone(result.state), clone(deserializeGame(JSON.stringify(state), NOW)))
  assert.equal(result.state.cats.length, 2)
  assert.equal(result.state.cats[0].outfit, 'ribbon')
  assert.ok(result.state.pendingEvent)
  assert.ok(result.state.pendingEncounter)
  assert.ok(result.state.companion)
  assert.equal(result.state.careerRound.profession, 'writer')
  assert.equal(result.state.uid, undefined)
  assert.equal(server.records.get(server.uid).updated_at, NOW)
})

test('云端和上传的旧版单猫存档可迁移，不改变钱包、性格和冷却', async () => {
  const server = setup()
  server.records.set(server.uid, { _id: server.uid, revision: 3, state: legacyGame(), updated_at: NOW - 10_000 })
  const loaded = await server.save({ action: 'load', token: server.token })
  assert.equal(loaded.code, 0)
  assert.equal(loaded.revision, 3)
  assert.equal(loaded.state.version, 1)
  assert.equal(loaded.state.coins, 163)
  const cat = loaded.state.cats[0]
  assert.equal(cat.breed, 'british')
  assert.equal(cat.gender, 'male')
  assert.equal(cat.personality, 'proud')
  assert.equal(cat.affection, 72)
  assert.equal(cat.food, 63)
  assert.equal(cat.water, 59)
  assert.equal(cat.lastCareAt.pet, NOW - 20_000)
  assert.equal(cat.lastCareAt.brush, NOW - 30_000)
  assert.equal(loaded.state.lastUpdatedAt, NOW - 10_000)
  assert.equal(server.records.get(server.uid).state.schemaVersion, 1)
  const saved = await server.save({ action: 'save', token: server.token, state: legacyGame(), expectedRevision: 3 })
  assert.equal(saved.code, 0)
  assert.equal(saved.revision, 4)
  assert.equal(server.records.get(server.uid).state.version, 1)
})

test('旧版各品种和性格均确定性迁移，非法旧版数据被拒绝', () => {
  const { auth } = setup()
  for (const [breed, expected] of Object.entries({ '橘猫': 'orange', '布偶猫': 'ragdoll', '英短蓝猫': 'british', '奶牛猫': 'tuxedo' })) {
    assert.equal(auth.validateState({ ...legacyGame(), breed }).cats[0].breed, expected)
  }
  for (const [personality, expected] of ['clingy', 'proud', 'curious'].entries()) {
    assert.equal(auth.validateState({ ...legacyGame(), personality }).cats[0].personality, expected)
  }
  for (const bad of [{ personality: 3 }, { breed: '__proto__' }, { coins: 1_000_001 }, { adopted: false }, { updatedAt: NOW + 60_001 }]) {
    assert.throws(() => auth.validateState({ ...legacyGame(), ...bad }), /INVALID_STATE/)
  }
})

test('云端拒绝超限余额、库存、猫数、未来时间和超大存档，保留上一份备份', async () => {
  const server = setup()
  const state = fullGame()
  await server.save({ action: 'save', token: server.token, state, expectedRevision: 0 })
  const original = clone(server.records.get(server.uid))
  const invalid: unknown[] = [null, [], {}, { ...state, version: 9 }, { ...state, coins: -1 },
    { ...state, coins: 1_000_001 }, { ...state, coins: 1.5 }, { ...state, coins: Infinity },
    { ...state, cats: [] }, { ...state, cats: [...state.cats, ...state.cats, ...state.cats] },
    { ...state, inventory: { ...state.inventory, food: 10_000 } },
    { ...state, inventory: { ...state.inventory, ribbon: 2 } },
    { ...state, inventory: { ...state.inventory, treat: -1 } },
    { ...state, lastUpdatedAt: NOW + 60_001 },
    { ...state, cats: state.cats.map(cat => ({ ...cat, affection: 101 })) },
    { ...state, cats: state.cats.map(cat => ({ ...cat, breed: 'unknown' })) },
    { ...state, pendingEvent: { ...state.pendingEvent, createdAt: NOW + 60_001 } },
    { ...state, companion: { ...state.companion, startedAt: NOW + 60_001 } },
    { ...state, diary: [{ id: 'diary-999', text: '中文'.repeat(60_000), time: NOW, kind: 'system' }] },
  ]
  for (const value of invalid) {
    const result = await server.save({ action: 'save', token: server.token, state: value, expectedRevision: 1 })
    assert.equal(result.code, 400)
    assert.deepEqual(server.records.get(server.uid), original)
  }
})

test('用户身份只能来自有效令牌，客户端 uid 无法读取或覆盖他人存档', async () => {
  const server = setup()
  const state = fullGame()
  await server.save({ action: 'save', token: server.token, state, expectedRevision: 0 })
  const otherUid = server.auth.userId('another-openid')
  const token = server.auth.createToken(otherUid)
  assert.notEqual(otherUid, server.uid)
  assert.deepEqual(clone(await server.save({ action: 'load', token, uid: server.uid })), { code: 0, revision: 0, state: null })
  assert.equal((await server.save({ action: 'save', token, uid: server.uid, state: { ...state, coins: 1 }, expectedRevision: 0 })).code, 0)
  assert.equal(server.records.get(server.uid).state.coins, state.coins)
  assert.equal(server.records.get(otherUid).state.coins, 1)
})

test('同一版本同时备份只允许一次成功，初次创建也不会覆盖', async () => {
  const server = setup()
  const state = fullGame()
  const initial = await Promise.all([1, 2].map(coins => server.save({ action: 'save', token: server.token, state: { ...state, coins }, expectedRevision: 0 })))
  assert.deepEqual(initial.map(result => result.code).sort(), [0, 409])
  assert.equal(server.records.get(server.uid).revision, 1)
  const updates = await Promise.all([3, 4].map(coins => server.save({ action: 'save', token: server.token, state: { ...state, coins }, expectedRevision: 1 })))
  assert.deepEqual(updates.map(result => result.code).sort(), [0, 409])
  assert.equal(server.records.get(server.uid).revision, 2)
  assert.equal(server.records.get(server.uid).state.coins, 3)
  assert.equal((await server.save({ action: 'save', token: server.token, state, expectedRevision: 1 })).code, 409)
})

test('修订号必须在数据库 int 范围内，非法操作不会写入', async () => {
  const server = setup()
  for (const expectedRevision of [undefined, null, -1, 0.5, '0', Infinity, 2_147_483_647]) {
    assert.equal((await server.save({ action: 'save', token: server.token, state: fullGame(), expectedRevision })).code, 400)
  }
  assert.equal((await server.save({ action: 'delete', token: server.token })).code, 400)
  assert.equal(server.records.size, 0)
  assert.equal((await server.save({ action: 'save', token: server.token, state: fullGame(), expectedRevision: 1 })).code, 409)
})

test('数据库错误与损坏备份不会泄漏内部异常或替换本地存档', async () => {
  const server = setup()
  server.records.set(server.uid, { _id: server.uid, revision: 1, state: { version: 999 } })
  const corrupted = await server.save({ action: 'load', token: server.token })
  assert.equal(corrupted.code, 400)
  assert.equal(corrupted.state, undefined)
  server.records.set(server.uid, { _id: server.uid, revision: -1, state: fullGame() })
  assert.equal((await server.save({ action: 'load', token: server.token })).code, 500)
  server.failDatabase()
  for (const action of ['load', 'save']) {
    const result = await server.save({ action, token: server.token, state: fullGame(), expectedRevision: 1 })
    assert.equal(result.code, 500)
    assert.doesNotMatch(JSON.stringify(result), /secret|internal-error/)
  }
})
