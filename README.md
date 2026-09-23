# ScholarBase

A high-performance academic networking platform built with Next.js 16, TypeScript, Prisma, and PostgreSQL (Supabase).

## Architecture

ScholarBase is a research-community platform combining social feed functionality with research infrastructure:

- **Social Feed** - Posts, comments, votes, bookmarks, follows
- **Research Infrastructure** - Journals, supervisors, publications, surveys, PhD admissions, vacancies, events, grants
- **Communication** - Messaging, notifications, push notifications
- **Content** - Blog, research tools, learning resources

### Tech Stack

- **Frontend**: Next.js 16.2.9 (App Router), React 19.2.4, TypeScript 5
- **Backend**: Server Actions, API Routes
- **Database**: PostgreSQL via Prisma 7.9, Supabase
- **Caching/Rate Limiting**: Upstash Redis
- **Queue/Async**: Upstash QStash
- **Media**: Cloudinary
- **Email**: Resend
- **Push Notifications**: Web Push API
- **Analytics**: Vercel Analytics & Speed Insights
- **Validation**: Zod

### Performance Architecture

Key performance optimizations implemented:

1. **Materialized Counters**: `totalVotes`, `totalComments`, `totalBookmarks` stored as static integers
2. **Filtered Selects**: User vote/bookmark state fetched in main query to avoid N+1
3. **Indexed Queries**: Strategic B-Tree indexes on feed ordering, trending, nested comments
4. **Cursor Pagination**: Efficient infinite scroll without offset-based pagination
5. **Optimistic UI**: Instant feedback for votes, follows, bookmarks
6. **Zero-Compute Reads**: Dashboard stats via `pg_class.reltuples` raw SQL

### Database Connection Strategy

- **Production**: Single connection per serverless instance to protect Supabase pool
- **Connection pooling**: `pg` pool with 20s idle timeout, 10s connection timeout
- **SSL**: Configured for production (see `src/lib/db.ts`)

### Background Processing

- **Cron Jobs**: Vercel Serverless Cron with `CRON_SECRET` protection
  - `update-trending`: Recalculate trending scores
  - `trim-maintenance`: Clean up old conversations
  - `cleanup-deadlines`: Remove expired deadlines
  - `trim-soft-deleted-posts`: Purge old soft-deleted content
  - `daily-digest` / `weekly-digest`: Email digests

- **Async Notifications**: QStash for fan-out notification delivery
- **Push Notifications**: Web Push with VAPID keys

### Security Features

- **Authentication**: Supabase Auth + Google OAuth
- **Authorization**: Server-side checks for ownership, admin, frozen/deleted accounts
- **Rate Limiting**: Upstash Redis sliding window (with graceful degradation)
- **Input Validation**: Zod schemas on all server actions and API routes
- **Soft Deletes**: Content preserved with `isDeleted` flag + tombstone pattern
- **Cron Protection**: Timing-safe `CRON_SECRET` comparison

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase recommended)
- Environment variables (see `.env.example`)

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |

### Environment Variables

See `.env.example` for all required variables.

## Deployment

### Vercel (Recommended)

1. Connect repository to Vercel
2. Add all environment variables in Vercel dashboard
3. Deploy

### Manual

```bash
npm run build
npm run start
```

## Database Management

### Migrations

```bash
# Create new migration
npx prisma migrate dev --name <migration_name>

# Apply migrations to production
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

For detailed migration recovery procedures, see [Prisma.md](./Prisma.md).

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── admin/            # Admin dashboard
│   └── ...               # Other page routes
├── components/           # React components
├── lib/                  # Server-side libraries
│   ├── auth.ts          # Authentication utilities
│   ├── db.ts            # Prisma client setup
│   ├── transactions.ts  # Vote/comment transaction logic
│   └── ...
├── actions/             # Server Actions
└── types/              # TypeScript types
```

## Testing

```bash
npm run typecheck
npm run lint
npm run test
```

## License

MIT License - see [LICENSE](./LICENSE) for details.
