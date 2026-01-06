import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// @ts-ignore - @expo/vector-icons is available in Expo projects
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getCurrentUserId } from '../../lib/dev';
import { completeOnboarding } from '../../lib/onboarding';
import { calculateSimilarity } from '../../lib/reco';
import { supabase } from '../../lib/supabase';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import Screen from '../../ui/Screen';
import Section from '../../ui/Section';
import { colors, radius, spacing } from '../../ui/theme';

type FindFriendsScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'FindFriends'
>;

interface Profile {
  id: string;
  username: string;
  matchPercent?: number; // Similarity as percentage (0-100)
}

interface PopularUser extends Profile {
  ratingsCount: number;
  matchPercent?: number; // Similarity as percentage (0-100)
}

export default function FindFriendsScreen() {
  const navigation = useNavigation<FindFriendsScreenNavigationProp>();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [popularUsers, setPopularUsers] = useState<PopularUser[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [userRatingsMap, setUserRatingsMap] = useState<Map<string, number>>(
    new Map()
  );
  const [completing, setCompleting] = useState(false);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const userId = await getCurrentUserId();

      // Load current user's ratings for similarity calculation
      const { data: myRatings, error: myRatingsError } = await supabase
        .from('ratings')
        .select('show_id, enjoyment')
        .eq('user_id', userId);

      const localUserRatingsMap = new Map<string, number>();
      if (!myRatingsError && myRatings) {
        myRatings.forEach((rating) => {
          localUserRatingsMap.set(rating.show_id, rating.enjoyment);
        });
      }
      setUserRatingsMap(localUserRatingsMap);

      // Load all profiles (for "People you may know")
      const { data: allProfilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username')
        .neq('id', userId)
        .order('username', { ascending: true });

      if (profilesError) {
        console.error('Raw Supabase error:', profilesError);
        throw new Error(
          `Failed to load profiles: ${profilesError.message}. Operation: SELECT from profiles`
        );
      }

      // Load popular users (ratings in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      const { data: recentRatings, error: ratingsError } = await supabase
        .from('ratings')
        .select('user_id, profiles!inner(id, username)')
        .gte('created_at', sevenDaysAgoISO)
        .neq('user_id', userId);

      if (ratingsError) {
        console.error('Error loading recent ratings:', ratingsError);
        setPopularUsers([]);
      } else {
        // Group by user_id and count
        const userCounts = new Map<string, { count: number; username: string }>();
        recentRatings?.forEach((rating: any) => {
          const userId = rating.user_id;
          const profileData = Array.isArray(rating.profiles)
            ? rating.profiles[0]
            : rating.profiles;
          const username = profileData?.username || 'Unknown';

          if (!userCounts.has(userId)) {
            userCounts.set(userId, { count: 0, username });
          }
          userCounts.get(userId)!.count++;
        });

        // Convert to array and sort by count descending
        let popular: PopularUser[] = Array.from(userCounts.entries())
          .map(([id, data]) => ({
            id,
            username: data.username,
            ratingsCount: data.count,
          }))
          .sort((a, b) => b.ratingsCount - a.ratingsCount);

        // Calculate similarity for popular users if we have user ratings
        if (localUserRatingsMap.size >= 3 && popular.length > 0) {
          const popularUserIds = popular.map((p) => p.id);
          const { data: popularRatings, error: popularRatingsError } = await supabase
            .from('ratings')
            .select('user_id, show_id, enjoyment')
            .in('user_id', popularUserIds);

          if (!popularRatingsError && popularRatings) {
            // Group ratings by user_id
            const popularRatingsGroups = new Map<string, Map<string, number>>();
            popularRatings.forEach((rating: any) => {
              if (!popularRatingsGroups.has(rating.user_id)) {
                popularRatingsGroups.set(rating.user_id, new Map());
              }
              popularRatingsGroups.get(rating.user_id)!.set(rating.show_id, rating.enjoyment);
            });

            // Calculate similarity for each popular user
            popular = popular.map((user) => {
              const otherRatings = popularRatingsGroups.get(user.id);
              if (!otherRatings || otherRatings.size === 0) {
                return user; // No ratings, no match
              }

              const similarity = calculateSimilarity(localUserRatingsMap, otherRatings);
              // Only include match if >=3 shared shows (similarity > 0.3)
              if (similarity > 0.3) {
                return {
                  ...user,
                  matchPercent: Math.round(similarity * 100),
                };
              }
              return user;
            });
          }
        }

        setPopularUsers(popular);
      }

      // Load follows
      const { data: follows, error: followsError } = await supabase
        .from('follows')
        .select('followee_id')
        .eq('follower_id', userId);

      if (followsError) {
        throw new Error(
          `Failed to load follows: ${followsError.message}. Operation: SELECT from follows`
        );
      }

      const followedSet = new Set(
        follows ? follows.map((f: any) => f.followee_id) : []
      );

      setAllProfiles(allProfilesData || []);
      setFollowedIds(followedSet);

      // Calculate similarity for each profile if we have user ratings
      if (localUserRatingsMap.size >= 3 && allProfilesData && allProfilesData.length > 0) {
        // Load all other users' ratings in bulk
        const { data: allRatings, error: allRatingsError } = await supabase
          .from('ratings')
          .select('user_id, show_id, enjoyment')
          .in('user_id', allProfilesData.map((p) => p.id));

        if (!allRatingsError && allRatings) {
          // Group ratings by user_id
          const userRatingsGroups = new Map<string, Map<string, number>>();
          allRatings.forEach((rating: any) => {
            if (!userRatingsGroups.has(rating.user_id)) {
              userRatingsGroups.set(rating.user_id, new Map());
            }
            userRatingsGroups.get(rating.user_id)!.set(rating.show_id, rating.enjoyment);
          });

          // Calculate similarity for each profile
          const profilesWithMatch = allProfilesData.map((profile) => {
            const otherRatings = userRatingsGroups.get(profile.id);
            if (!otherRatings || otherRatings.size === 0) {
              return profile; // No ratings, no match
            }

            const similarity = calculateSimilarity(localUserRatingsMap, otherRatings);
            // Only include match if >=3 shared shows (similarity > 0.3)
            if (similarity > 0.3) {
              return {
                ...profile,
                matchPercent: Math.round(similarity * 100),
              };
            }
            return profile;
          });

          setAllProfiles(profilesWithMatch);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  // Filter profiles client-side based on debounced query
  const filteredProfiles = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return allProfiles;
    }
    const query = debouncedQuery.toLowerCase().trim();
    return allProfiles.filter((profile) =>
      profile.username.toLowerCase().includes(query)
    );
  }, [allProfiles, debouncedQuery]);

  const handleFollowToggle = async (profile: Profile | PopularUser) => {
    const isCurrentlyFollowing = followedIds.has(profile.id);
    const previousFollowedIds = new Set(followedIds);

    setFollowedIds((prev) => {
      const newSet = new Set(prev);
      if (isCurrentlyFollowing) {
        newSet.delete(profile.id);
      } else {
        newSet.add(profile.id);
      }
      return newSet;
    });

    setActionLoading(profile.id);

    try {
      const userId = await getCurrentUserId();

      if (isCurrentlyFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', userId)
          .eq('followee_id', profile.id);

        if (error) {
          setFollowedIds(previousFollowedIds);
          throw new Error(
            `Failed to unfollow: ${error.message}. Operation: DELETE from follows`
          );
        }
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: userId,
          followee_id: profile.id,
        });

        if (error) {
          setFollowedIds(previousFollowedIds);
          throw new Error(
            `Failed to follow: ${error.message}. Operation: INSERT into follows`
          );
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update follow status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleInviteFriends = async () => {
    try {
      const result = await Share.share({
        message: 'Check out HaveYouWatched! Discover shows and movies based on what you and your friends love. https://haveyouwatched.app',
        title: 'Invite to HaveYouWatched',
      });

      if (result.action === Share.sharedAction) {
        // User shared successfully
        console.log('Shared successfully');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to share');
    }
  };

  const handleContinue = async () => {
    setCompleting(true);
    try {
      await completeOnboarding();
      // RootNavigator will detect the state change and navigate to Tabs
    } catch (error: any) {
      console.error('Failed to complete onboarding:', error);
      Alert.alert('Error', 'Failed to complete onboarding. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const handleSkip = async () => {
    setCompleting(true);
    try {
      await completeOnboarding();
      // RootNavigator will detect the state change and navigate to Tabs
    } catch (error: any) {
      console.error('Failed to complete onboarding:', error);
      Alert.alert('Error', 'Failed to complete onboarding. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const getInitials = (username: string): string => {
    return username.charAt(0).toUpperCase();
  };

  const renderProfileRow = (
    profile: Profile | PopularUser,
    subtitle?: string
  ) => {
    const isFollowing = followedIds.has(profile.id);
    const hasMatch = 'matchPercent' in profile && profile.matchPercent !== undefined;
    return (
      <Card style={styles.profileCard}>
        <View style={styles.profileContent}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(profile.username)}</Text>
            </View>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.usernameRow}>
              <Text style={styles.username}>@{profile.username}</Text>
              {hasMatch && (
                <View style={styles.matchPill}>
                  <Text style={styles.matchPillText}>
                    Match {profile.matchPercent}%
                  </Text>
                </View>
              )}
            </View>
            {subtitle && <Text style={styles.profileSubtitle}>{subtitle}</Text>}
          </View>
          <Button
            variant={isFollowing ? 'secondary' : 'primary'}
            onPress={() => handleFollowToggle(profile)}
            loading={actionLoading === profile.id}
            disabled={actionLoading === profile.id}>
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
        </View>
      </Card>
    );
  };

  const renderProfileItem = ({ item }: { item: Profile }) => {
    return renderProfileRow(item);
  };

  const renderPopularItem = ({ item }: { item: PopularUser }) => {
    const subtitle = `${item.ratingsCount} rating${item.ratingsCount !== 1 ? 's' : ''} this week`;
    return renderProfileRow(item, subtitle);
  };

  const renderEmptyState = () => {
    if (debouncedQuery.trim()) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>
            No results for '{debouncedQuery}'
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>
          No other users found. Seed profiles (alex/sarah) or disable RLS on
          profiles in DEV.
        </Text>
      </View>
    );
  };

  const renderSections = () => {
    if (debouncedQuery.trim()) {
      // Search mode: show filtered results
      return (
        <>
          <Section title="Results" />
          {filteredProfiles.length > 0 ? (
            <FlatList
              data={filteredProfiles}
              renderItem={renderProfileItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={false}
            />
          ) : (
            renderEmptyState()
          )}
        </>
      );
    }

    // Normal mode: show sections
    return (
      <>
        {/* People you may know */}
        <Section title="People you may know" />
        {allProfiles.length > 0 ? (
          <FlatList
            data={allProfiles}
            renderItem={renderProfileItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.sectionEmptyContainer}>
            <Text style={styles.sectionEmptyText}>No users found</Text>
          </View>
        )}

        {/* Popular this week */}
        <Section title="Popular this week" />
        {popularUsers.length > 0 ? (
          <FlatList
            data={popularUsers}
            renderItem={renderPopularItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.sectionEmptyContainer}>
            <Text style={styles.sectionEmptyText}>
              No ratings this week
            </Text>
          </View>
        )}
      </>
    );
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Find friends</Text>
        <Text style={styles.subtitle}>
          Follow people you know to see what they're watching and get better
          recommendations.
        </Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons
              name="search"
              size={20}
              color={colors.muted}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search people"
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.muted}
                  style={styles.clearIcon}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.scrollView}>
            {renderSections()}
          </View>
        )}

        {/* Invite friends button */}
        <View style={styles.inviteContainer}>
          <Button
            variant="secondary"
            onPress={handleInviteFriends}
            disabled={completing}>
            <View style={styles.inviteButtonContent}>
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={styles.inviteButtonText}>Invite friends</Text>
            </View>
          </Button>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <Button
            variant="primary"
            onPress={handleContinue}
            loading={completing}
            disabled={completing}>
            Continue
          </Button>
          <Button
            variant="ghost"
            onPress={handleSkip}
            disabled={completing}
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
  searchContainer: {
    marginBottom: spacing.md,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  clearIcon: {
    marginLeft: spacing.xs,
  },
  scrollView: {
    flex: 1,
    marginBottom: spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
  },
  list: {
    paddingBottom: spacing.md,
  },
  sectionEmptyContainer: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  sectionEmptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  profileCard: {
    marginBottom: spacing.xs,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarContainer: {
    marginRight: spacing.xs,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
    gap: spacing.xs,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  matchPill: {
    backgroundColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  matchPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  profileSubtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  inviteContainer: {
    marginBottom: spacing.md,
  },
  inviteButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonContainer: {
    width: '100%',
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  skipButton: {
    marginTop: spacing.sm,
  },
});
