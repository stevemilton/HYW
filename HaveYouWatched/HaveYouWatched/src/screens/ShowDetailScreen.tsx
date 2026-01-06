import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DevModeBanner from '../components/DevModeBanner';
import { computeRecommendStats } from '../lib/aggregates';
import { DEV_MODE, getCurrentUserId } from '../lib/dev';
import { getUserRatingForShow } from '../lib/profile';
import { supabase } from '../lib/supabase';
import {
  getBackdropUrl,
  getPosterUrl,
  getShowDate,
  getShowDetails,
  getShowTitle,
  TMDBShowDetails,
} from '../lib/tmdb';
import { RootStackParamList } from '../navigation/RootNavigator';
import Card from '../ui/Card';
import { colors, radius, spacing } from '../ui/theme';

type ShowDetailRouteProp = RouteProp<RootStackParamList, 'ShowDetail'>;
type ShowDetailNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ShowDetail'
>;

export default function ShowDetailScreen() {
  const route = useRoute<ShowDetailRouteProp>();
  const navigation = useNavigation<ShowDetailNavigationProp>();
  const { tmdbId, mediaType } = route.params;
  const [show, setShow] = useState<TMDBShowDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingRating, setExistingRating] = useState<{
    hook: number;
    consistency: number;
    payoff: number;
    heat: number;
    enjoyment: number;
    recommend: boolean;
    tags: string[];
  } | null>(null);
  const [loadingRating, setLoadingRating] = useState(true);
  const [recommendStats, setRecommendStats] = useState<{
    overall: { total: number; positive: number; percent: number | null };
    following: { total: number; positive: number; percent: number | null };
  } | null>(null);
  const [loadingRecommendStats, setLoadingRecommendStats] = useState(true);

  const handleRateShow = () => {
    if (!show) return;
    navigation.navigate('RateShow' as any, {
      show: {
        id: show.id,
        title: show.title,
        name: show.name,
        overview: show.overview,
        poster_path: show.poster_path,
        first_air_date: show.first_air_date,
        release_date: show.release_date,
      },
      initialRating: existingRating || undefined,
    });
  };

  useEffect(() => {
    const loadExistingRating = async () => {
      if (!DEV_MODE) {
        setLoadingRating(false);
        return;
      }

      try {
        const userId = await getCurrentUserId();
        const rating = await getUserRatingForShow(userId, tmdbId.toString());
        setExistingRating(rating);
      } catch (error: any) {
        console.error('Failed to load existing rating:', error);
      } finally {
        setLoadingRating(false);
      }
    };

    loadExistingRating();
  }, [tmdbId]);

  useEffect(() => {
    const loadRecommendStats = async () => {
      setLoadingRecommendStats(true);
      try {
        const userId = await getCurrentUserId();
        const showIdStr = tmdbId.toString();

        // Fetch all ratings for the show (limit 500)
        const { data: allRatings, error: ratingsError } = await supabase
          .from('ratings')
          .select('user_id, recommend')
          .eq('show_id', showIdStr)
          .limit(500);

        if (ratingsError) {
          console.error('Error loading ratings:', ratingsError);
          setRecommendStats({
            overall: { total: 0, positive: 0, percent: null },
            following: { total: 0, positive: 0, percent: null },
          });
          return;
        }

        // Fetch follows for current user
        const { data: follows, error: followsError } = await supabase
          .from('follows')
          .select('followee_id')
          .eq('follower_id', userId);

        if (followsError) {
          console.error('Error loading follows:', followsError);
          // Continue with overall stats only
        }

        const followeeIds = new Set(
          follows ? follows.map((f: any) => f.followee_id) : []
        );

        // Split ratings into overall and following
        const overallRatings = (allRatings || []).map((r: any) => ({
          recommend: r.recommend,
        }));

        const followingRatings = (allRatings || [])
          .filter((r: any) => followeeIds.has(r.user_id))
          .map((r: any) => ({
            recommend: r.recommend,
          }));

        // Compute stats
        const overallStats = computeRecommendStats(overallRatings);
        const followingStats = computeRecommendStats(followingRatings);

        setRecommendStats({
          overall: overallStats,
          following: followingStats,
        });
      } catch (error: any) {
        console.error('Error loading recommend stats:', error);
        setRecommendStats({
          overall: { total: 0, positive: 0, percent: null },
          following: { total: 0, positive: 0, percent: null },
        });
      } finally {
        setLoadingRecommendStats(false);
      }
    };

    loadRecommendStats();
  }, [tmdbId]);

  useEffect(() => {
    const fetchShowDetails = async () => {
      setLoading(true);
      try {
        const data = await getShowDetails(tmdbId, mediaType);
        setShow(data);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to load show details');
      } finally {
        setLoading(false);
      }
    };

    fetchShowDetails();
  }, [tmdbId, mediaType]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!show) {
    return (
      <View style={styles.centerContainer}>
        <Text>Show not found</Text>
      </View>
    );
  }

  const runtime =
    show.runtime ||
    (show.episode_run_time && show.episode_run_time[0]) ||
    null;

  return (
    <ScrollView style={styles.container}>
      <DevModeBanner />
      {show.backdrop_path && (
        <Image
          source={{ uri: getBackdropUrl(show.backdrop_path) }}
          style={styles.backdrop}
          resizeMode="cover"
        />
      )}
      <View style={styles.content}>
        <View style={styles.header}>
          {show.poster_path && (
            <Image
              source={{ uri: getPosterUrl(show.poster_path) }}
              style={styles.poster}
              resizeMode="cover"
            />
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{getShowTitle(show)}</Text>
            {show.tagline && <Text style={styles.tagline}>{show.tagline}</Text>}
            <View style={styles.meta}>
              {getShowDate(show) && (
                <Text style={styles.metaText}>{getShowDate(show)}</Text>
              )}
              {runtime && (
                <Text style={styles.metaText}>
                  {runtime} {mediaType === 'movie' ? 'min' : 'min/ep'}
                </Text>
              )}
              {show.vote_average > 0 && (
                <Text style={styles.metaText}>
                  ⭐ {show.vote_average.toFixed(1)}/10
                </Text>
              )}
            </View>
            {mediaType === 'tv' && (
              <View style={styles.meta}>
                {show.number_of_seasons && (
                  <Text style={styles.metaText}>
                    {show.number_of_seasons} season
                    {show.number_of_seasons !== 1 ? 's' : ''}
                  </Text>
                )}
                {show.number_of_episodes && (
                  <Text style={styles.metaText}>
                    {show.number_of_episodes} episode
                    {show.number_of_episodes !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>
            )}
            {show.status && (
              <Text style={styles.status}>Status: {show.status}</Text>
            )}
          </View>
        </View>

        {show.genres.length > 0 && (
          <View style={styles.genres}>
            {show.genres.map((genre) => (
              <View key={genre.id} style={styles.genreTag}>
                <Text style={styles.genreText}>{genre.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommend Stats Module */}
        {!loadingRecommendStats && recommendStats && (
          <Card style={styles.recommendCard}>
            <Text style={styles.recommendTitle}>Recommend</Text>
            <View style={styles.recommendRow}>
              <Text style={styles.recommendLabel}>Following:</Text>
              {recommendStats.following.total > 0 ? (
                <Text style={styles.recommendValue}>
                  {recommendStats.following.percent}% recommend (
                  {recommendStats.following.positive}/
                  {recommendStats.following.total})
                </Text>
              ) : (
                <Text style={styles.recommendValueMuted}>—</Text>
              )}
            </View>
            <View style={styles.recommendRow}>
              <Text style={styles.recommendLabel}>Overall:</Text>
              {recommendStats.overall.total > 0 ? (
                <Text style={styles.recommendValue}>
                  {recommendStats.overall.percent}% recommend (
                  {recommendStats.overall.positive}/
                  {recommendStats.overall.total})
                </Text>
              ) : (
                <Text style={styles.recommendValueMuted}>—</Text>
              )}
            </View>
          </Card>
        )}

        {show.overview && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.overview}>{show.overview}</Text>
          </View>
        )}

        {DEV_MODE && !loadingRating && existingRating && (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingCardTitle}>Your Rating</Text>
            <Text style={styles.ratingCardEnjoyment}>
              Enjoyment: {existingRating.enjoyment}/10
            </Text>
            {existingRating.tags.length > 0 && (
              <View style={styles.ratingCardTags}>
                {existingRating.tags.map((tag) => (
                  <View key={tag} style={styles.ratingTag}>
                    <Text style={styles.ratingTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
            {existingRating.recommend && (
              <Text style={styles.ratingCardRecommend}>✓ Recommended</Text>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.rateButton} onPress={handleRateShow}>
          <Text style={styles.rateButtonText}>
            {existingRating ? 'Edit Rating' : 'Rate This Show'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    width: '100%',
    height: 200,
  },
  content: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  poster: {
    width: 120,
    height: 180,
    borderRadius: 8,
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
    color: colors.text,
  },
  tagline: {
    fontSize: 16,
    fontStyle: 'italic',
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  metaText: {
    fontSize: 14,
    color: colors.muted,
  },
  status: {
    fontSize: 14,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  genreTag: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  genreText: {
    fontSize: 12,
    color: colors.text,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
    color: colors.text,
  },
  overview: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  ratingCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  ratingCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
    color: colors.text,
  },
  ratingCardEnjoyment: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  ratingCardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  ratingTag: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  ratingTagText: {
    fontSize: 12,
    color: colors.text,
  },
  ratingCardRecommend: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  recommendCard: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  recommendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  recommendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  recommendLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  recommendValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  recommendValueMuted: {
    fontSize: 14,
    color: colors.muted,
    fontStyle: 'italic',
  },
  rateButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  rateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

