import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DevModeBanner from '../components/DevModeBanner';
import ShowRow from '../components/ShowRow';
import {
  getMediaType,
  getShowDate,
  getShowTitle,
  searchShows,
  TMDBShow,
} from '../lib/tmdb';
import Button from '../ui/Button';
import Screen from '../ui/Screen';
import { colors, radius, spacing } from '../ui/theme';

export type SearchStackParamList = {
  SearchMain: undefined;
  // ShowDetail and RateShow are now in RootNavigator
};

type SearchScreenNavigationProp = NativeStackNavigationProp<
  SearchStackParamList,
  'SearchMain'
>;

export default function SearchScreen() {
  const navigation = useNavigation<SearchScreenNavigationProp>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBShow[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter a search query');
      return;
    }

    setLoading(true);
    try {
      const data = await searchShows(query.trim());
      setResults(data.results.filter((show) => show.poster_path));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to search');
    } finally {
      setLoading(false);
    }
  };

  const handleShowPress = (show: TMDBShow) => {
    const mediaType = getMediaType(show);
    // Navigate to root-level ShowDetail (go up to root navigator)
    const rootNavigation = navigation.getParent()?.getParent();
    if (rootNavigation) {
      (rootNavigation as any).navigate('ShowDetail', {
        tmdbId: show.id,
        mediaType,
      });
    }
  };

  const renderShowItem = ({ item }: { item: TMDBShow }) => (
    <ShowRow
      posterPath={item.poster_path}
      title={getShowTitle(item)}
      metaLine={getShowDate(item) || ''}
      secondaryLine={item.overview || ''}
      onPress={() => handleShowPress(item)}
    />
  );

  return (
    <Screen backgroundColor={colors.card}>
      <DevModeBanner />
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="Search movies and TV shows..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <Button
          variant="primary"
          onPress={handleSearch}
          loading={loading}
          disabled={loading}>
          Search
        </Button>
      </View>

      {loading && results.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderShowItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>
            Enter a search query to find shows
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 16,
    backgroundColor: colors.card,
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
    padding: spacing.md,
  },
});
