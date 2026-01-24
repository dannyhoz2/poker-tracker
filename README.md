# Poker Night Tracker

A real-time session management and statistics app for home poker groups.

## Features

- **Session Management**: Start, manage, and close poker sessions in real-time
- **Real-Time Updates**: All participants can view the current game state (polling every 3 seconds)
- **Fixed Buy-ins**: $10 per buy-in with easy one-tap recording
- **Cash-out Tracking**: Record when players leave with automatic balance validation
- **Statistics Dashboard**: Interactive graphs showing YTD earnings, win rates, attendance, and more
- **Leaderboards**: Track who's winning across sessions
- **User Management**: Invitation-only registration system
- **Mobile-First Design**: Responsive UI optimized for smartphone use during games
- **Dark Mode**: Built-in dark theme for comfortable viewing

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **State Management**: Zustand
- **Authentication**: JWT with HTTP-only cookies

## Getting Started

### Prerequisites

- Node.js 18.17.0 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
cd poker-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
npm run db:push
npm run db:generate
```

4. (Optional) Seed the database with test users:
```bash
npm run db:seed
```

This creates test accounts:
- Admin: `admin@poker.local` / `admin123`
- Players: `john@poker.local`, `jane@poker.local`, `mike@poker.local`, `sarah@poker.local` / `player123`

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## First-Time Setup

When you first access the app without seeded data:
1. The first user to register becomes the Admin
2. Admins can invite new players via the Admin panel
3. Players register using invitation links

## Usage

### Starting a Session
1. Click "Start New Session" on the dashboard
2. Add players who are present from the user directory
3. Players start with one $10 buy-in

### During a Session
- **Add Buy-in**: Click "+$10" to record additional buy-ins
- **Cash Out**: Enter the cash-out amount when a player leaves
- Only the session host can make changes
- All players see real-time updates

### Closing a Session
- All players must cash out
- Buy-ins must equal cash-outs (balanced books)
- Click "Close Session" to finalize

### Viewing Statistics
- View YTD earnings leaderboard
- Track cumulative earnings over time
- See win rates and attendance percentages
- Compare player performance

## Project Structure

```
poker-tracker/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed script
├── src/
│   ├── app/
│   │   ├── (auth)/        # Login/Register pages
│   │   ├── (dashboard)/   # Protected pages
│   │   └── api/           # API routes
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions
│   └── types/             # TypeScript types
└── ...
```

## Environment Variables

Create a `.env` file with:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key-here"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Push schema to database
- `npm run db:generate` - Generate Prisma client
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with test data

## License

ISC
