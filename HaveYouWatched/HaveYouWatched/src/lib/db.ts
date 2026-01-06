import { supabase } from './supabase';

export interface ShowData {
  id: string; // tmdb_id as string
  title: string;
  poster_path: string | null;
  overview: string;
  first_air_date: string | null;
}

export interface RatingData {
  user_id: string;
  show_id: string;
  hook: number;
  consistency: number;
  payoff: number;
  heat: number;
  enjoyment: number;
  recommend: boolean;
  tags: string[];
}

export async function upsertShow(show: ShowData) {
  const { error } = await supabase.from('shows').upsert(show, {
    onConflict: 'id',
  });

  if (error) {
    throw new Error(`Failed to save show: ${error.message}`);
  }
}

export async function upsertRating(rating: RatingData) {
  // user_id should already be set in rating object from caller
  const { error } = await supabase.from('ratings').upsert(rating, {
    onConflict: 'user_id,show_id',
  });

  if (error) {
    throw new Error(`Failed to save rating: ${error.message}`);
  }
}

