# 小咪小咪 · uni-app x 微信小程序

这里是真实的 `.uvue` + UTS 工程，使用 HBuilderX 打开本目录。根目录的 Vue 3 + Vite Web 演示是独立实现。根据 [DCloud CLI 文档](https://doc.dcloud.net.cn/uni-app-x/cli.html)，uni-app x 不支持普通 uni-app 的 Vite CLI 创建方式，不能把两种工程的命令混用。

## 已实现

- 首次领养可选择品种、性别、名字和职业，性格随机且隐藏。
- 7 类照料、状态与离线衰减、离家预警和找回、性格专属回应。
- 最多 4 只猫、随机相遇、多猫事件、装扮、食物和猫舍购买。
- 工作、睡觉、放松、运动、看剧的计时陪伴，以及程序员、作家、画家小游戏。
- 日记、健康提醒、本机自动存档、剪贴板备份和恢复。
- 微信身份登录云函数、用户隔离的完整云存档、签名鉴权和版本冲突保护。

小程序和网页复用同一套游戏数据与规则，存档结构一致。微信端页面使用 `.uvue` / UTS，开启 uni-app x Vapor 模式，由新版 HBuilderX 编译。

## 在微信开发者工具运行

1. 安装支持微信小程序目标的新版 HBuilderX，导入本目录为 uni-app x 项目。
2. 在 `manifest.json` 配置自己的 DCloud 应用 AppID（顶层 `appid`）和微信小程序 AppID（`mp-weixin.appid`）。二者不是同一个 ID；本仓库均留空。
3. 在 HBuilderX 设置中配置微信开发者工具路径，并在微信开发者工具启用服务端口。
4. 通过 HBuilderX「运行 → 运行到小程序模拟器 → 微信开发者工具」编译。依赖和编译器由 HBuilderX 管理，本目录不提供假 `npm run dev:mp-weixin` 命令。
5. 本地领养、照料和存档不依赖云端。云同步需要完成以下配置。

## 配置 uniCloud

需要自己的 DCloud/uniCloud 账号、服务空间和微信 AppID/AppSecret；本仓库未部署或连接任何真实用户服务。

1. 在 HBuilderX 为 `uniCloud-aliyun` 关联自己的阿里云服务空间。其他服务商需按官方流程调整工程目录与兼容设置。
2. 复制 `cloudfunctions/common/miao-auth/config.example.json` 为同目录的 `config.json`，填入实际微信 AppID、AppSecret，以及至少 32 字节的随机签名密钥。该文件被此目录 `.gitignore` 排除；不要把它复制到前端。也可在支持环境变量的运行环境提供 `MIAOMI_WX_APP_ID`、`MIAOMI_WX_APP_SECRET`、`MIAOMI_TOKEN_SECRET`。
3. 通过 HBuilderX 上传 `common/miao-auth` 公共模块并安装云函数依赖，上传 `miao-session`、`miao-save` 两个云函数。
4. 上传 `database/miao-saves.schema.json` 创建集合；客户端数据库读写权限全部禁用，只有服务端云函数处理存档。
5. 在小程序「设置 → 微信云端备份」中备份或恢复。`miao-session` 用 `uni.login` 的一次性 code 换取微信身份，生成两小时有效签名令牌；客户端不传可信用户 ID。

云存档以服务端派生用户 ID 为主键；每次保存校验版本，冲突时要求先加载云端进度，不会静默覆盖其他设备的存档。恢复操作会替换当前设备进度。

## 验证与边界

本地 Node 检查覆盖页面结构、共享规则同步、云端签名鉴权、过期/伪造令牌拒绝、完整存档校验与云存档版本冲突逻辑。正式使用前仍需用自己的 AppID 和服务空间完成微信开发者工具及云上联调。

云端当前只对存档进行身份隔离、格式验证和并发保护。游戏经济、离线时间和好感计算仍由客户端执行，不能作为真实支付或可交易资产的可信账本；商业化前应改为服务端执行游戏指令并增加接口限流、日志及账户管理。微信订阅消息需要另行申请模板与用户订阅授权，目前页面中的健康提醒仅为本地文案。

官方参考：[uni-app x 文档](https://doc.dcloud.net.cn/uni-app-x/)、[uniCloud 云函数](https://doc.dcloud.net.cn/uniCloud/cf-functions.html)、[公共模块](https://doc.dcloud.net.cn/uniCloud/cf-common.html)。
