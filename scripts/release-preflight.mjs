#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { env, exit } from 'node:process'

function fail(message) {
  console.error(`✖ ${message}`)
  exit(1)
}

function warn(message) {
  console.warn(`! ${message}`)
}

function pass(message) {
  console.log(`✓ ${message}`)
}

const root = process.cwd()
const packageJsonPath = join(root, 'package.json')
if (!existsSync(packageJsonPath)) fail('package.json 不存在')

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const version = String(pkg.version || '').trim()
const owner = String(env.GH_UPDATE_OWNER || pkg.config?.auto_update_owner || '').trim()
const repo = String(env.GH_UPDATE_REPO || pkg.config?.auto_update_repo || '').trim()
const provider = String(pkg.config?.auto_update_provider || '').trim()

if (!version) fail('package.json 缺少 version')
if (!/^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`version 格式不合法：${version}`)
}
pass(`版本号有效：${version}`)

if (provider !== 'github') {
  fail(`auto_update_provider 必须为 github，当前为：${provider || '(空)'}`)
}
pass('自动更新 provider 已配置为 github')

if (!owner) fail('缺少 GH_UPDATE_OWNER 或 package.json config.auto_update_owner')
if (!repo) fail('缺少 GH_UPDATE_REPO 或 package.json config.auto_update_repo')
pass(`更新仓库配置有效：${owner}/${repo}`)

const workflowPath = join(root, '.github', 'workflows', 'desktop-release.yml')
if (!existsSync(workflowPath)) {
  fail('缺少 GitHub Actions 发布工作流 .github/workflows/desktop-release.yml')
}
pass('GitHub Actions 发布工作流存在')

const build = pkg.build || {}
const artifactName = build.win?.artifactName || ''
if (!artifactName.includes('${arch}')) {
  fail('win.artifactName 必须包含 ${arch}，否则 x64/arm64 安装包会重名覆盖')
}
pass('Windows 安装包文件名包含架构后缀')

if (!pkg.dependencies?.['electron-updater']) {
  fail('缺少 electron-updater 依赖')
}
pass('electron-updater 依赖已存在')

if (!pkg.dependencies?.['electron-log']) {
  fail('缺少 electron-log 依赖')
}
pass('electron-log 依赖已存在')

if (!existsSync(join(root, 'scripts', 'github-release.mjs'))) {
  fail('缺少 GitHub Releases 发布脚本 scripts/github-release.mjs')
}
pass('发布脚本存在')

if (!existsSync(join(root, 'src', 'main', 'services', 'app-updater-service.ts'))) {
  fail('缺少主进程更新服务 src/main/services/app-updater-service.ts')
}
pass('主进程更新服务存在')

if (!env.GH_TOKEN) {
  warn('当前未设置 GH_TOKEN；本地发布到 GitHub Releases 时会失败，但本地预检和本地打包不受影响')
} else {
  pass('检测到 GH_TOKEN')
}

warn('若是首个正式发布版本，请确认 GitHub Releases 仓库为公开仓库，且 Release 不是 draft')
warn('若要在开发模式验证更新，请设置 ENABLE_DESKTOP_UPDATER_DEV=true')
console.log('\nPreflight checks passed.')
