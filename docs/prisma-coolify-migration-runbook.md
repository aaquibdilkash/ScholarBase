# Local Prisma Migration Deployment Through the SSH Tunnel

Use this procedure to apply committed Prisma migrations to the Supabase PostgreSQL database running inside Coolify.

You will use three terminals. All three are terminals on your laptop; Terminal 1 becomes an SSH session on the server.

- **Laptop Terminal 1 / Server terminal:** SSH into Coolify and find the database container IP.
- **Laptop Terminal 2:** Keep an SSH tunnel open.
- **Laptop Terminal 3:** Run Prisma locally from the ScholarBase repository.

## Before starting

Make sure the migration files are committed and present locally:

```bash
cd ~/Documents/ScholarBase
git status
```

Do not use `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` against the Coolify database.

## Running ScholarBase locally with the Coolify database

The SSH tunnel must be running whenever the local Next.js app accesses the remote database. Use three laptop terminals.

### Laptop Terminal 1: SSH server terminal

```bash
ssh -i ~/.ssh/scholarbase_oracle ubuntu@100.114.43.64
```

After login, run this on the server:

```bash
sudo docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{"\n"}}{{end}}' \
  supabase-db-1gzzigqz5jnyp8nsmjxzcauc
```

Copy the IP address it prints.

### Laptop Terminal 2: SSH tunnel

Run this on your laptop, replacing `DB_CONTAINER_IP` with the copied IP:

```bash
ssh -N \
  -o ExitOnForwardFailure=yes \
  -i ~/.ssh/scholarbase_oracle \
  -L 15432:DB_CONTAINER_IP:5432 \
  ubuntu@100.114.43.64
```

Example:

```bash
ssh -N \
  -o ExitOnForwardFailure=yes \
  -i ~/.ssh/scholarbase_oracle \
  -L 15432:10.0.3.6:5432 \
  ubuntu@100.114.43.64
```

Leave this terminal running. If it exits or is closed, the local app cannot reach the database.

### Laptop Terminal 3: start Next.js

Run this in the local ScholarBase folder, not in the SSH terminal:

```bash
cd ~/Documents/ScholarBase
export DATABASE_URL='postgresql://postgres:DB_PASSWORD@127.0.0.1:15432/postgres'
export DIRECT_URL='postgresql://postgres:DB_PASSWORD@127.0.0.1:15432/postgres'
npm run dev
```

Both variables are needed:

- `DATABASE_URL` is used by the running website.
- `DIRECT_URL` is used by Prisma CLI commands.

If these values are already in `.env`, the exports override them for this terminal session. Restart `npm run dev` after changing them.

Open the website at `http://localhost:3000`.

If the app shows `Can't reach database server at 127.0.0.1:15432`, Terminal 2 is not running, the tunnel uses the wrong database IP, or the app was started before the variables were set.

## Laptop Terminal 1: SSH into Coolify

Run this on your laptop terminal:

```bash
ssh -i ~/.ssh/scholarbase_oracle ubuntu@100.114.43.64
```

After SSH login, you are now typing in the server terminal. Find the current database container IP:

```bash
sudo docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{"\n"}}{{end}}' \
  supabase-db-1gzzigqz5jnyp8nsmjxzcauc
```

Copy the IP address it prints. It may change after a Supabase restart. In the previous deployment it was `10.0.3.6`.

Leave this SSH/server terminal open.

## Laptop Terminal 2: Start the database tunnel

Open a second terminal on your laptop. Replace `DB_CONTAINER_IP` with the IP from the server terminal:

```bash
ssh -N \
  -o ExitOnForwardFailure=yes \
  -i ~/.ssh/scholarbase_oracle \
  -L 15432:DB_CONTAINER_IP:5432 \
  ubuntu@100.114.43.64
```

Example:

```bash
ssh -N \
  -o ExitOnForwardFailure=yes \
  -i ~/.ssh/scholarbase_oracle \
  -L 15432:10.0.3.6:5432 \
  ubuntu@100.114.43.64
```

Keep this terminal running. It will appear to be waiting; that is expected.

If you see `Address already in use`, use another local port, such as `15433`:

```bash
ssh -N \
  -o ExitOnForwardFailure=yes \
  -i ~/.ssh/scholarbase_oracle \
  -L 15433:DB_CONTAINER_IP:5432 \
  ubuntu@100.114.43.64
```

Use the same port in `DIRECT_URL` in the next step.

## Laptop Terminal 3: Run Prisma locally

Open a third terminal on your laptop. Do not run these commands in the SSH/server terminal:

```bash
cd ~/Documents/ScholarBase
```

Set `DIRECT_URL` to the local end of the tunnel. Replace `DB_PASSWORD` with the database password, but do not paste the password into chat or commit it:

```bash
export DIRECT_URL='postgresql://postgres:DB_PASSWORD@127.0.0.1:15432/postgres'
```

If you used port `15433`, use:

```bash
export DIRECT_URL='postgresql://postgres:DB_PASSWORD@127.0.0.1:15433/postgres'
```

The shell variable temporarily overrides the `DIRECT_URL` in `.env`. Do not change the Coolify production URL to `127.0.0.1`; that address is only for this local tunnel.

## Check migration status

Always check status first:

```bash
npx prisma migrate status
```

For a normal update, this lists only the new migrations that have not been applied yet.

## Apply the migrations

Run:

```bash
npx prisma migrate deploy
```

Prisma will apply the committed pending migrations without resetting the database.

Then verify:

```bash
npx prisma migrate status
```

Expected result:

```text
Database schema is up to date!
```

Keep Terminal 2 open until this verification finishes. Press `Ctrl+C` in Terminal 2 when you are done.

## If this is a completely empty database

The first deployment may show all migrations as pending, including `0_init`. Only apply all migrations if the database is genuinely empty. The safe command is still:

```bash
npx prisma migrate deploy
```

Never use `migrate reset` to initialize the production database.

## Common errors

### `P1001: Can't reach database server`

Check that:

1. Terminal 2 is still running.
2. `DIRECT_URL` uses `127.0.0.1:15432` or your replacement local port.
3. The database container IP was copied correctly.
4. The database container is still running.

### `EAI_AGAIN` or `getaddrinfo`

You are probably using the internal Docker hostname from your laptop. For local Prisma commands, use:

```text
127.0.0.1:15432
```

### `P3018`, “relation already exists”, or “type already exists”

Stop and do not retry blindly. This means Prisma is trying to apply a migration whose database objects may already exist. Check the database state before using `prisma migrate resolve`.

### Port forwarding error

If port `15432` is occupied, use `15433` in both the SSH tunnel and `DIRECT_URL`.

## Security

- Do not commit `.env`.
- Do not paste database passwords into chat or logs.
- Rotate the PostgreSQL password if it has been exposed.
- Keep the SSH tunnel open only while running the migration.
