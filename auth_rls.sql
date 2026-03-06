-- =============================================
-- Auth + Roles + RLS migration for ticketing app
-- Run this in Supabase -> SQL Editor
-- =============================================

-- 1) Role enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'admin');
  END IF;
END $$;

-- 2) Profiles table (links to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role user_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2b) Trigger: auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'::user_role
      ELSE 'user'::user_role
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Profiles policies: user can manage own profile; admin can read all
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_upsert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_read_all" ON public.profiles;

CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "profiles_upsert_own"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Update own profile (name, etc.)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3) Ticket ownership columns
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

-- 4) Helper: is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 5) Tighten tickets RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Drop old wide policies if they exist
DROP POLICY IF EXISTS "Allow read access" ON public.tickets;
DROP POLICY IF EXISTS "Allow insert access" ON public.tickets;
DROP POLICY IF EXISTS "Allow update access" ON public.tickets;

DROP POLICY IF EXISTS "tickets_select_own_or_admin" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert_own_or_admin" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update_admin_only" ON public.tickets;

-- Users: see own tickets; Admin: see all
CREATE POLICY "tickets_select_own_or_admin"
ON public.tickets FOR SELECT
USING (public.is_admin() OR created_by = auth.uid());

-- Users: can insert only with their own created_by; Admin can insert too
CREATE POLICY "tickets_insert_own_or_admin"
ON public.tickets FOR INSERT
WITH CHECK (public.is_admin() OR created_by = auth.uid());

-- Admin: can update (status, assigned_to, etc.)
CREATE POLICY "tickets_update_admin_only"
ON public.tickets FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Optional: allow admin to delete (comment if you don't want)
DROP POLICY IF EXISTS "tickets_delete_admin_only" ON public.tickets;
CREATE POLICY "tickets_delete_admin_only"
ON public.tickets FOR DELETE
USING (public.is_admin());

-- Notes:
-- - To make an admin, set role='admin' for that user's row in public.profiles.
-- - If Email confirmations are enabled, users must confirm before session is active.

-- 6) Storage Bucket for ticket images
-- Run this separately in Supabase SQL Editor after creating bucket in Storage UI:
-- 1. Go to Supabase -> Storage
-- 2. Create new bucket named: ticket_images
-- 3. Make it PUBLIC
-- 4. Then run this SQL:

-- Create storage policy for public read
CREATE POLICY "Public Read"
ON storage.objects FOR SELECT
USING (bucket_id = 'ticket_images');

-- Users can upload to their own folder
CREATE POLICY "Users can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ticket_images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own images
CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'ticket_images' AND
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'ticket_images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ticket_images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

