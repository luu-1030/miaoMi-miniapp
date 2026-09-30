'use strict'
const auth = require('miao-auth')
// The collection uses BSON int for revisions.
const MAX_REVISION = 2_147_483_647

exports.main = async event => {
  try {
    const uid = auth.verifyToken(event && event.token)
    const collection = uniCloud.database().collection('miao-saves')
    if (event.action === 'load') {
      const result = await collection.doc(uid).get()
      const record = result.data[0]
      if (!record) return { code: 0, revision: 0, state: null }
      if (!Number.isInteger(record.revision) || record.revision < 1 || record.revision > MAX_REVISION) {
        return { code: 500, message: '云端存档版本异常，请保留本地进度。' }
      }
      return { code: 0, revision: record.revision, state: auth.validateState(record.state) }
    }
    if (event.action !== 'save') return { code: 400, message: '不支持的存档操作。' }
    const state = auth.validateState(event.state)
    const expected = event.expectedRevision
    if (!Number.isInteger(expected) || expected < 0 || expected >= MAX_REVISION) {
      return { code: 400, message: '存档版本无效，请先恢复云端存档。' }
    }
    const revision = expected + 1
    if (expected === 0) {
      try {
        await collection.add({ _id: uid, state, revision, updated_at: Date.now() })
      } catch (error) {
        // A second device must never overwrite a save it has not loaded.
        const result = await collection.doc(uid).get()
        if (!result.data.length) throw error
        return { code: 409, message: '云端已有存档，请先恢复云端进度后再备份。' }
      }
    } else {
      const result = await collection.where({ _id: uid, revision: expected }).update({ state, revision, updated_at: Date.now() })
      if (result.updated !== 1) return { code: 409, message: '云端存档已更新，请先恢复云端进度后再备份。' }
    }
    return { code: 0, revision }
  } catch (error) {
    if (error.message === 'UNAUTHORIZED') return { code: 401, message: '登录已过期，请重新登录。' }
    if (error.message === 'INVALID_STATE') return { code: 400, message: event && event.action === 'load' ? '云端存档格式不正确，请保留本地进度。' : '存档格式不正确，未写入云端。' }
    if (error.message === 'SERVER_NOT_CONFIGURED') return { code: 503, message: '云端鉴权配置尚未完成。' }
    return { code: 500, message: '存档服务暂不可用，请稍后重试。' }
  }
}
