# Database migrations

The production database (Turso) was created by hand, not by Prisma, so **do not run
`prisma db push` or `prisma migrate` against production** — they would rebuild every table.

Instead, database changes are small SQL files in this folder. They are applied
automatically on Railway before each deploy by `scripts/migrate.mjs`, which also checks
that every column in `schema.prisma` exists. If either step fails, the deploy is
aborted and the previous version keeps running.

## Making a database change

1. Edit `prisma/schema.prisma` (e.g. add a field).
2. Add a new file here, numbered after the last one, e.g. `002_add_session_location.sql`:

   ```sql
   ALTER TABLE sessions ADD COLUMN location TEXT;
   ```

3. Apply it to your local database and test:

   ```bash
   npm run db:migrate
   npm run dev
   ```

4. Commit both files and push to `main`. Railway applies the migration, then deploys.

## Rules

- **Only add, never remove or rename.** Add tables and columns; leave old ones in place.
  Dropping or rewriting a table loses data.
- A new column must be nullable or have a `DEFAULT` (SQLite requires it for `ADD COLUMN`).
  Use `TEXT` for dates and `INTEGER` for booleans, matching the existing tables.
- End each statement with `;` at the end of a line. Each file runs as one transaction.
- Never edit a file that has already been deployed — add a new one instead.
- Preview what would run against production without changing anything:

  ```bash
  railway run npm run db:migrate -- --dry
  ```
