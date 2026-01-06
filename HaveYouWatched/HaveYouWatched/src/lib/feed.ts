import { supabase } from './supabase';

export interface FollowingActivity {
  id: string;
  username: string;
  show_title: string;
  poster_path: string | null;
  enjoyment: number;
  created_at: string;
}

export interface ForYouShow {
  id: string;
  title: string;
  poster_path: string | null;
  score: number;
  explanation: string;
}

export interface UserSimilarity {
  user_id: string;
  username: string;
  similarity: number;
}

export async function getFollowingActivity(
  userId: string
): Promise<FollowingActivity[]> {
  // Get users I follow
  const { data: follows, error: followsError } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', userId);

  if (followsError || !follows || follows.length === 0) {
    return [];
  }

  const followedIds = follows.map((f: any) => f.followee_id);

  // Get ratings from users I follow
  const { data: ratings, error: ratingsError } = await supabase
    .from('ratings')
    .select(
      `
      id,
      enjoyment,
      created_at,
      show_id,
      user_id,
      shows (
        title,
        poster_path
      ),
      profiles (
        username
      )
    `
    )
    .in('user_id', followedIds)
    .order('created_at', { ascending: false })
    .limit(20);

  if (ratingsError) {
    throw new Error(`Failed to fetch following activity: ${ratingsError.message}`);
  }

  if (!ratings) return [];

  return ratings
    .map((rating: any) => {
      if (!rating.shows || !rating.profiles) return null;
      const showData = Array.isArray(rating.shows)
        ? rating.shows[0]
        : rating.shows;
      return {
        id: rating.id,
        username: rating.profiles.username || 'Unknown',
        show_title: showData?.title || 'Unknown',
        poster_path: showData?.poster_path || null,
        enjoyment: rating.enjoyment,
        created_at: rating.created_at,
      };
    })
    .filter((item): item is FollowingActivity => item !== null);
}

export async function getUserSimilarities(
  userId: string
): Promise<UserSimilarity[]> {
  // First try to get from computed_taste table (if it exists)
  try {
    const { data: computed, error: computedError } = await supabase
      .from('computed_taste')
      .select('user_id_2, similarity, profiles:user_id_2(username)')
      .eq('user_id_1', userId)
      .order('similarity', { ascending: false });

    if (!computedError && computed && computed.length > 0) {
      return computed.map((item: any) => ({
        user_id: item.user_id_2,
        username: item.profiles?.username || 'Unknown',
        similarity: item.similarity,
      }));
    }
  } catch (error) {
    // Table might not exist, continue to compute on the fly
  }

  // Otherwise compute on the fly
  const { data: myRatings, error: myRatingsError } = await supabase
    .from('ratings')
    .select('show_id, enjoyment')
    .eq('user_id', userId);

  if (myRatingsError || !myRatings || myRatings.length < 3) {
    return [];
  }

  const myShowIds = new Set(myRatings.map((r) => r.show_id));
  const myRatingsMap = new Map(
    myRatings.map((r) => [r.show_id, r.enjoyment])
  );

  // Get all other users' ratings
  const { data: allRatings, error: allRatingsError } = await supabase
    .from('ratings')
    .select('user_id, show_id, enjoyment, profiles!inner(username)')
    .neq('user_id', userId);

  if (allRatingsError || !allRatings) return [];

  // Group by user
  const userRatingsMap = new Map<string, Map<string, number>>();
  const userNamesMap = new Map<string, string>();

  allRatings.forEach((rating: any) => {
    if (!userRatingsMap.has(rating.user_id)) {
      userRatingsMap.set(rating.user_id, new Map());
      userNamesMap.set(rating.user_id, rating.profiles?.username || 'Unknown');
    }
    userRatingsMap.get(rating.user_id)!.set(rating.show_id, rating.enjoyment);
  });

  // Calculate similarity for each user
  const similarities: UserSimilarity[] = [];

  userRatingsMap.forEach((otherRatings, otherUserId) => {
    const sharedShows = Array.from(myShowIds).filter((showId) =>
      otherRatings.has(showId)
    );

    // Only compute similarity for users with >=3 shared shows
    if (sharedShows.length < 3) {
      // Use default 0.3 for users with <3 shared shows
      similarities.push({
        user_id: otherUserId,
        username: userNamesMap.get(otherUserId) || 'Unknown',
        similarity: 0.3,
      });
      return;
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let myNorm = 0;
    let otherNorm = 0;

    sharedShows.forEach((showId) => {
      const myRating = myRatingsMap.get(showId)!;
      const otherRating = otherRatings.get(showId)!;
      dotProduct += myRating * otherRating;
      myNorm += myRating * myRating;
      otherNorm += otherRating * otherRating;
    });

    const similarity =
      myNorm > 0 && otherNorm > 0
        ? dotProduct / (Math.sqrt(myNorm) * Math.sqrt(otherNorm))
        : 0.3; // Fallback to default

    similarities.push({
      user_id: otherUserId,
      username: userNamesMap.get(otherUserId) || 'Unknown',
      similarity: Math.max(0, Math.min(1, similarity)), // Clamp 0-1
    });
  });

  return similarities.sort((a, b) => b.similarity - a.similarity);
}

export async function getForYouShows(
  userId: string
): Promise<ForYouShow[]> {
  // Check if user has rated at least 3 shows
  const { data: myRatings, error: myRatingsError } = await supabase
    .from('ratings')
    .select('show_id')
    .eq('user_id', userId);

  if (
    myRatingsError ||
    !myRatings ||
    myRatings.length < 3
  ) {
    return []; // Insufficient data
  }

  // Get user similarities
  const similarities = await getUserSimilarities(userId);
  if (similarities.length === 0) {
    return []; // No similar users
  }

  const similarityMap = new Map(
    similarities.map((s) => [s.user_id, s])
  );

  // Get users I follow
  const { data: follows, error: followsError } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', userId);

  const followedSet = new Set(
    follows && !followsError
      ? follows.map((f: any) => f.followee_id)
      : []
  );

  // Get all ratings from similar users
  const { data: allRatings, error: allRatingsError } = await supabase
    .from('ratings')
    .select(
      `
      user_id,
      show_id,
      enjoyment,
      created_at,
      shows (
        title,
        poster_path
      )
    `
    )
    .in(
      'user_id',
      similarities.map((s) => s.user_id)
    );

  if (allRatingsError || !allRatings) return [];

  // Get shows I've already rated to exclude them
  const myShowIds = new Set(myRatings.map((r) => r.show_id));

  // Group ratings by show
  const showRatingsMap = new Map<
    string,
    Array<{
      user_id: string;
      enjoyment: number;
      created_at: string;
      similarity: number;
      isFollowed: boolean;
    }>
  >();

  const showTitlesMap = new Map<string, string>();
  const showPostersMap = new Map<string, string | null>();

  allRatings.forEach((rating: any) => {
    const showId = rating.show_id;
    if (myShowIds.has(showId)) return; // Skip shows I've already rated

    const similarity = similarityMap.get(rating.user_id);
    if (!similarity) return;

    const showData = Array.isArray(rating.shows)
      ? rating.shows[0]
      : rating.shows;

    if (!showRatingsMap.has(showId)) {
      showRatingsMap.set(showId, []);
      showTitlesMap.set(showId, showData?.title || 'Unknown');
      showPostersMap.set(showId, showData?.poster_path || null);
    }

    showRatingsMap.get(showId)!.push({
      user_id: rating.user_id,
      enjoyment: rating.enjoyment,
      created_at: rating.created_at,
      similarity: similarity.similarity,
      isFollowed: followedSet.has(rating.user_id),
    });
  });

  // Calculate scores for each show
  const now = new Date();
  const shows: ForYouShow[] = [];

  showRatingsMap.forEach((ratings, showId) => {
    let weightedSum = 0;
    let totalWeight = 0;
    const contributingUsers: Array<{ username: string; weight: number }> = [];

    ratings.forEach((rating) => {
      // Calculate recency multiplier
      const ratingDate = new Date(rating.created_at);
      const daysDiff = Math.floor(
        (now.getTime() - ratingDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      let recencyMultiplier = 1.0;
      if (daysDiff < 30) {
        recencyMultiplier = 1.2;
      } else if (daysDiff <= 180) {
        recencyMultiplier = 1.0;
      } else {
        recencyMultiplier = 0.8;
      }

      // Calculate weight
      const baseWeight = rating.similarity * 0.7;
      const followBonus = rating.isFollowed ? 0.3 : 0;
      const weight = (baseWeight + followBonus) * recencyMultiplier;

      weightedSum += rating.enjoyment * weight;
      totalWeight += weight;

      const similarity = similarityMap.get(rating.user_id);
      if (similarity) {
        contributingUsers.push({
          username: similarity.username,
          weight: weight,
        });
      }
    });

    if (totalWeight === 0) return;

    const score = weightedSum / totalWeight;
    const finalScore = Math.max(0, Math.min(10, score)); // Clamp 0-10

    // Get top 2 contributing users for explanation
    contributingUsers.sort((a, b) => b.weight - a.weight);
    const topUsers = contributingUsers.slice(0, 2);

    let explanation = 'Because you align with ';
    if (topUsers.length > 0) {
      explanation += `@${topUsers[0].username} (${topUsers[0].weight.toFixed(2)})`;
      if (topUsers.length > 1) {
        explanation += ` and @${topUsers[1].username} (${topUsers[1].weight.toFixed(2)})`;
      }
    } else {
      explanation = 'Based on similar users';
    }

    shows.push({
      id: showId,
      title: showTitlesMap.get(showId) || 'Unknown',
      poster_path: showPostersMap.get(showId) || null,
      score: finalScore,
      explanation,
    });
  });

  // Sort by score descending
  return shows.sort((a, b) => b.score - a.score);
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

