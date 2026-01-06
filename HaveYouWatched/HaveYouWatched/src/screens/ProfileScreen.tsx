import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DevModeBanner from '../components/DevModeBanner';
import ShowRow from '../components/ShowRow';
import { DEV_MODE, getCurrentUserId } from '../lib/dev';
import { formatTimeAgo } from '../lib/feed';
import { getUserRatings, UserRating } from '../lib/profile';
import { supabase } from '../lib/supabase';
import Button from '../ui/Button';
import Screen from '../ui/Screen';
import Section from '../ui/Section';
import { colors, spacing } from '../ui/theme';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  People: undefined;
};

type ProfileScreenNavigationProp = NativeStackNavigationProp<
  ProfileStackParamList,
  'ProfileMain'
>;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [ratings, setRatings] = useState<UserRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRatings();
  }, []);

  const loadRatings = async () => {
    setLoading(true);
    try {
      const userId = await getCurrentUserId();
      const userRatings = await getUserRatings(userId);
      setRatings(userRatings);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load ratings');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign out');
    }
  };

  const renderRatingItem = ({ item }: { item: UserRating }) => (
    <ShowRow
      posterPath={item.poster_path}
      title={item.show_title}
      metaLine={formatTimeAgo(item.created_at)}
      secondaryLine={`Enjoyment: ${item.enjoyment}/10`}
    />
  );

  const handleFindPeople = () => {
    navigation.navigate('People');
  };

  return (
    <Screen backgroundColor={colors.card}>
      <DevModeBanner />
      <View style={styles.content}>
        <Section
          title="My Ratings"
          rightAction={
            DEV_MODE
              ? {
                  label: 'Find people',
                  onPress: handleFindPeople,
                }
              : undefined
          }
        />

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : ratings.length > 0 ? (
          <FlatList
            data={ratings}
            renderItem={renderRatingItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
          />
        ) : (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No ratings yet</Text>
          </View>
        )}

        {!DEV_MODE && (
          <View style={styles.signOutContainer}>
            <Button variant="primary" onPress={handleSignOut}>
              Sign Out
            </Button>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.muted,
  },
  list: {
    paddingBottom: spacing.md,
  },
  signOutContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
});
