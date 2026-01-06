/**
 * Inspiration Mode shelf data fetchers
 * Provides browse-first content for Inspiration Mode
 */

import { computeRecommendStats } from './aggregates';
import { upsertShow } from './db';
import { supabase } from './supabase';
import { fetchTopRated, fetchTrendingWeekly } from './tmdb';

export interface ShelfItem {
  show_id: string;
  title: string;
  poster_path: string | null;
  recommendPercent: number | null;
  label: string; // "82% recommend" or "Trending" or "Top rated"
  mediaType?: 'movie' | 'tv'; // Optional media type for navigation
}

/**
 * Fetch "Popular this week" shelf
 * Prefers community recommend rate, falls back to TMDB trending weekly
 */
export async function fetchPopularThisWeek(userId?: string): Promise<ShelfItem[]> {
  const items: ShelfItem[] = [];

  try {
    // Try community first (recommend rate in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentRatings } = await supabase
      .from('ratings')
      .select('show_id, recommend, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .eq('recommend', true)
      .limit(100);

    if (recentRatings && recentRatings.length > 0) {
      // Group by show_id and count recommends
      const showRecommendCounts = new Map<string, number>();
      recentRatings.forEach((r) => {
        showRecommendCounts.set(r.show_id, (showRecommendCounts.get(r.show_id) || 0) + 1);
      });

      // Get top shows by recommend count
      const topShowIds = Array.from(showRecommendCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([showId]) => showId);

      if (topShowIds.length > 0) {
        const { data: shows } = await supabase
          .from('shows')
          .select('id, title, poster_path')
          .in('id', topShowIds);

        if (shows && shows.length > 0) {
          // Get recommend stats for each
          const itemsWithStats = await Promise.all(
            shows.slice(0, 3).map(async (show) => {
              const { data: ratings } = await supabase
                .from('ratings')
                .select('recommend')
                .eq('show_id', show.id)
                .limit(500);

              const stats = computeRecommendStats(ratings || []);

              return {
                show_id: show.id,
                title: show.title,
                poster_path: show.poster_path,
                recommendPercent: stats.percent,
                label: stats.percent !== null ? `${stats.percent}% recommend` : 'Popular',
                mediaType: 'tv', // Default to tv for TV shelves
              };
            })
          );

          items.push(...itemsWithStats);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch community popular:', error);
  }

  // Fallback to TMDB if we don't have 3 items
  if (items.length < 3) {
    try {
      const trending = await fetchTrendingWeekly();
      const needed = 3 - items.length;

      for (const tmdbShow of trending.slice(0, needed)) {
        // Upsert to cache
        try {
          await upsertShow({
            id: tmdbShow.id.toString(),
            title: (tmdbShow.title || tmdbShow.name || 'Unknown') as string,
            poster_path: tmdbShow.poster_path,
            overview: tmdbShow.overview || '',
            first_air_date: tmdbShow.first_air_date || tmdbShow.release_date || null,
          });
        } catch (error) {
          console.error('Failed to upsert trending show:', error);
        }

        // Determine mediaType: if first_air_date or media_type === "tv" => tv, else movie
        const mediaType: 'movie' | 'tv' = 
          tmdbShow.first_air_date || tmdbShow.media_type === 'tv' ? 'tv' : 'movie';

        items.push({
          show_id: tmdbShow.id.toString(),
          title: (tmdbShow.title || tmdbShow.name || 'Unknown') as string,
          poster_path: tmdbShow.poster_path,
          recommendPercent: null,
          label: 'Trending',
          mediaType,
        });
      }
    } catch (error) {
      console.error('Failed to fetch TMDB trending:', error);
    }
  }

  return items.slice(0, 3);
}

/**
 * Fetch "Trending with friends" shelf
 * Shows rated in last 7 days by people user follows, fallback to community
 */
/**
 * Fetch "Trending with friends" shelf
 * Shows rated in last 7 days by people user follows, fallback to community
 */
export async function fetchFriendsTrending(userId?: string): Promise<ShelfItem[]> {
  const items: ShelfItem[] = [];

  try {
    if (!userId) {
      const { getCurrentUserId } = await import('./dev');
      userId = await getCurrentUserId();
    }
    // Get follows
    const { data: follows } = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', userId);

    const followedSet = new Set(follows?.map((f) => f.followee_id) || []);

    if (followedSet.size > 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: followRatings } = await supabase
        .from('ratings')
        .select('show_id, user_id, created_at')
        .in('user_id', Array.from(followedSet))
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (followRatings && followRatings.length > 0) {
        // Get unique show IDs (latest first)
        const showIds = Array.from(
          new Set(followRatings.map((r) => r.show_id))
        ).slice(0, 3);

        if (showIds.length > 0) {
          const { data: shows } = await supabase
            .from('shows')
            .select('id, title, poster_path')
            .in('id', showIds);

          if (shows && shows.length > 0) {
            // Get recommend stats
            const itemsWithStats = await Promise.all(
              shows.map(async (show) => {
                const { data: ratings } = await supabase
                  .from('ratings')
                  .select('recommend')
                  .eq('show_id', show.id)
                  .limit(500);

                const stats = computeRecommendStats(ratings || []);

                return {
                  show_id: show.id,
                  title: show.title,
                  poster_path: show.poster_path,
                  recommendPercent: stats.percent,
                  label: stats.percent !== null ? `${stats.percent}% recommend` : 'Trending',
                  mediaType: 'tv', // Default to tv for TV shelves
                };
              })
            );

            items.push(...itemsWithStats);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch friends trending:', error);
  }

  // Fallback to community if we don't have 3 items
  if (items.length < 3) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentRatings } = await supabase
        .from('ratings')
        .select('show_id, recommend, created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .eq('recommend', true)
        .limit(50);

      if (recentRatings && recentRatings.length > 0) {
        const showIds = Array.from(
          new Set(recentRatings.map((r) => r.show_id))
        ).slice(0, 3 - items.length);

        if (showIds.length > 0) {
          const { data: shows } = await supabase
            .from('shows')
            .select('id, title, poster_path')
            .in('id', showIds);

          if (shows && shows.length > 0) {
            const itemsWithStats = await Promise.all(
              shows.map(async (show) => {
                const { data: ratings } = await supabase
                  .from('ratings')
                  .select('recommend')
                  .eq('show_id', show.id)
                  .limit(500);

                const stats = computeRecommendStats(ratings || []);

                return {
                  show_id: show.id,
                  title: show.title,
                  poster_path: show.poster_path,
                  recommendPercent: stats.percent,
                  label: stats.percent !== null ? `${stats.percent}% recommend` : 'Popular',
                  mediaType: 'tv', // Default to tv for TV shelves
                };
              })
            );

            items.push(...itemsWithStats);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch community fallback:', error);
    }
  }

  return items.slice(0, 3);
}

/**
 * Fetch "Critically loved" shelf
 * Prefers community high enjoyment + recommend=true, falls back to TMDB top rated
 */
/**
 * Fetch "Critically loved" shelf
 * Prefers community high enjoyment + recommend=true, falls back to TMDB top rated
 */
export async function fetchCriticallyLoved(userId?: string): Promise<ShelfItem[]> {
  const items: ShelfItem[] = [];

  try {
    if (!userId) {
      const { getCurrentUserId } = await import('./dev');
      userId = await getCurrentUserId();
    }
    // Try community first (high enjoyment + recommend=true)
    const { data: highRatings } = await supabase
      .from('ratings')
      .select('show_id, enjoyment, recommend')
      .gte('enjoyment', 8)
      .eq('recommend', true)
      .limit(100);

    if (highRatings && highRatings.length > 0) {
      // Group by show_id, count occurrences
      const showCounts = new Map<string, number>();
      highRatings.forEach((r) => {
        showCounts.set(r.show_id, (showCounts.get(r.show_id) || 0) + 1);
      });

      // Get top shows
      const topShowIds = Array.from(showCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([showId]) => showId);

      if (topShowIds.length > 0) {
        const { data: shows } = await supabase
          .from('shows')
          .select('id, title, poster_path')
          .in('id', topShowIds);

        if (shows && shows.length > 0) {
          const itemsWithStats = await Promise.all(
            shows.slice(0, 3).map(async (show) => {
              const { data: ratings } = await supabase
                .from('ratings')
                .select('recommend')
                .eq('show_id', show.id)
                .limit(500);

              const stats = computeRecommendStats(ratings || []);

              return {
                show_id: show.id,
                title: show.title,
                poster_path: show.poster_path,
                recommendPercent: stats.percent,
                label: stats.percent !== null ? `${stats.percent}% recommend` : 'Top rated',
                mediaType: 'tv', // Default to tv for TV shelves
              };
            })
          );

          items.push(...itemsWithStats);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch community critically loved:', error);
  }

  // Fallback to TMDB if we don't have 3 items
  if (items.length < 3) {
    try {
      const topRated = await fetchTopRated();
      const needed = 3 - items.length;

      for (const tmdbShow of topRated.slice(0, needed)) {
        // Upsert to cache
        try {
          await upsertShow({
            id: tmdbShow.id.toString(),
            title: (tmdbShow.title || tmdbShow.name || 'Unknown') as string,
            poster_path: tmdbShow.poster_path,
            overview: tmdbShow.overview || '',
            first_air_date: tmdbShow.first_air_date || tmdbShow.release_date || null,
          });
        } catch (error) {
          console.error('Failed to upsert top rated show:', error);
        }

        // Determine mediaType: if first_air_date or media_type === "tv" => tv, else movie
        const mediaType: 'movie' | 'tv' = 
          tmdbShow.first_air_date || tmdbShow.media_type === 'tv' ? 'tv' : 'movie';

        items.push({
          show_id: tmdbShow.id.toString(),
          title: (tmdbShow.title || tmdbShow.name || 'Unknown') as string,
          poster_path: tmdbShow.poster_path,
          recommendPercent: null,
          label: 'Top rated',
          mediaType,
        });
      }
    } catch (error) {
      console.error('Failed to fetch TMDB top rated:', error);
    }
  }

  return items.slice(0, 3);
}

