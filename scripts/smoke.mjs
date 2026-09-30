import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

await mkdir('test-results', { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('miaomi.save.v1')))
try {
  await page.clock.install()
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true })
  await page.getByRole('button', { name: '领养第一只小咪' }).click()
  await page.getByLabel('给小咪取个名字').fill('糯米')
  await page.getByRole('button', { name: '布偶猫', exact: true }).click()
  await page.getByLabel('小咪该怎么称呼你（选填）').fill('小林')
  await page.getByRole('button', { name: '接小咪回家', exact: true }).click()
  await page.getByRole('button', { name: /喂食 猫粮剩余/ }).click()
  let data = await save()
  assert.equal(data.cats[0].name, '糯米')
  assert.equal(data.cats[0].breed, 'ragdoll')
  assert.equal(data.inventory.food, 4)
  assert.ok(data.cats[0].food >= 99)
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal((await save()).cats[0].name, '糯米')

  await page.getByRole('button', { name: '好物小铺', exact: true }).click()
  const startingCoins = (await save()).coins
  await page.locator('.shop-card').filter({ hasText: '元气猫粮' }).getByRole('button', { name: '带回家' }).click()
  await page.locator('.shop-card').filter({ hasText: '薄荷小围巾' }).getByRole('button', { name: '带回家' }).click()
  data = await save()
  assert.equal(data.coins, startingCoins - 67)
  assert.equal(data.inventory.food, 7)
  await page.getByRole('button', { name: '我的背包' }).click()
  await page.locator('.settings-row').filter({ hasText: '薄荷小围巾' }).getByRole('button', { name: '穿戴' }).click()
  assert.equal((await save()).cats[0].outfit, 'scarf')
  await page.getByRole('button', { name: '关闭弹窗' }).click()

  await page.getByRole('button', { name: '我的小事业', exact: true }).click()
  await page.screenshot({ path: 'test-results/career-desktop.png', fullPage: true })
  // Use the writer's actual interaction path to verify score and reward wiring.
  await page.getByRole('tab', { name: '作家' }).click()
  await page.locator('textarea').fill('窗外下起了雨，小咪趴在我的膝盖上。我们一起听雨滴落下，毛茸茸的陪伴让我感到温暖和安心，今天也是值得好好收藏的一天。')
  const beforeJob = (await save()).coins
  await page.locator('.submit-work').click()
  data = await save()
  assert.ok(data.coins > beforeJob)
  assert.equal(data.careerRound.claimed, true)

  await page.getByRole('button', { name: '陪伴时光', exact: true }).click()
  await page.getByLabel('留一段时间给彼此').selectOption('1')
  await page.getByRole('button', { name: /一起开始/ }).click()
  assert.ok((await save()).companion)
  await page.getByRole('button', { name: '结束这次陪伴' }).click()
  assert.equal((await save()).companion, null)

  // Advance a browser-controlled clock through the actual one-minute timer.
  await page.getByRole('button', { name: /一起开始/ }).click()
  await page.clock.runFor(165000)
  assert.equal((await save()).companion, null)
  assert.ok((await save()).diary.some(entry => entry.kind === 'companion'))
  assert.ok((await save()).pendingEvent)
  await page.getByRole('button', { name: '消息与提醒' }).click()
  await page.locator('.notification-list > button').first().click()
  await page.locator('.event-choices > button').first().click()
  assert.equal((await save()).pendingEvent, null)
  await page.getByRole('button', { name: '消息与提醒' }).click()
  await page.locator('.notification-list > button').first().click()
  await page.getByLabel('如果带它回家，想叫它什么呢').fill('奶糖')
  const beforeEncounter = (await save()).coins
  const encounterCost = (await save()).pendingEncounter.sourceId === 'seller' ? 20 : 0
  await page.getByRole('button', { name: '欢迎成为这个家的一员' }).click()
  assert.equal((await save()).cats.length, 2)
  assert.equal((await save()).coins, beforeEncounter - encounterCost)

  await page.getByRole('button', { name: '生活设置', exact: true }).first().click()
  await page.getByRole('button', { name: '试试提醒' }).click()
  assert.equal(await page.locator('.reminder-bubble').count(), 1)
  await page.getByRole('button', { name: '好呀，一起休息' }).click()
  await page.getByRole('button', { name: '小咪的家', exact: true }).click()
  await page.clock.runFor(6000)
  await page.screenshot({ path: 'test-results/home-adopted.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await page.getByRole('button', { name: '我的小事业', exact: true }).click()
  await page.screenshot({ path: 'test-results/career-mobile.png', fullPage: true })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  assert.deepEqual(errors, [])
  console.log('PASS: adoption, care, persistence, shop, outfit, career reward, companion, event, encounter adoption, reminder, desktop/mobile layout; no browser errors.')
} finally {
  await browser.close()
}
