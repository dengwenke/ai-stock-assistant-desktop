#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { env, exit } from 'node:process'

const mode = process.argv[2] || 'local'
const publishMode = mode === 'publish' ? 'always' : 'never'
const owner = env.GH_UPDATE_OWNER || env.GITHUB_REPOSITORY_OWNER
const repo = env.GH_UPDATE_REPO || (env.GITHUB_REPOSITORY ? env.GITHUB_REPOSITORY.split('/')[1] : '')

if (!owner || !repo) {
  console.error('Missing GH_UPDATE_OWNER / GH_UPDATE_REPO (or GITHUB_REPOSITORY metadata).')
  exit(1)
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...env,
        ELECTRON_MIRROR: env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
        ELECTRON_BUILDER_BINARIES_MIRROR:
          env.ELECTRON_BUILDER_BINARIES_MIRROR || 'https://npmmirror.com/mirrors/electron-builder-binaries/',
      },
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`))
    })
  })
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'

const builderArgs = [
  'electron-builder',
  '--win',
  'nsis',
  '--x64',
  '--arm64',
  '--publish',
  publishMode,
  '-c.publish.provider=github',
  `-c.publish.owner=${owner}`,
  `-c.publish.repo=${repo}`,
  '-c.publish.releaseType=release',
  '-c.generateUpdatesFilesForAllChannels=true',
  '-c.extraMetadata.config.auto_update_provider=github',
  `-c.extraMetadata.config.auto_update_owner=${owner}`,
  `-c.extraMetadata.config.auto_update_repo=${repo}`,
]

try {
  await run(npmCommand, ['run', 'build'])
  await run(npxCommand, builderArgs)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  exit(1)
}
