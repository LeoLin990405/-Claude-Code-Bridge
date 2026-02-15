# Database Testing Guide

Complete guide for testing the PostgreSQL database integration.

## Prerequisites

- Docker installed and running
- Node.js and npm installed
- PostgreSQL client (optional, for manual inspection)

## Quick Start

### 1. Start Database Services

```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Wait for services to be ready (15-20 seconds)
sleep 15

# Check service status
docker compose ps
```

Expected output:
```
NAME                STATUS              PORTS
postgres            running             0.0.0.0:5432->5432/tcp
redis               running             0.0.0.0:6379->6379/tcp
```

### 2. Apply Database Schema

```bash
# Push schema to database (development)
npm run db:push

# OR generate and apply migration (production)
npm run db:generate
npm run db:migrate
```

### 3. Run Health Check

```bash
npm run db:check
```

Expected output:
```
🔍 Checking database connection...

✅ Connection successful

📦 PostgreSQL Version:
PostgreSQL 16.x

🗄️  Current Database: hivemind

📋 Tables (18):
  - channel_messages
  - channels
  - conversations
  - cron_executions
  - cron_jobs
  - mcp_servers
  - messages
  - models
  - providers
  - refresh_tokens
  - skill_logs
  - skills
  - team_tasks
  - teams
  - users

💾 Table Sizes (Top 10):
  - users: 8192 bytes
  - messages: 8192 bytes
  ...

🔌 Connection Pool:
  - Total connections: 0
  - Idle connections: 0
  - Waiting requests: 0

✅ Database health check passed!
```

### 4. Seed Development Data

```bash
npm run db:seed
```

Expected output:
```
🌱 Seeding database...

👥 Creating users...
  ✅ Users created

🔌 Creating AI providers...
  ✅ Providers created

🤖 Creating AI models...
  ✅ Models created

💬 Creating sample conversations...
  ✅ Sample conversation created

✅ Database seeding completed!

📝 Default credentials:
  Admin: admin@hivemind.local / password123
  Demo:  demo@hivemind.local / password123
```

## API Testing

### 1. Test Authentication Endpoints

#### Register User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "displayName": "Test User"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "abc123...",
    "expiresIn": 900,
    "user": {
      "id": "uuid-here",
      "username": "testuser",
      "email": "test@example.com",
      "role": "user",
      "displayName": "Test User"
    }
  }
}
```

#### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin@hivemind.local",
    "password": "password123"
  }'
```

Save the `accessToken` for subsequent requests.

#### Get Current User

```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 2. Test Conversation Endpoints

#### Create Conversation

```bash
curl -X POST http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Conversation",
    "platform": "hivemind",
    "model": "claude-sonnet-4.5",
    "systemPrompt": "You are a helpful assistant"
  }'
```

#### List Conversations

```bash
curl "http://localhost:3000/api/v1/conversations?page=1&pageSize=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Send Message

```bash
curl -X POST http://localhost:3000/api/v1/conversations/CONVERSATION_ID/messages \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "user",
    "content": "Hello, how are you?"
  }'
```

#### Get Messages

```bash
curl http://localhost:3000/api/v1/conversations/CONVERSATION_ID/messages \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. Test Model Endpoints

#### List Models

```bash
curl http://localhost:3000/api/v1/models \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Get Model Details

```bash
curl http://localhost:3000/api/v1/models/MODEL_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Manual Database Inspection

### Using psql

```bash
# Connect to database
docker compose exec postgres psql -U hivemind -d hivemind

# List tables
\dt

# Describe table structure
\d users

# Query users
SELECT id, username, email, role, created_at FROM users;

# Query conversations
SELECT c.id, c.name, u.username, c.message_count, c.created_at
FROM conversations c
JOIN users u ON c.user_id = u.id;

# Query messages
SELECT m.id, m.role, LEFT(m.content, 50) as content_preview, m.created_at
FROM messages m
WHERE conversation_id = 'YOUR_CONVERSATION_ID'
ORDER BY m.created_at;

# Exit
\q
```

### Using Drizzle Studio

```bash
# Start Drizzle Studio (web-based GUI)
npm run db:studio
```

Opens at `https://local.drizzle.studio`

Features:
- Browse tables and data
- Edit records
- Run custom queries
- Visual schema explorer

## Connection Testing

### Test Connection Pool

```typescript
// scripts/test-connection.ts
import { db, pool } from './src/database/db';
import { users } from './src/database/schema';

async function testConnection() {
  try {
    // Test query
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users`);

    // Check pool stats
    console.log('Pool stats:', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    });

    await pool.end();
  } catch (error) {
    console.error('Connection test failed:', error);
    process.exit(1);
  }
}

testConnection();
```

Run:
```bash
npx ts-node scripts/test-connection.ts
```

## Performance Testing

### Benchmark Query Performance

```bash
# Install pgbench (if not already installed)
# macOS: brew install postgresql

# Initialize test data
docker compose exec postgres pgbench -i -U hivemind hivemind

# Run benchmark (10 clients, 1000 transactions)
docker compose exec postgres pgbench -c 10 -t 1000 -U hivemind hivemind
```

### Monitor Slow Queries

```sql
-- Enable query logging
ALTER DATABASE hivemind SET log_min_duration_statement = 1000; -- Log queries > 1s

-- View slow queries (in PostgreSQL logs)
docker compose logs postgres | grep "duration:"
```

## Troubleshooting

### Database Connection Failed

**Error**: `ECONNREFUSED` or timeout

**Solution**:
```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check logs
docker compose logs postgres

# Restart service
docker compose restart postgres
```

### Migration Failed

**Error**: `relation already exists`

**Solution**:
```bash
# Drop all tables and re-migrate
npm run db:drop
npm run db:push
```

### Schema Out of Sync

**Error**: Schema doesn't match database

**Solution**:
```bash
# Development: Force push schema
npm run db:push

# Production: Generate and apply migration
npm run db:generate
npm run db:migrate
```

### Seed Script Fails

**Error**: Duplicate key violation

**Solution**:
```bash
# Drop and recreate database
docker compose down -v
docker compose up -d postgres redis
sleep 15
npm run db:push
npm run db:seed
```

### Connection Pool Exhausted

**Error**: `sorry, too many clients already`

**Solution**:
1. Check connection pool settings in `src/database/db.ts`
2. Ensure connections are properly closed
3. Increase pool size if needed:

```typescript
export const pool = new Pool({
  connectionString,
  max: 30, // Increase from 20
});
```

## Testing Checklist

- [ ] Docker services start successfully
- [ ] Database health check passes
- [ ] Seed script completes without errors
- [ ] Can register new user
- [ ] Can login with credentials
- [ ] JWT token authentication works
- [ ] Can create conversation
- [ ] Can send and retrieve messages
- [ ] Can list models and providers
- [ ] Connection pool stats are normal
- [ ] Drizzle Studio opens and displays data

## Cleanup

```bash
# Stop services
docker compose down

# Remove volumes (deletes all data)
docker compose down -v

# Remove images (if needed)
docker rmi postgres:16-alpine redis:7-alpine
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Database Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: hivemind_test
          POSTGRES_USER: hivemind
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://hivemind:test_password@localhost:5432/hivemind_test
        run: npm run db:push

      - name: Run tests
        run: npm test
```

## Next Steps

1. Implement automated API tests with Jest/Supertest
2. Add database backup/restore scripts
3. Set up monitoring with pg_stat_statements
4. Configure connection pooling for production (PgBouncer)
5. Implement database replication for high availability
