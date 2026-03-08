import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import type { SeedPackageManifest } from '@shared/desktop-api'
import { MarketDatabase } from './market-database'
import { MarketRepository } from './market-repository'

export class SeedImportService {
  constructor(
    private readonly database: MarketDatabase,
    private readonly repository: MarketRepository,
  ) {}

  async importFromPath(inputPath: string): Promise<{ imported: boolean; message: string }> {
    const marketDb = this.database.getMarketDb()
    const { marketDbPath, intradayDbPath } = this.database.getPaths()
    const manifest = this.tryReadManifest(inputPath)

    try {
      marketDb.exec('PRAGMA wal_checkpoint(FULL);')
      const sourceDir = extname(inputPath) === '.json' ? dirname(inputPath) : inputPath
      const sourceMarketDb = extname(inputPath) === '.db' ? inputPath : join(sourceDir, 'market.db')
      const sourceIntradayDb = join(sourceDir, 'intraday.db')

      if (!existsSync(sourceMarketDb)) {
        throw new Error('未找到 market.db，导入包不完整')
      }

      this.database.close()
      copyFileSync(sourceMarketDb, marketDbPath)
      if (existsSync(sourceIntradayDb)) {
        copyFileSync(sourceIntradayDb, intradayDbPath)
      }
      this.database.initialize()
      this.repository.recordImport(inputPath, 'SUCCESS', manifest ? JSON.stringify(manifest) : null, '导入成功')
      return {
        imported: true,
        message: `导入完成：${basename(sourceMarketDb)}`,
      }
    } catch (error) {
      this.database.initialize()
      const message = error instanceof Error ? error.message : String(error)
      this.repository.recordImport(inputPath, 'FAILED', manifest ? JSON.stringify(manifest) : null, message)
      return {
        imported: false,
        message,
      }
    }
  }

  private tryReadManifest(inputPath: string): SeedPackageManifest | null {
    const targetPath = extname(inputPath) === '.json' ? inputPath : join(inputPath, 'manifest.json')
    if (!existsSync(targetPath)) return null
    try {
      return JSON.parse(readFileSync(targetPath, 'utf-8')) as SeedPackageManifest
    } catch {
      return null
    }
  }
}
