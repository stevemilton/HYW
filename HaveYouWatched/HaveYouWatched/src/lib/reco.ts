import { supabase } from './supabase';

export interface Rating {
  user_id: string;
  show_id: string;
  enjoyment: number;
  hook?: number;
  consistency?: number;
  payoff?: number;
  heat?: number;
  tags?: string[];
  created_at: string;
}

export interface Profile {
  id: string;
  username: string;
}

export interface Follow {
  follower_id: string;
  followee_id: string;
}

export interface Show {
  id: string;
  title: string;
  poster_path: string | null;
}

export interface UserSimilarity {
  user_id: string;
  similarity: number;
}

export interface ShowRecommendation {
  show_id: string;
  title: string;
  poster_path: string | null;
  score: number;
  explanation: string;
  tags?: string[];
}

export type DeckMode = 'tonight' | 'this_weekend';

/**
 * Calculate similarity between two users based on shared ratings
 */
export function calculateSimilarity(
  userRatings: Map<string, number>,
  otherRatings: Map<string, number>
): number {
  const sharedShows = Array.from(userRatings.keys()).filter((showId) =>
    otherRatings.has(showId)
  );

  if (sharedShows.length < 3) {
    return 0.3;
  }

  let totalDiff = 0;
  sharedShows.forEach((showId) => {
    const userEnjoyment = userRatings.get(showId)!;
    const otherEnjoyment = otherRatings.get(showId)!;
    totalDiff += Math.abs(userEnjoyment - otherEnjoyment);
  });

  const avgDiff = totalDiff / sharedShows.length;
  const similarity = 1 - avgDiff / 10;
  return Math.max(0, Math.min(1, similarity)); // Clamp 0..1
}

/**
 * Calculate recency multiplier based on rating date and deck mode
 */
export function getRecencyMultiplier(createdAt: string, mode: DeckMode = 'tonight'): number {
  const ratingDate = new Date(createdAt);
  const now = new Date();
  const daysDiff = Math.floor(
    (now.getTime() - ratingDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (mode === 'tonight') {
    // Tonight mode: stronger recency weight
    if (daysDiff < 30) {
      return 1.3;
    } else if (daysDiff <= 180) {
      return 1.0;
    } else {
      return 0.8;
    }
  } else {
    // This weekend mode: normal recency weight
    if (daysDiff < 30) {
      return 1.1;
    } else if (daysDiff <= 180) {
      return 1.0;
    } else {
      return 0.8;
    }
  }
}

/**
 * Apply deck mode multiplier to score
 */
function applyDeckModeMultiplier(
  score: number,
  mode: DeckMode,
  rating: Rating,
  showTags?: string[]
): number {
  if (mode === 'tonight') {
    // Tonight: prefer high Hook + high Enjoyment + "easy watch" tag
    let multiplier = 1.0;
    if (rating.hook && rating.hook >= 7) multiplier += 0.1;
    if (rating.enjoyment >= 7) multiplier += 0.1;
    if (showTags?.includes('easy watch')) multiplier += 0.15;
    return score * multiplier;
  } else {
    // This weekend: prefer higher Payoff + Consistency
    let multiplier = 1.0;
    if (rating.payoff && rating.payoff >= 7) multiplier += 0.1;
    if (rating.consistency && rating.consistency >= 7) multiplier += 0.1;
    return score * multiplier;
  }
}

/**
 * Get personalized recommendations for a user with deck mode support
 */
export async function getPersonalizedRecommendations(
  userId: string,
  mode: DeckMode = 'tonight',
  excludeShowIds: Set<string> = new Set()
): Promise<ShowRecommendation[]> {
  // Fetch all ratings
  const { data: allRatings, error: ratingsError } = await supabase
    .from('ratings')
    .select('user_id, show_id, enjoyment, hook, consistency, payoff, heat, tags, created_at');

  if (ratingsError || !allRatings) {
    throw new Error(`Failed to fetch ratings: ${ratingsError?.message}`);
  }

  // Fetch all profiles for usernames
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username');

  if (profilesError || !profiles) {
    throw new Error(`Failed to fetch profiles: ${profilesError?.message}`);
  }

  // Fetch follows
  const { data: follows, error: followsError } = await supabase
    .from('follows')
    .select('follower_id, followee_id')
    .eq('follower_id', userId);

  const followedSet = new Set(
    follows && !followsError ? follows.map((f) => f.followee_id) : []
  );

  // Fetch all shows
  const { data: shows, error: showsError } = await supabase
    .from('shows')
    .select('id, title, poster_path');

  if (showsError || !shows) {
    throw new Error(`Failed to fetch shows: ${showsError?.message}`);
  }

  const showsMap = new Map(shows.map((s) => [s.id, s]));
  const profilesMap = new Map(profiles.map((p) => [p.id, p]));

  // Get current user's ratings
  const userRatings = allRatings.filter((r) => r.user_id === userId);
  const userRatingsMap = new Map(
    userRatings.map((r) => [r.show_id, r.enjoyment])
  );

  if (userRatings.length < 3) {
    return []; // Not enough ratings
  }

  // Group ratings by user
  const userRatingsGroups = new Map<string, Rating[]>();
  allRatings.forEach((rating) => {
    if (rating.user_id === userId) return; // Skip current user
    if (!userRatingsGroups.has(rating.user_id)) {
      userRatingsGroups.set(rating.user_id, []);
    }
    userRatingsGroups.get(rating.user_id)!.push(rating);
  });

  // Calculate similarities
  const similarities = new Map<string, number>();
  userRatingsGroups.forEach((ratings, otherUserId) => {
    const otherRatingsMap = new Map(
      ratings.map((r) => [r.show_id, r.enjoyment])
    );
    const similarity = calculateSimilarity(userRatingsMap, otherRatingsMap);
    similarities.set(otherUserId, similarity);
  });

  // Get shows user hasn't rated and aren't excluded
  const userShowIds = new Set(userRatings.map((r) => r.show_id));

  // Group ratings by show (excluding user's own ratings and excluded shows)
  const showRatings = new Map<
    string,
    Array<{
      user_id: string;
      enjoyment: number;
      hook?: number;
      consistency?: number;
      payoff?: number;
      heat?: number;
      tags?: string[];
      created_at: string;
      similarity: number;
      isFollowed: boolean;
    }>
  >();

  allRatings.forEach((rating) => {
    if (rating.user_id === userId) return; // Skip current user
    if (userShowIds.has(rating.show_id)) return; // Skip shows user rated
    if (excludeShowIds.has(rating.show_id)) return; // Skip excluded shows

    const similarity = similarities.get(rating.user_id) || 0;
    if (similarity === 0) return; // Skip users with no similarity

    if (!showRatings.has(rating.show_id)) {
      showRatings.set(rating.show_id, []);
    }

    showRatings.get(rating.show_id)!.push({
      user_id: rating.user_id,
      enjoyment: rating.enjoyment,
      hook: rating.hook,
      consistency: rating.consistency,
      payoff: rating.payoff,
      heat: rating.heat,
      tags: rating.tags,
      created_at: rating.created_at,
      similarity,
      isFollowed: followedSet.has(rating.user_id),
    });
  });

  // Calculate scores for each show
  const recommendations: ShowRecommendation[] = [];
  const now = new Date();

  showRatings.forEach((ratings, showId) => {
    // Only include shows with at least 2 raters
    if (ratings.length < 2) return;

    let weightedSum = 0;
    let totalWeight = 0;
    const contributors: Array<{
      user_id: string;
      username: string;
      weight: number;
      similarity: number;
      isFollowed: boolean;
    }> = [];

    ratings.forEach((rating) => {
      const recencyMultiplier = getRecencyMultiplier(rating.created_at, mode);
      const baseWeight = rating.similarity * 0.7;
      const followBonus = rating.isFollowed ? 0.3 : 0;
      const weight = (baseWeight + followBonus) * recencyMultiplier;

      weightedSum += rating.enjoyment * weight;
      totalWeight += weight;

      const profile = profilesMap.get(rating.user_id);
      if (profile) {
        contributors.push({
          user_id: rating.user_id,
          username: profile.username,
          weight,
          similarity: rating.similarity,
          isFollowed: rating.isFollowed,
        });
      }
    });

    if (totalWeight === 0) return;

    const baseScore = weightedSum / totalWeight;
    
    // Apply deck mode multiplier using average rating values
    const avgRating: Rating = {
      user_id: '',
      show_id: showId,
      enjoyment: baseScore,
      hook: ratings.reduce((sum, r) => sum + (r.hook || 0), 0) / ratings.length,
      consistency: ratings.reduce((sum, r) => sum + (r.consistency || 0), 0) / ratings.length,
      payoff: ratings.reduce((sum, r) => sum + (r.payoff || 0), 0) / ratings.length,
      heat: ratings.reduce((sum, r) => sum + (r.heat || 0), 0) / ratings.length,
      tags: ratings.find((r) => r.tags && r.tags.length > 0)?.tags || [],
      created_at: ratings[0].created_at,
    };
    
    const finalScore = applyDeckModeMultiplier(
      baseScore,
      mode,
      avgRating,
      avgRating.tags
    );
    const clampedScore = Math.max(0, Math.min(10, finalScore)); // Clamp 0-10

    // Get top 2 contributors by weight
    contributors.sort((a, b) => b.weight - a.weight);
    const topContributors = contributors.slice(0, 2);

    let explanation = '';
    if (topContributors.length > 0) {
      const parts: string[] = [];
      topContributors.forEach((contributor) => {
        if (contributor.isFollowed) {
          parts.push(`You follow @${contributor.username} • align ${contributor.similarity.toFixed(2)}`);
        } else {
          parts.push(`@${contributor.username} • align ${contributor.similarity.toFixed(2)}`);
        }
      });
      explanation = parts.join(' • ');
    } else {
      explanation = 'Based on similar users';
    }

    const show = showsMap.get(showId);
    if (show) {
      recommendations.push({
        show_id: showId,
        title: show.title,
        poster_path: show.poster_path,
        score: clampedScore,
        explanation,
        tags: avgRating.tags,
      });
    }
  });

  // Sort by score descending
  return recommendations.sort((a, b) => b.score - a.score);
}
