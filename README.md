# GLM Quota Widget

一个轻量的 **GLM Coding Plan 多账号桌面额度监控工具**。面向同时使用多个智谱 BigModel / Z.ai 账号的开发者，常驻系统托盘，快速查看每个账号的 5 小时窗口、7 天额度与 MCP / Web Search 用量。

> 当前版本：v0.1.0 MVP。Windows 优先，Electron 实现。

## 功能

- 多账号管理：一个窗口同时查看多个 GLM Coding Plan 账号
- 5 小时 Token 窗口：使用百分比、重置倒计时
- 7 天 Token 窗口：使用百分比、重置倒计时
- MCP / Web Search：已用 / 总量
- 自动识别当前最空闲账号
- 系统托盘常驻，点击托盘图标显示 / 隐藏
- 1–60 分钟自动刷新
- 80% / 90% 默认黄色、红色阈值，可配置
- 达到阈值时发送桌面通知
- Windows 登录后自启动（可选）
- API Key 只保存在本机，优先使用 Electron `safeStorage` 加密
- 支持智谱国内站与 Z.ai 国际站，自定义 API Endpoint

## 界面定位

本项目不是完整的 API 管理后台，而是一个常驻桌面的“小仪表盘”：打开即看到所有账号谁还有额度、谁快到限制、何时重置。

## 数据接号

应用使用 GLM Coding Plan 控制台的监控接口：

- `GET /api/monitor/usage/quota/limit`
- `GET /api/biz/subscription/list`

默认 Endpoint：

- BigModel：中国大陆 `https://open.bigmodel.cn`
- Z.ai：国际站 `https://api.z.ai`

认证方式：

```http
Authorization: Bearer <API_KEY>
```

额度解析约定：

- `TOKENS_LIMIT + unit=3 + number=5`：5 小时窗口
- `TOKENS_LIMIT + unit=6 + number=7`：7 天窗口
- `TIME_LIMIT`：MCP / Web Search 等调用额度

这些接口并非公开 API 文档中的稳定接口，未来平台调整时可能需要更新 `src/main/quota.js`。

## 本地运行

要求：Node.js 22+。

```bash
npm install
npm start
```

## 测试

```bash
npm test
```

## Windows 打包

```bash
npm run dist
```

输出位于 `dist/`，包含 Portable EXE 和 NSIS 安装包。

GitHub Actions 在 `main` 分支 push 时自动执行测试并构建 Windows 安装包，可在 Actions 的 `glm-quota-widget-windows` Artifact 中下载。

## 安全说明

API Key 不会发往任何第三方服务。网络请求只发送到你为账号选择的 BigModel / Z.ai Endpoint。

在支持系统加密的环境中，Key 使用 Electron `safeStorage` 加密后写入应用配置目录。若系统安全存储不可用，当前 MVP 会退化为 Base64 本地存储并在代码中明确标记；后续版本可改为强制要求 OS Credential Store。

配置文件位置由 Electron `userData` 目录决定，Windows 通常位于 `%APPDATA%/GLM Quota Widget/` 附近。

## 路线图

- [ ] Windows 原生安装包签名
- [ ] 账号排序 / 拖拽
- [ ] 用量历史与趋势图
- [ ] 低额度账号自动折叠，高风险账号置顶
- [ ] 托盘直接显示多个账号百分比
- [ ] API Key 导入 / 导出（不导出明文 Key）
- [ ] macOS / Linux 发布产物
- [ ] 账号标签（主号 / 开发 / 备用）

## License

MIT
