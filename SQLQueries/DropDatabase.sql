


DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Loop through all tables in the 'public' schema
    -- excluding Prisma's migration history table
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename != '_prisma_migrations'
    ) LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE;';
    END LOOP;
END $$;





-- Clears all auth accounts and cascades to any linked public profiles
TRUNCATE TABLE auth.users CASCADE;