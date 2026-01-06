import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CardStack from '../components/CardStack';
import DevModeBanner from '../components/DevModeBanner';
import HomeSearchBar from '../components/HomeSearchBar';
import QuickRateModal from '../components/QuickRateModal';
import Toast from '../components/Toast';
import { SwipeableShow } from '../components/types';
import { recordWatchAction } from '../lib/actions';
import { computeRecommendStats } from '../lib/aggregates';
import { getCurrentUserId } from '../lib/dev';
import { getHomePicks } from '../lib/homePicks';
import {
  fetchCriticallyLoved,
  fetchFriendsTrending,
  fetchPopularThisWeek,
  ShelfItem,
} from '../lib/inspirationShelves';
import { DeckMode } from '../lib/reco';
import { supabase } from '../lib/supabase';
import { getMediaType } from '../lib/tmdb';
import { RootTabParamList } from '../navigation/AppNavigator';
import Button from '../ui/Button';
import Screen from '../ui/Screen';
import { colors, radius, spacing } from '../ui/theme';
type FeedScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'Home'>;

type HomeMode = 'decision' | 'inspiration';

const DECISION_MODE_THRESHOLD = 3;

export default function FeedScreen() {
  const navigation = useNavigation<FeedScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  
  const [homeMode, setHomeMode] = useState<HomeMode>('decision');
  const [shows, setShows] = useState<SwipeableShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickRateVisible, setQuickRateVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  // Session-level interaction state: tracks if user has meaningfully interacted this session
  // Resets on app reload (no persistence). Used to determine when to show Inspiration Mode.
  const [hasInteractedThisSession, setHasInteractedThisSession] = useState(false);
  // Inspiration Mode shelves
  const [popularThisWeek, setPopularThisWeek] = useState<ShelfItem[]>([]);
  const [friendsTrending, setFriendsTrending] = useState<ShelfItem[]>([]);
  const [criticallyLoved, setCriticallyLoved] = useState<ShelfItem[]>([]);
  const [shelvesLoading, setShelvesLoading] = useState(false);
  // Context explanation for Decision Mode
  const [contextExplanation, setContextExplanation] = useState<string>('');

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  }, []);

  // Fetch recommendations with filtering
  const fetchRecommendations = useCallback(async (mode: DeckMode = 'tonight', isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const userId = await getCurrentUserId();

      // Fetch home picks with guaranteed fallback (exclusions handled internally)
      // Always use 'tonight' mode since segmented control is removed
      const homePicks = await getHomePicks(userId, 'tonight');

      // Convert to SwipeableShow format and fetch recommend stats
      const swipeableShows: SwipeableShow[] = await Promise.all(
        homePicks.map(async (pick) => {
          // If stats are already computed, use them; otherwise fetch
          if (pick.overallPercent !== null || pick.followingPercent !== null) {
            return {
              show_id: pick.show_id,
              title: pick.title,
              poster_path: pick.poster_path,
              score: pick.score,
              followingPercent: pick.followingPercent,
              overallPercent: pick.overallPercent,
              explanation: pick.explanation,
              tags: pick.tags,
            };
          }

          // Fetch recommend stats if not already computed
          const { data: ratings } = await supabase
            .from('ratings')
            .select('recommend')
            .eq('show_id', pick.show_id)
            .limit(500);

          const stats = computeRecommendStats(ratings || []);

          return {
            show_id: pick.show_id,
            title: pick.title,
            poster_path: pick.poster_path,
            score: pick.score,
            followingPercent: pick.followingPercent,
            overallPercent: stats.percent,
            explanation: pick.explanation,
            tags: pick.tags,
          };
        })
      );

      setShows(swipeableShows);

      // Update context explanation for Decision Mode
      if (swipeableShows.length > 0) {
        const topShow = swipeableShows[0];
        // Extract usernames from explanation if available
        const explanation = topShow.explanation || '';
        const followMatch = explanation.match(/@(\w+)/g);
        if (followMatch && followMatch.length > 0) {
          const usernames = followMatch.map((m) => m.substring(1)).slice(0, 2);
          setContextExplanation(`Because you follow @${usernames.join(' and @')}`);
        } else {
          setContextExplanation('Trending in the UK today');
        }
      } else {
        setContextExplanation('');
      }

      // Home mode selection logic:
      // - If picks.length === 0 → Inspiration Mode (no picks available)
      // - Else if picks.length < 3 AND hasInteractedThisSession === true → Inspiration Mode (depleted after interaction)
      // - Else → Decision Mode (show swipe deck on first load if at least 1 pick exists)
      // This ensures swipe deck always shows on first load when possible, and Inspiration Mode
      // only appears as a post-depletion state after meaningful user interaction.
      const targetMode: HomeMode = 
        swipeableShows.length === 0 
          ? 'inspiration'
          : swipeableShows.length < DECISION_MODE_THRESHOLD && hasInteractedThisSession
          ? 'inspiration'
          : 'decision';
      
      setHomeMode((currentMode) => {
        if (currentMode !== targetMode) {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setHomeMode(targetMode);
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }).start();
          });
        }
        return currentMode;
      });
    } catch (error: any) {
      console.error('Failed to fetch recommendations:', error);
      Alert.alert('Error', error.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fadeAnim, hasInteractedThisSession]);

  // Fetch inspiration shelves when in inspiration mode
  const fetchInspirationShelves = useCallback(async () => {
    setShelvesLoading(true);
    try {
      const userId = await getCurrentUserId();
      const [popular, friends, loved] = await Promise.all([
        fetchPopularThisWeek(userId),
        fetchFriendsTrending(userId),
        fetchCriticallyLoved(userId),
      ]);
      setPopularThisWeek(popular);
      setFriendsTrending(friends);
      setCriticallyLoved(loved);
    } catch (error: any) {
      console.error('Failed to fetch inspiration shelves:', error);
    } finally {
      setShelvesLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchRecommendations('tonight', false);
  }, [fetchRecommendations]);

  // Fetch shelves when switching to inspiration mode
  useEffect(() => {
    if (homeMode === 'inspiration' && !loading) {
      fetchInspirationShelves();
    }
  }, [homeMode, loading, fetchInspirationShelves]);

  const handleRefresh = useCallback(() => {
    fetchRecommendations('tonight', true).then(() => {
      showToast('Refreshed');
    });
  }, [fetchRecommendations, showToast]);

  const advanceCard = useCallback(
    (showId: string) => {
      // Mark interaction: user has meaningfully engaged with the deck
      setHasInteractedThisSession(true);
      
      setShows((prev) => {
        const updated = prev.filter((show) => show.show_id !== showId);
        // Auto-switch to inspiration if below threshold after interaction
        if (updated.length < DECISION_MODE_THRESHOLD && updated.length > 0) {
          setTimeout(() => {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              setHomeMode('inspiration');
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }).start();
            });
          }, 100);
        } else if (updated.length === 0) {
          // No picks left, switch to inspiration
          setTimeout(() => {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              setHomeMode('inspiration');
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }).start();
            });
          }, 100);
        }
        return updated;
      });
    },
    [fadeAnim]
  );

  const handleSwipeWatched = useCallback(() => {
    if (shows.length > 0) {
      setQuickRateVisible(true);
    }
  }, [shows]);

  const handleSwipe = useCallback(
    async (showId: string, action: 'saved' | 'watched' | 'dismissed') => {
      // Mark interaction: user swiped a card
      setHasInteractedThisSession(true);
      
      try {
        if (action === 'watched') {
          handleSwipeWatched();
          return;
        }

        await recordWatchAction({
          showId,
          action,
        });

        advanceCard(showId);

        if (action === 'saved') {
          showToast('Added to Watchlist');
        } else if (action === 'dismissed') {
          showToast('Hidden for 30 days');
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to record action');
      }
    },
    [advanceCard, showToast, handleSwipeWatched]
  );

  const handleWatched = useCallback(() => {
    if (shows.length > 0) {
      // Mark interaction: user tapped Watched button
      setHasInteractedThisSession(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQuickRateVisible(true);
    }
  }, [shows]);

  const handleWatchlist = useCallback(() => {
    if (shows.length > 0) {
      // Mark interaction: user tapped Save/Watchlist button
      setHasInteractedThisSession(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const topShow = shows[0];
      handleSwipe(topShow.show_id, 'saved');
    }
  }, [shows, handleSwipe]);

  const handleQuickRateSave = useCallback(() => {
    if (shows.length > 0) {
      // Mark interaction: user saved a rating
      setHasInteractedThisSession(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const topShow = shows[0];
      recordWatchAction({
        showId: topShow.show_id,
        action: 'watched',
      }).catch((error) => {
        console.error('Failed to record watched action:', error);
      });
      advanceCard(topShow.show_id);
      showToast('Saved');
    }
  }, [shows, advanceCard, showToast]);

  const handleShowSelect = useCallback(
    (show: any) => {
      // Determine mediaType from show data
      // If show has mediaType property (from shelf items), use it
      // Otherwise determine from show properties
      let mediaType: 'movie' | 'tv' = show.mediaType || 'tv'; // default to tv
      if (!show.mediaType) {
        if (show.media_type === 'movie' || show.release_date) {
          mediaType = 'movie';
        } else if (show.media_type === 'tv' || show.first_air_date) {
          mediaType = 'tv';
        } else {
          // Fallback to getMediaType helper
          mediaType = getMediaType(show);
        }
      }
      
      // Navigate to root-level ShowDetail (go up to root navigator)
      const rootNavigation = navigation.getParent()?.getParent();
      if (rootNavigation) {
        (rootNavigation as any).navigate('ShowDetail', {
          tmdbId: show.id,
          mediaType,
        });
      }
    },
    [navigation]
  );

  const handleOverflow = useCallback(() => {
    if (shows.length === 0) return;

    // Mark interaction: user opened overflow menu (will mark again on action selection)
    setHasInteractedThisSession(true);

    const options = ['Hide for 30 days', 'Cancel'];
    const cancelButtonIndex = 1;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleSwipe(shows[0].show_id, 'dismissed');
          }
        }
      );
    } else {
      Alert.alert(
        'More options',
        undefined,
        [
          {
            text: 'Hide for 30 days',
            onPress: () => handleSwipe(shows[0].show_id, 'dismissed'),
          },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );
    }
  }, [shows, handleSwipe]);

  const currentShow = shows.length > 0 ? shows[0] : null;
  // Calculate card height to ensure everything fits on screen
  const cardMaxHeight =
    Dimensions.get('window').height -
    insets.top -
    30 - // banner
    140 - // CTA section (reduced)
    80 - // bottom tab bar
    spacing.md * 2 - // padding
    100; // context header space

  // Debug log
  console.log("HOME DEBUG", {
    mode: homeMode,
    picksLen: shows?.length,
    cardsLen: shows?.length,
    loading,
    hasInteractedThisSession,
  });

  return (
    <Screen backgroundColor={colors.bg}>
      <DevModeBanner />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {loading ? (
          <View style={styles.centerContainer}>
            <Text style={styles.loadingText}>Loading picks...</Text>
          </View>
        ) : homeMode === 'decision' ? (
          <View style={styles.container}>
            {/* Context Header */}
            <View style={styles.contextHeader}>
              <Text style={styles.appTitle}>HaveYouWatched</Text>
              {contextExplanation && (
                <Text style={styles.contextExplanation}>{contextExplanation}</Text>
              )}
            </View>

            <CardStack shows={shows} onSwipe={handleSwipe} maxHeight={cardMaxHeight} />

            {currentShow && (
              <View style={styles.ctaSection}>
                <View style={styles.ctaHeader}>
                  <Text style={styles.ctaTitle}>Have You Watched?</Text>
                  <Text style={styles.ctaSubtitle}>
                    Rate it to improve your picks
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  <Button
                    variant="primary"
                    onPress={handleWatched}
                    style={styles.primaryButton}>
                    Watched
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={handleWatchlist}
                    style={styles.primaryButton}>
                    Watchlist
                  </Button>
                  <TouchableOpacity
                    style={styles.overflowButton}
                    onPress={handleOverflow}>
                    <Text style={styles.overflowButtonText}>⋯</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <ScrollView
            style={styles.inspirationContainer}
            contentContainerStyle={styles.inspirationContent}>
            <View style={styles.inspirationHeader}>
              <Text style={styles.inspirationTitle}>What people are watching</Text>
            </View>

            {/* Shelf: Popular this week */}
            {popularThisWeek.length > 0 && (
              <View style={styles.shelfContainer}>
                <Text style={styles.shelfTitle}>Popular this week</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {popularThisWeek.map((item) => (
                    <TouchableOpacity
                      key={item.show_id}
                      style={styles.shelfItem}
                      onPress={() => handleShowSelect({ 
                        id: parseInt(item.show_id), 
                        mediaType: item.mediaType || 'tv',
                        ...item 
                      })}>
                      {item.poster_path && (
                        <Image
                          source={{
                            uri: `https://image.tmdb.org/t/p/w342${item.poster_path}`,
                          }}
                          style={styles.shelfPoster}
                        />
                      )}
                      <Text style={styles.shelfItemTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.shelfItemLabel}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Shelf: Trending with friends */}
            {friendsTrending.length > 0 && (
              <View style={styles.shelfContainer}>
                <Text style={styles.shelfTitle}>Trending with friends</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {friendsTrending.map((item) => (
                    <TouchableOpacity
                      key={item.show_id}
                      style={styles.shelfItem}
                      onPress={() => handleShowSelect({ 
                        id: parseInt(item.show_id), 
                        mediaType: item.mediaType || 'tv',
                        ...item 
                      })}>
                      {item.poster_path && (
                        <Image
                          source={{
                            uri: `https://image.tmdb.org/t/p/w342${item.poster_path}`,
                          }}
                          style={styles.shelfPoster}
                        />
                      )}
                      <Text style={styles.shelfItemTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.shelfItemLabel}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Shelf: Critically loved */}
            {criticallyLoved.length > 0 && (
              <View style={styles.shelfContainer}>
                <Text style={styles.shelfTitle}>Critically loved</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {criticallyLoved.map((item) => (
                    <TouchableOpacity
                      key={item.show_id}
                      style={styles.shelfItem}
                      onPress={() => handleShowSelect({ 
                        id: parseInt(item.show_id), 
                        mediaType: item.mediaType || 'tv',
                        ...item 
                      })}>
                      {item.poster_path && (
                        <Image
                          source={{
                            uri: `https://image.tmdb.org/t/p/w342${item.poster_path}`,
                          }}
                          style={styles.shelfPoster}
                        />
                      )}
                      <Text style={styles.shelfItemTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.shelfItemLabel}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Search bar (secondary, after shelves) */}
            <View style={styles.searchSection}>
              <HomeSearchBar onShowSelect={handleShowSelect} />
            </View>
          </ScrollView>
        )}
      </Animated.View>

      {currentShow && (
        <QuickRateModal
          visible={quickRateVisible}
          show={{
            id: currentShow.show_id,
            title: currentShow.title,
            overview: '',
            poster_path: currentShow.poster_path,
          }}
          onClose={() => setQuickRateVisible(false)}
          onSave={handleQuickRateSave}
        />
      )}

      <Toast message={toastMessage} visible={toastVisible} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md - 2,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.card,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  segmentTextActive: {
    color: colors.text,
  },
  refreshButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.muted,
  },
  ctaSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaHeader: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  ctaSubtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
  },
  overflowButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowButtonText: {
    fontSize: 24,
    color: colors.text,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  inspirationContainer: {
    flex: 1,
  },
  inspirationContent: {
    padding: spacing.md,
  },
  inspirationHeader: {
    marginBottom: spacing.lg,
  },
  inspirationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  inspirationSubtext: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  refreshPicksButton: {
    marginBottom: spacing.lg,
  },
  suggestionsContainer: {
    marginTop: spacing.md,
  },
  suggestionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  suggestionPlaceholder: {
    fontSize: 14,
    color: colors.muted,
    fontStyle: 'italic',
  },
  contextHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  contextSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  contextExplanation: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  shelfContainer: {
    marginBottom: spacing.lg,
  },
  shelfTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  shelfItem: {
    width: 120,
    marginRight: spacing.md,
    marginLeft: spacing.md,
  },
  shelfPoster: {
    width: 120,
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  shelfItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  shelfItemLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  searchSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});
