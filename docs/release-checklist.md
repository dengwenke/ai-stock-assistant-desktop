# Desktop Release Checklist

## 1. 发布前配置

- 确认 `package.json` 版本号已提升
- 确认 `config.auto_update_provider` 为 `github`
- 确认 `config.auto_update_owner` 与 `config.auto_update_repo` 已填写真实值，或本次发布通过环境变量覆盖
- 确认 GitHub 仓库为公开仓库
- 确认 `.github/workflows/desktop-release.yml` 已存在并可用

## 2. 本地预检

```bash
npm run release:check
```

## 3. 本地验证更新元数据

```bash
GH_UPDATE_OWNER=<owner> \
GH_UPDATE_REPO=<repo> \
npm run dist:win:update-local
```

检查 `release/` 目录应至少包含：

- `latest.yml`
- `AI-Stock-Assistant-Desktop-Setup-<version>-x64.exe`
- `AI-Stock-Assistant-Desktop-Setup-<version>-arm64.exe`
- 对应 `.blockmap`

## 4. 发布到 GitHub Releases

### 方式 A：本地发布

```bash
GH_TOKEN=<github_token> \
GH_UPDATE_OWNER=<owner> \
GH_UPDATE_REPO=<repo> \
npm run release:win:github
```

### 方式 B：GitHub Actions

- 创建 tag：`v<version>`（兼容 `desktop-v<version>`）
- push tag 后等待 `.github/workflows/desktop-release.yml` 完成

## 5. 发布后检查

- 确认 GitHub Release 为公开可见
- 确认 Release 中存在：
  - `latest.yml`
  - `AI-Stock-Assistant-Desktop-Setup-<version>-x64.exe`
  - `AI-Stock-Assistant-Desktop-Setup-<version>-arm64.exe`
- 确认 `latest.yml` 中的文件名与 Release 中的真实文件名一致
- 在已安装旧版本的 Windows 机器上启动 App，确认：
  - 自动检查更新触发
  - 顶部更新胶囊出现状态变化
  - 更新完成后出现安装提示

## 6. 失败排查

### 检查更新失败

- 确认 `config.auto_update_owner` / `config.auto_update_repo` 正确
- 确认 GitHub Release 不是 draft
- 确认 Release 页面可匿名访问
- 确认 `latest.yml` 已上传

### 下载失败

- 确认 Release 资产文件未损坏
- 确认 `latest.yml` 中的文件名与资产文件名完全一致
- 确认网络能访问 GitHub Releases

### 安装失败

- 确认当前安装包是 NSIS 包
- 确认用户有权限写安装目录
- 检查 Electron 日志输出
