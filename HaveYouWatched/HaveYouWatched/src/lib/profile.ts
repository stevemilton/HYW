import { supabase } from './supabase';

export interface UserRating {
  id: string;
  show_id: string;
  show_title: string;
  poster_path: string | null;
  enjoyment: number;
  tags: string[];
  created_at: string;
}

export async function ensureProfile(userId: string, email: string) {
  // Extract username from email (prefix before @)
  const username = email.split('@')[0];

  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      username,
    },
    {
      onConflict: 'id',
    }
  );

  if (error) {
    console.error('Failed to ensure profile:', error);
    // Don't throw - profile creation failure shouldn't block login
  }
}

export interface UserRatingForShow {
  hook: number;
  consistency: number;
  payoff: number;
  heat: number;
  enjoyment: number;
  recommend: boolean;
  tags: string[];
}

export async function getUserRatingForShow(
  userId: string,
  showId: string
): Promise<UserRatingForShow | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select('hook, consistency, payoff, heat, enjoyment, recommend, tags')
    .eq('user_id', userId)
    .eq('show_id', showId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rating found
      return null;
    }
    throw new Error(`Failed to fetch rating: ${error.message}`);
  }

  if (!data) return null;

  return {
    hook: data.hook,
    consistency: data.consistency,
    payoff: data.payoff,
    heat: data.heat,
    enjoyment: data.enjoyment,
    recommend: data.recommend || false,
    tags: data.tags || [],
  };
}

export async function getUserRatings(userId: string): Promise<UserRating[]> {
  const { data: ratings, error } = await supabase
    .from('ratings')
    .select(
      `
      id,
      show_id,
      enjoyment,
      tags,
      created_at,
      shows (
        title,
        poster_path
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch ratings: ${error.message}`);
  }

  if (!ratings) return [];

  return ratings
    .map((rating: any) => {
      const showData = Array.isArray(rating.shows)
        ? rating.shows[0]
        : rating.shows;

      if (!showData) return null;

      return {
        id: rating.id,
        show_id: rating.show_id,
        show_title: showData.title || 'Unknown',
        poster_path: showData.poster_path,
        enjoyment: rating.enjoyment,
        tags: rating.tags || [],
        created_at: rating.created_at,
      };
    })
    .filter((item): item is UserRating => item !== null);
}
