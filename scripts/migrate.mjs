// Applies pending SQL migrations from prisma/migrations-sql/ and then verifies
// that every column in prisma/schema.prisma exists in the database.
//
// Production (Turso) is used when TURSO_DATABASE_URL + TURSO_AUTH_TOKEN are set,
// otherwise the local SQLite file prisma/dev.db.
//
// Runs automatically on Railway before each deploy (railway.json preDeployCommand).
// If a migration or the check fails, the deploy is aborted and the old version keeps running.
//
//   npm run db:migrate            apply pending migrations, then check
//   npm run db:migrate -- --dry   list pending migrations and check, change nothing

import { createClient } from '@libsql/client'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import prismaClient from '@prisma/client'

const { Prisma } = prismaClient
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'prisma', 'migrations-sql')
const dryRun = process.argv.includes('--dry')

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoToken = process.env.TURSO_AUTH_TOKEN
const db = tursoUrl && tursoToken
  ? createClient({ url: tursoUrl, authToken: tursoToken })
  : createClient({ url: 'file:' + join(root, 'prisma', 'dev.db') })

console.log(`[migrate] database: ${tursoUrl && tursoToken ? 'Turso (production)' : 'local prisma/dev.db'}${dryRun ? ' (dry run)' : ''}`)

// Split a migration file into statements. Keep it simple: each statement ends with ';' at end of line.
function statements(sql) {
  return sql
    .split(/;\s*$/m)
    .map((s) => s.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim())
    .filter(Boolean)
}

async function applyMigrations() {
  const tracked = (await db.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_app_migrations'")).rows.length > 0
  if (!tracked && !dryRun) {
    await db.execute(`CREATE TABLE _app_migrations (
      name TEXT PRIMARY KEY,
      appliedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
  }
  const applied = new Set(tracked ? (await db.execute('SELECT name FROM _app_migrations')).rows.map((r) => r.name) : [])
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  const pending = files.filter((f) => !applied.has(f))

  if (pending.length === 0) {
    console.log('[migrate] no pending migrations')
    return
  }

  for (const file of pending) {
    const stmts = statements(readFileSync(join(migrationsDir, file), 'utf8'))
    if (dryRun) {
      console.log(`[migrate] pending: ${file} (${stmts.length} statements)`)
      continue
    }
    console.log(`[migrate] applying ${file} (${stmts.length} statements)`)
    // One transaction per file: either the whole file applies, or none of it does.
    await db.batch(
      [...stmts, { sql: 'INSERT INTO _app_migrations (name) VALUES (?)', args: [file] }],
      'write'
    )
  }
}

async function checkSchema() {
  const problems = []
  for (const model of Prisma.dmmf.datamodel.models) {
    const table = model.dbName || model.name
    const columns = new Set((await db.execute(`PRAGMA table_info("${table}")`)).rows.map((r) => r.name))
    if (columns.size === 0) {
      problems.push(`table "${table}" (model ${model.name}) is missing`)
      continue
    }
    for (const field of model.fields) {
      if (field.kind === 'object') continue
      const column = field.dbName || field.name
      if (!columns.has(column)) problems.push(`column "${table}.${column}" is missing`)
    }
  }
  if (problems.length > 0) {
    console.error('[migrate] schema.prisma expects things the database does not have:')
    for (const p of problems) console.error('  - ' + p)
    console.error('[migrate] add a migration in prisma/migrations-sql/ (see README there)')
    return false
  }
  console.log('[migrate] database matches schema.prisma')
  return true
}

try {
  await applyMigrations()
  const ok = await checkSchema()
  // A dry run only reports; pending migrations are expected to fail the check.
  process.exit(ok || dryRun ? 0 : 1)
} catch (err) {
  console.error('[migrate] failed:', err.message)
  process.exit(1)
}
