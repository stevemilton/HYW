-- DEV MODE RLS Policies
-- Run these SQL commands in your Supabase SQL Editor to allow DEV_MODE to work
-- These policies allow both authenticated users AND anon role (for DEV_MODE)

-- Enable RLS on shows table (if not already enabled)
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (optional - will error if they don't exist)
DROP POLICY IF EXISTS "Users can read all shows" ON shows;
DROP POLICY IF EXISTS "Users can insert shows" ON shows;
DROP POLICY IF EXISTS "Users can update shows" ON shows;
DROP POLICY IF EXISTS "Dev mode: anon can read shows" ON shows;
DROP POLICY IF EXISTS "Dev mode: anon can insert shows" ON shows;
DROP POLICY IF EXISTS "Dev mode: anon can update shows" ON shows;

-- SELECT: Allow authenticated users AND anon (for DEV_MODE) to read all shows
CREATE POLICY "Users can read all shows"
ON shows FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Dev mode: anon can read shows"
ON shows FOR SELECT
TO anon
USING (true);

-- INSERT: Allow authenticated users AND anon (for DEV_MODE) to insert shows
CREATE POLICY "Users can insert shows"
ON shows FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Dev mode: anon can insert shows"
ON shows FOR INSERT
TO anon
WITH CHECK (true);

-- UPDATE: Allow authenticated users AND anon (for DEV_MODE) to update shows
CREATE POLICY "Users can update shows"
ON shows FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Dev mode: anon can update shows"
ON shows FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Same for ratings table
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all ratings" ON ratings;
DROP POLICY IF EXISTS "Users can insert their own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can update their own ratings" ON ratings;
DROP POLICY IF EXISTS "Dev mode: anon can read ratings" ON ratings;
DROP POLICY IF EXISTS "Dev mode: anon can insert ratings" ON ratings;
DROP POLICY IF EXISTS "Dev mode: anon can update ratings" ON ratings;

CREATE POLICY "Users can read all ratings"
ON ratings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Dev mode: anon can read ratings"
ON ratings FOR SELECT
TO anon
USING (true);

CREATE POLICY "Users can insert their own ratings"
ON ratings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Dev mode: anon can insert ratings"
ON ratings FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Users can update their own ratings"
ON ratings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Dev mode: anon can update ratings"
ON ratings FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Same for profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can upsert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Dev mode: anon can read profiles" ON profiles;
DROP POLICY IF EXISTS "Dev mode: anon can upsert profiles" ON profiles;

CREATE POLICY "Users can read all profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Dev mode: anon can read profiles"
ON profiles FOR SELECT
TO anon
USING (true);

CREATE POLICY "Users can upsert their own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Dev mode: anon can upsert profiles"
ON profiles FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Dev mode: anon can update profiles"
ON profiles FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Same for follows table
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all follows" ON follows;
DROP POLICY IF EXISTS "Users can insert their own follows" ON follows;
DROP POLICY IF EXISTS "Users can update their own follows" ON follows;
DROP POLICY IF EXISTS "Dev mode: anon can read follows" ON follows;
DROP POLICY IF EXISTS "Dev mode: anon can insert follows" ON follows;
DROP POLICY IF EXISTS "Dev mode: anon can update follows" ON follows;

CREATE POLICY "Users can read all follows"
ON follows FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Dev mode: anon can read follows"
ON follows FOR SELECT
TO anon
USING (true);

CREATE POLICY "Users can insert their own follows"
ON follows FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Dev mode: anon can insert follows"
ON follows FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Users can update their own follows"
ON follows FOR UPDATE
TO authenticated
USING (auth.uid() = follower_id)
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Dev mode: anon can update follows"
ON follows FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

