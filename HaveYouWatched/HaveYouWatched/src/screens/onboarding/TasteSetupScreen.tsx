import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { recordWatchAction } from '../../lib/actions';
import { RatingData, ShowData, upsertRating, upsertShow } from '../../lib/db';
import { getCurrentUserId } from '../../lib/dev';
import { getOnboardingState } from '../../lib/onboarding';
import { getShowDate, getShowTitle, TMDBShow } from '../../lib/tmdb';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import Button from '../../ui/Button';
import Screen from '../../ui/Screen';
import { colors, radius, spacing } from '../../ui/theme';

type TasteSetupScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'TasteSetup'
>;

type Selection = 'loved' | 'not_for_me' | 'not_seen';

export default function TasteSetupScreen() {
  const navigation = useNavigation<TasteSetupScreenNavigationProp>();
  const [shows, setShows] = useState<TMDBShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selections, setSelections] = useState<Map<string, Selection>>(new Map());

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const onboardingState = await getOnboardingState();
        const countryCode = onboardingState.country_code;

        // Fetch trending weekly - TMDB supports region parameter for country bias
        let url = `https://api.themoviedb.org/3/trending/all/week?api_key=${process.env.EXPO_PUBLIC_TMDB_API_KEY}`;
        if (countryCode) {
          url += `&region=${countryCode}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch trending shows');
        }

        const data = await response.json();
        // Filter for shows with posters and take first 10
        const showsWithPosters = data.results
          .filter((show: TMDBShow) => show.poster_path)
          .slice(0, 10);

        setShows(showsWithPosters);
      } catch (error: any) {
        console.error('Failed to fetch trending shows:', error);
        Alert.alert('Error', 'Failed to load shows. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, []);

  const handleSelection = (showId: string, selection: Selection) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (selection === 'not_seen') {
        next.delete(showId);
      } else {
        next.set(showId, selection);
      }
      return next;
    });
  };

  const getSelectionCount = (): number => {
    return Array.from(selections.values()).filter((s) => s !== 'not_seen').length;
  };

  const canContinue = getSelectionCount() >= 5;

  const handleContinue = async () => {
    if (!canContinue) {
      Alert.alert('Error', 'Please rate at least 5 shows');
      return;
    }

    setSaving(true);
    try {
      const userId = await getCurrentUserId();

      // Process each selection
      const promises: Promise<void>[] = [];

      for (const [showId, selection] of Array.from(selections.entries())) {
        const show = shows.find((s) => s.id.toString() === showId);
        if (!show) continue;

        // Upsert show to database
        const showData: ShowData = {
          id: show.id.toString(),
          title: getShowTitle(show),
          poster_path: show.poster_path,
          overview: show.overview || '',
          first_air_date: getShowDate(show) || null,
        };
        promises.push(upsertShow(showData));

        if (selection === 'loved') {
          // Loved: enjoyment=9, recommend=true, etc.
          const rating: RatingData = {
            user_id: userId,
            show_id: showId,
            hook: 8,
            consistency: 8,
            payoff: 8,
            heat: 7,
            enjoyment: 9,
            recommend: true,
            tags: [],
          };
          promises.push(upsertRating(rating));
        } else if (selection === 'not_for_me') {
          // Not for me: enjoyment=3, recommend=false, etc.
          const rating: RatingData = {
            user_id: userId,
            show_id: showId,
            hook: 3,
            consistency: 3,
            payoff: 3,
            heat: 3,
            enjoyment: 3,
            recommend: false,
            tags: [],
          };
          promises.push(upsertRating(rating));
          // Also record watch action
          promises.push(
            recordWatchAction({
              showId,
              action: 'not_for_me',
            }).catch((err) => {
              console.error('Failed to record watch action:', err);
              // Don't fail the whole operation
            })
          );
        }
        // 'not_seen' does nothing
      }

      await Promise.all(promises);

      // Update onboarding step and navigate
      const { setOnboardingStep } = await import('../../lib/onboarding');
      await setOnboardingStep('find_friends');
      navigation.navigate('FindFriends');
    } catch (error: any) {
      console.error('Failed to save ratings:', error);
      Alert.alert('Error', error.message || 'Failed to save ratings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      const { setOnboardingStep } = await import('../../lib/onboarding');
      await setOnboardingStep('find_friends');
      navigation.navigate('FindFriends');
    } catch (error: any) {
      console.error('Failed to update onboarding step:', error);
      navigation.navigate('FindFriends');
    } finally {
      setSaving(false);
    }
  };

  const renderShowRow = ({ item }: { item: TMDBShow }) => {
    const showId = item.id.toString();
    const selection = selections.get(showId) || 'not_seen';

    return (
      <View style={styles.showRow}>
        {/* Poster */}
        {item.poster_path && (
          <Image
            source={{
              uri: `https://image.tmdb.org/t/p/w342${item.poster_path}`,
            }}
            style={styles.poster}
            resizeMode="cover"
          />
        )}

        {/* Title and info */}
        <View style={styles.showInfo}>
          <Text style={styles.showTitle} numberOfLines={2}>
            {getShowTitle(item)}
          </Text>
          {getShowDate(item) && (
            <Text style={styles.showDate}>{getShowDate(item)}</Text>
          )}
        </View>

        {/* Segmented choices */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[
              styles.segment,
              styles.segmentLeft,
              selection === 'loved' && styles.segmentSelected,
            ]}
            onPress={() => handleSelection(showId, 'loved')}>
            <Text
              style={[
                styles.segmentText,
                selection === 'loved' && styles.segmentTextSelected,
              ]}>
              Loved
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segment,
              styles.segmentMiddle,
              selection === 'not_for_me' && styles.segmentSelected,
            ]}
            onPress={() => handleSelection(showId, 'not_for_me')}>
            <Text
              style={[
                styles.segmentText,
                selection === 'not_for_me' && styles.segmentTextSelected,
              ]}>
              Not for me
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segment,
              styles.segmentRight,
              selection === 'not_seen' && styles.segmentSelected,
            ]}
            onPress={() => handleSelection(showId, 'not_seen')}>
            <Text
              style={[
                styles.segmentText,
                selection === 'not_seen' && styles.segmentTextSelected,
              ]}>
              Not seen
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading shows...</Text>
        </View>
      </Screen>
    );
  }

  const selectionCount = getSelectionCount();

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Rate a few shows</Text>
        <Text style={styles.subtitle}>
          Help us understand your taste. Rate at least 5 shows to continue.
        </Text>

        {shows.length > 0 ? (
          <FlatList
            data={shows}
            renderItem={renderShowRow}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No shows available</Text>
          </View>
        )}

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <Text
            style={[
              styles.progressText,
              canContinue && styles.progressTextComplete,
            ]}>
            {selectionCount} / 5 rated
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <Button
            variant="primary"
            onPress={handleContinue}
            loading={saving}
            disabled={!canContinue || saving}>
            Continue
          </Button>
          <Button
            variant="ghost"
            onPress={handleSkip}
            disabled={saving}
            style={styles.skipButton}>
            Skip for now
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.muted,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  list: {
    paddingBottom: spacing.md,
  },
  showRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  poster: {
    width: 56,
    height: 84,
    borderRadius: 10,
    marginRight: spacing.md,
    backgroundColor: colors.border,
  },
  showInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  showTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  showDate: {
    fontSize: 13,
    color: colors.muted,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  segment: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLeft: {
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
  },
  segmentMiddle: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  segmentRight: {
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  segmentSelected: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  segmentTextSelected: {
    color: '#fff',
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  progressTextComplete: {
    color: colors.primary,
  },
  buttonContainer: {
    width: '100%',
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  skipButton: {
    marginTop: spacing.sm,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.muted,
  },
  emptyText: {
    fontSize: 16,
    color: colors.muted,
  },
});
