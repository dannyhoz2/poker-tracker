import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

// Set a dummy DATABASE_URL if not set (required for Prisma validation even with adapters)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./placeholder.db'
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN
  const isProduction = process.env.NODE_ENV === 'production'

  console.log('Prisma init - NODE_ENV:', process.env.NODE_ENV)
  console.log('Prisma init - TURSO_DATABASE_URL exists:', !!tursoUrl)
  console.log('Prisma init - TURSO_AUTH_TOKEN exists:', !!tursoToken)

  // In production, always try to use Turso
  if (isProduction || (tursoUrl && tursoToken)) {
    if (!tursoUrl || !tursoToken) {
      console.error('Prisma init - Production mode but Turso credentials missing!')
      console.error('TURSO_DATABASE_URL:', tursoUrl ? 'SET' : 'NOT SET')
      console.error('TURSO_AUTH_TOKEN:', tursoToken ? 'SET' : 'NOT SET')
      throw new Error('Turso credentials required in production')
    }

    console.log('Prisma init - Using Turso adapter with URL:', tursoUrl.substring(0, 30) + '...')
    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }

  // Use regular SQLite for local development
  console.log('Prisma init - Using local SQLite')
  return new PrismaClient()
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// Cache in development only
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
