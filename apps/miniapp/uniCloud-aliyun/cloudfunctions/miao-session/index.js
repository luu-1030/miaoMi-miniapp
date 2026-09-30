'use strict'
const auth = require('miao-auth')

exports.main = async event => {
  if (!event || typeof event.code !== 'string' || event.code.length < 5 || event.code.length > 256) {
    return { code: 400, message: '缺少有效的微信登录凭证。' }
  }
  try {
    const config = auth.getConfig()
    const response = await uniCloud.httpclient.request('https://api.weixin.qq.com/sns/jscode2session', {
      method: 'GET', dataType: 'json', timeout: 10000,
      data: { appid: config.appId, secret: config.appSecret, js_code: event.code, grant_type: 'authorization_code' }
    })
    const data = response.data
    if (!data || data.errcode || typeof data.openid !== 'string' || data.openid.length === 0) {
      return { code: 401, message: '微信登录凭证已失效，请重新登录。' }
    }
    return { code: 0, token: auth.createToken(auth.userId(data.openid)) }
  } catch (error) {
    return {
      code: 503,
      message: error.message === 'SERVER_NOT_CONFIGURED' ? '请先在云端配置微信 AppID、AppSecret 与签名密钥。' : '微信登录服务暂不可用，请稍后再试。'
    }
  }
}
