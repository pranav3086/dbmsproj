// Locates the MySQL Server installation and the project's private data directory.
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const root = resolve(import.meta.dirname, '..', '..')
export const mysqlHome = join(root, '.mysql')
export const dataDir = join(mysqlHome, 'data')
export const iniFile = join(mysqlHome, 'my.ini')

/** Newest "MySQL Server x.y" under Program Files, unless MYSQL_BIN points somewhere else. */
export function mysqlBin() {
  if (process.env.MYSQL_BIN) return process.env.MYSQL_BIN
  const base = 'C:/Program Files/MySQL'
  if (!existsSync(base)) throw new Error('MySQL Server is not installed. Install it, or set MYSQL_BIN to its bin folder.')
  const versions = readdirSync(base)
    .filter((d) => /^MySQL Server \d+\.\d+$/.test(d) && existsSync(join(base, d, 'bin', 'mysqld.exe')))
    .sort((a, b) => parseFloat(b.split(' ').pop()) - parseFloat(a.split(' ').pop()))
  if (!versions.length) throw new Error('No MySQL Server with mysqld.exe found under C:/Program Files/MySQL.')
  return join(base, versions[0], 'bin')
}

export const exe = (name) => join(mysqlBin(), process.platform === 'win32' ? `${name}.exe` : name)
