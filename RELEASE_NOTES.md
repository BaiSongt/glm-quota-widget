# GLM Quota Widget v1.0.0

首个正式稳定版本。

## 核心能力

- 多 GLM Coding Plan 账号统一监控。
- 同时展示 5 小时额度、7 天额度与 MCP / Web 用量。
- 自动识别当前最空闲账号，并在摘要区显示最低 5h 使用率。
- 支持单账号刷新、全量自动刷新、托盘常驻与桌面通知。
- API Key 使用 Electron safeStorage 加密保存（系统不支持时保留兼容回退）。

## v1.0 UI

- 三套 Liquid Glass 主题：Clear、Prism、Midnight。
- 参考 shuding/liquid-glass 的圆角 SDF + SVG feDisplacementMap，实现真实背景折射。
- 动态彩色流场、鼠标柔光响应与点击波纹。
- 账号卡采用单实例 Accordion：折叠状态紧凑，展开状态按内容自适应。
- 同一时刻最多展开一个账号；展开/收起带平滑动画。
- 刷新、编辑、删除使用 SVG 图标按钮。
- 浅色主题重新优化文字对比度，夜间主题降低高光强度。
- 窗口、卡片、动态光学层统一连续圆角裁切。

## Windows 下载

Release 附带两种 x64 包：

- **Portable**：无需安装，直接运行。
- **Setup**：NSIS 安装包，可选择安装目录。

## 说明

GLM 配额接口属于非公开监控接口，未来平台调整接口结构时，本工具可能需要同步更新适配器。
