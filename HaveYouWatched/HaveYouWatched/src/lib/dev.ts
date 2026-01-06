// DEV: Development mode configuration
export const DEV_MODE = true; // Set to false to enable authentication

// DEV: Temporary user ID for local development (auth bypassed)
export const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

// Helper function to get current user ID (uses DEV_USER_ID if DEV_MODE is true)
export async function getCurrentUserId(): Promise<string> {
  if (DEV_MODE) {
    return DEV_USER_ID;
  }

  const { supabase } = await import('./supabase');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.id;
}
