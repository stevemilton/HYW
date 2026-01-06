/**
 * Home picks with guaranteed fallback system
 * Ensures Home always has at least 3 swipeable picks when possible
 */

import { getUserWatchActions } from './actions';
import { computeRecommendStats } from './aggregates';
import { upsertShow } from './db';
import { DEV_MODE } from './dev';
import { getUserRatings } from './profile';
import { DeckMode, getPersonalizedRecommendations } from './reco';
import { supabase } from './supabase';
import { getTrendingShows } from './tmdb';

export interface HomePick {
  show_id: string;
  title: string;
  poster_path: string | null;
  score: number;
  followingPercent: number | null;
  overallPercent: number | null;
  explanation: string;
  tags: string[];
}

/**
 * Get home picks with 3-tier fallback strategy
 */
export async function getHomePicks(
  userId: string,
  mode: DeckMode = 'tonight',
  excludeShowIds: Set<string> = new Set()
): Promise<HomePick[]> {
  // Get excluded show IDs
  const excludedIds = new Set<string>(excludeShowIds);

  // Exclude shows user has rated
  const userRatings = await getUserRatings(userId);
  userRatings.forEach((r) => excludedIds.add(r.show_id));

  // Exclude shows with watch_actions: watched, not_for_me (ever), dismissed (last 30 days)
  const watchActions = await getUserWatchActions(userId);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  watchActions.forEach((action) => {
    if (action.action === 'watched' || action.action === 'not_for_me') {
      excludedIds.add(action.show_id);
    } else if (action.action === 'dismissed') {
      const actionDate = new Date(action.created_at);
      if (actionDate >= thirtyDaysAgo) {
        excludedIds.add(action.show_id);
      }
    }
  });

  const allPicks: HomePick[] = [];

  // Tier A: Follows-based recommendations
  let candidateFromFollows: HomePick[] = [];
  try {
    // Get shows rated by people user follows (latest first)
    const { data: follows } = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', userId);

    const followedSet = new Set(follows?.map((f) => f.followee_id) || []);

    if (followedSet.size > 0) {
      const { data: followRatings } = await supabase
        .from('ratings')
        .select('show_id, user_id, created_at')
        .in('user_id', Array.from(followedSet))
        .order('created_at', { ascending: false })
        .limit(100);

      const followShowIds = new Set(
        followRatings?.map((r) => r.show_id).filter((id) => !excludedIds.has(id)) || []
      );

      if (followShowIds.size > 0) {
        // Get personalized recs and filter to follow shows
        const personalizedRecs = await getPersonalizedRecommendations(
          userId,
          mode,
          excludedIds
        );

        candidateFromFollows = personalizedRecs
          .filter((rec) => followShowIds.has(rec.show_id))
          .slice(0, 10)
          .map((rec) => ({
            show_id: rec.show_id,
            title: rec.title,
            poster_path: rec.poster_path,
            score: rec.score,
            followingPercent: null,
            overallPercent: null,
            explanation: rec.explanation,
            tags: rec.tags || [],
          }));
      }
    }
  } catch (error) {
    console.error('Failed to fetch follows-based picks:', error);
  }

  // Tier B: Community-based (highest recommend rate in last 7 days)
  let candidateFromCommunity: HomePick[] = [];
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Fetch recent recommends (filter exclusions client-side)
      const { data: recentRatings } = await supabase
        .from('ratings')
        .select('show_id, recommend, created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .eq('recommend', true);

    if (recentRatings && recentRatings.length > 0) {
      // Group by show_id and count recommends
      const showRecommendCounts = new Map<string, number>();
      recentRatings.forEach((r) => {
        if (!excludedIds.has(r.show_id)) {
          showRecommendCounts.set(r.show_id, (showRecommendCounts.get(r.show_id) || 0) + 1);
        }
      });

      // Get top shows by recommend count
      const topShowIds = Array.from(showRecommendCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([showId]) => showId);

      if (topShowIds.length > 0) {
        const { data: shows } = await supabase
          .from('shows')
          .select('id, title, poster_path')
          .in('id', topShowIds);

        if (shows) {
          // Get recommend stats for each
          const picksWithStats = await Promise.all(
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
                score: 7.5, // Default community score
                followingPercent: null,
                overallPercent: stats.percent,
                explanation: 'Popular this week',
                tags: [],
              };
            })
          );

          candidateFromCommunity = picksWithStats.slice(0, 10);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch community-based picks:', error);
  }

  // Combine Tier A and B, remove duplicates
  const combinedPicks = new Map<string, HomePick>();
  [...candidateFromFollows, ...candidateFromCommunity].forEach((pick) => {
    if (!combinedPicks.has(pick.show_id)) {
      combinedPicks.set(pick.show_id, pick);
    }
  });

  allPicks.push(...Array.from(combinedPicks.values()));

  // Tier C: TMDB Trending fallback (only if we have < 3 picks)
  if (allPicks.length < 3) {
    try {
      const trending = await getTrendingShows('day');
      const trendingShows = trending.results
        .filter((show) => show.poster_path && !excludedIds.has(show.id.toString()))
        .slice(0, 10);

      // Upsert trending shows into cache
      for (const tmdbShow of trendingShows) {
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
      }

      const trendingPicks: HomePick[] = trendingShows.map((show) => ({
        show_id: show.id.toString(),
        title: (show.title || show.name || 'Unknown') as string,
        poster_path: show.poster_path,
        score: 7.0, // Placeholder score for trending
        followingPercent: null,
        overallPercent: null,
        explanation: 'Trending now',
        tags: [],
      }));

      // Add trending picks that aren't already in allPicks
      trendingPicks.forEach((pick) => {
        if (!allPicks.some((p) => p.show_id === pick.show_id)) {
          allPicks.push(pick);
        }
      });
    } catch (error) {
      console.error('Failed to fetch trending shows:', error);
    }
  }

  // Diagnostic logging (dev-only)
  if (DEV_MODE) {
    console.log('HOME PICKS DEBUG', {
      candidateFromFollows: candidateFromFollows.length,
      candidateFromCommunity: candidateFromCommunity.length,
      afterExclusions: allPicks.length,
      finalPicks: allPicks.length,
      excludedCount: excludedIds.size,
    });
  }

  // Return up to 10 picks
  return allPicks.slice(0, 10);
}

