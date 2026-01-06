# Required RLS Policies for Supabase

## Overview
The app requires the following Row Level Security (RLS) policies to function correctly with authenticated users.

## Tables and Required Policies

### 1. `profiles` table
**Purpose**: Store user profile information (id, username)

**Policies needed**:
- **SELECT**: Allow all authenticated users to read all profiles
  ```sql
  CREATE POLICY "Users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);
  ```

- **INSERT/UPDATE**: Allow users to create/update their own profile
  ```sql
  CREATE POLICY "Users can upsert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

  CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
  ```

### 2. `shows` table
**Purpose**: Store TMDB show data

**Policies needed**:
- **SELECT**: Allow all authenticated users to read all shows
  ```sql
  CREATE POLICY "Users can read all shows"
  ON shows FOR SELECT
  TO authenticated
  USING (true);
  ```

- **INSERT/UPDATE**: Allow all authenticated users to insert/update shows
  ```sql
  CREATE POLICY "Users can insert shows"
  ON shows FOR INSERT
  TO authenticated
  WITH CHECK (true);

  CREATE POLICY "Users can update shows"
  ON shows FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
  ```

### 3. `ratings` table
**Purpose**: Store user ratings for shows

**Policies needed**:
- **SELECT**: Allow all authenticated users to read all ratings
  ```sql
  CREATE POLICY "Users can read all ratings"
  ON ratings FOR SELECT
  TO authenticated
  USING (true);
  ```

- **INSERT/UPDATE**: Allow users to insert/update only their own ratings
  ```sql
  CREATE POLICY "Users can insert their own ratings"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can update their own ratings"
  ON ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
  ```

### 4. `follows` table
**Purpose**: Store user follow relationships

**Policies needed**:
- **SELECT**: Allow all authenticated users to read all follows
  ```sql
  CREATE POLICY "Users can read all follows"
  ON follows FOR SELECT
  TO authenticated
  USING (true);
  ```

- **INSERT/UPDATE**: Allow users to insert/update only their own follows (as follower_id)
  ```sql
  CREATE POLICY "Users can insert their own follows"
  ON follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

  CREATE POLICY "Users can update their own follows"
  ON follows FOR UPDATE
  TO authenticated
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);
  ```

### 5. `computed_taste` table (optional)
**Purpose**: Store pre-computed user similarity scores

**Policies needed** (if table exists):
- **SELECT**: Allow users to read their own taste similarities
  ```sql
  CREATE POLICY "Users can read their own taste similarities"
  ON computed_taste FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);
  ```

## Important Notes

1. **Enable RLS**: Make sure RLS is enabled on all tables:
   ```sql
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
   ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
   -- If computed_taste exists:
   ALTER TABLE computed_taste ENABLE ROW LEVEL SECURITY;
   ```

2. **Foreign Key Constraints**: Ensure foreign keys are properly set up:
   - `ratings.user_id` → `profiles.id`
   - `ratings.show_id` → `shows.id`
   - `follows.follower_id` → `profiles.id`
   - `follows.followed_id` → `profiles.id`

3. **Unique Constraints**: Ensure unique constraints exist:
   - `ratings(user_id, show_id)` - one rating per user per show
   - `follows(follower_id, followed_id)` - one follow relationship per pair

4. **Indexes**: Consider adding indexes for performance:
   - `ratings(user_id, created_at)` - for feed queries
   - `follows(follower_id)` - for following activity queries
   - `ratings(show_id)` - for show recommendations

## Testing
After setting up policies, test that:
- Users can read all profiles, shows, and ratings
- Users can only create/update their own ratings and follows
- Users can create/update any show (since shows are shared data)
- Profile creation happens automatically on login

