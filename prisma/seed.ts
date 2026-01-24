import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PIGGY_BANK_USER_ID = 'piggy-bank'

async function main() {
  // Create piggy bank virtual user (required for tracking piggy bank contributions)
  const piggyBankPassword = await bcrypt.hash('not-a-real-password-' + Date.now(), 12)

  // Use upsert with the specific ID for piggy bank
  await prisma.user.upsert({
    where: { id: PIGGY_BANK_USER_ID },
    update: {},
    create: {
      id: PIGGY_BANK_USER_ID,
      email: 'piggy-bank@system.local',
      name: 'Piggy Bank',
      passwordHash: piggyBankPassword,
      role: 'PLAYER',
      playerType: 'PIGGY_BANK',
      isActive: false,
    },
  })

  console.log('Created piggy bank user')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@poker.local' },
    update: {},
    create: {
      email: 'admin@poker.local',
      name: 'Admin',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  })

  console.log('Created admin user:', admin.email)

  // Create some player users
  const playerPassword = await bcrypt.hash('player123', 12)

  const players = [
    { email: 'john@poker.local', name: 'John' },
    { email: 'jane@poker.local', name: 'Jane' },
    { email: 'mike@poker.local', name: 'Mike' },
    { email: 'sarah@poker.local', name: 'Sarah' },
  ]

  for (const player of players) {
    const user = await prisma.user.upsert({
      where: { email: player.email },
      update: {},
      create: {
        email: player.email,
        name: player.name,
        passwordHash: playerPassword,
        role: 'PLAYER',
      },
    })
    console.log('Created player:', user.email)
  }

  console.log('\nSeed completed!')
  console.log('\nTest credentials:')
  console.log('Admin: admin@poker.local / admin123')
  console.log('Players: john@poker.local (or jane, mike, sarah) / player123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
