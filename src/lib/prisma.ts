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

  // Log for debugging (remove in production later)
  console.log('Prisma init - TURSO_DATABASE_URL exists:', !!tursoUrl)
  console.log('Prisma init - TURSO_AUTH_TOKEN exists:', !!tursoToken)

  // Use Turso when environment variables are set
  if (tursoUrl && tursoToken) {
    console.log('Prisma init - Using Turso adapter')
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

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
