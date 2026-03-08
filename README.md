# ai-stock-assistant-desktop

Windows 桌面端 MVP，基于 `Electron + Vue + Vite`，复用 `ai-stock-assistant-web` 前端，并将行情数据读取切到本地 SQLite。

## 当前能力

- 复用现有前端页面、路由、图表与业务交互
- 行情页在 Desktop 端优先读取本地 SQLite
- 本地缺失时自动调用桌面桥接层进行按需同步
- 支持导入初始化包（目录或 manifest/db 文件）
- 提供桌面端“本地数据”页面查看数据目录、远程服务地址与同步状态
- 后台记录同步状态，并定时刷新最近访问过的股票行情数据

## 目录结构

- `src/main/`：Electron 主进程、本地数据库、同步服务、导入服务
- `src/preload/`：安全桥接层
- `src/renderer/`：Vue 渲染层
- `src/shared/`：桥接接口类型

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run dist:dir
npm run dist:win
npm run dist:win:x64
npm run dist:win:arm64
```

## 远程服务地址

默认远程业务/同步源地址为：

- `http://127.0.0.1:8000/api`

可通过环境变量覆盖：

```bash
VITE_REMOTE_API_BASE=http://your-host:8000/api
REMOTE_API_BASE=http://your-host:8000/api
```

其中：

- `VITE_REMOTE_API_BASE` 给渲染层业务请求使用
- `REMOTE_API_BASE` 给主进程同步服务使用

## 本地数据目录

运行后，行情数据库默认保存在 Electron 用户数据目录下的：

- `market-data/market.db`
- `market-data/intraday.db`

## 初始化包格式

目前支持以下导入形式：

### 目录形式

目录内建议包含：

- `manifest.json`
- `market.db`
- `intraday.db`（可选）

### 单文件形式

可直接选择：

- `manifest.json`
- `market.db`

若只导入 `market.db`，分钟线库不会被覆盖。

### manifest 示例

```json
{
  "schemaVersion": 1,
  "packageVersion": "2026.03.08",
  "generatedAt": "2026-03-08T10:00:00Z",
  "markets": ["A"],
  "dateRange": {
    "start": "2010-01-01",
    "end": "2026-03-07"
  }
}
```

## MVP 注意事项

- 目前业务接口仍由渲染层直连远程服务
- 为了让 `file://` 下的桌面渲染层可访问远程服务，当前窗口启用了 `webSecurity: false`
- 这是 MVP 阶段的折中；后续建议演进为主进程代理或本地静态服务方案


## 自动更新

桌面端已经接入基于公开 `GitHub Releases` 的检查更新和自动下载能力。

### 运行时行为

- 仅更新流量直连 GitHub Releases
- 业务请求仍然只走你的服务器
- Windows 安装包启动后会自动检查更新
- 发现新版本后会后台下载
- 下载完成后可在“本地数据”页点击“立即安装”完成升级

### 本地开发

开发模式默认禁用更新检查。

如需调试更新逻辑，可设置：

```bash
ENABLE_DESKTOP_UPDATER_DEV=true
GH_UPDATE_OWNER=your-owner
GH_UPDATE_REPO=your-repo
npm run dev
```

### 本地生成带更新元数据的安装包

```bash
GH_UPDATE_OWNER=your-owner GH_UPDATE_REPO=your-repo npm run dist:win:update-local
```

这会生成自动更新所需的安装包和 `latest.yml` 元数据，但不会发布到 GitHub。

### 发布到 GitHub Releases

```bash
GH_TOKEN=your_github_token GH_UPDATE_OWNER=your-owner GH_UPDATE_REPO=your-repo npm run release:win:github
```

### GitHub Actions 自动发布

仓库已新增工作流：

- `.github/workflows/desktop-release.yml`

触发方式：

- 推送标签：`desktop-v*`
- 或手动触发 `workflow_dispatch`

工作流会：

- 构建 Windows `x64` 与 `arm64` 安装包
- 发布到当前公开仓库的 `GitHub Releases`
- 生成自动更新所需的 `latest.yml` / blockmap 等元数据

### 需要配置的仓库信息

运行时更新服务会优先读取：

- `package.json` 中的 `config.auto_update_owner`
- `package.json` 中的 `config.auto_update_repo`

发布脚本会在构建时自动把：

- `GH_UPDATE_OWNER`
- `GH_UPDATE_REPO`

写入打包后的应用元数据，因此正式安装包不依赖用户机器上的环境变量。
