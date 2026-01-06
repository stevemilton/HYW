import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// @ts-ignore
import Ionicons from '@expo/vector-icons/Ionicons';
import { getMediaType, searchShows, TMDBShow } from '../lib/tmdb';
import { colors, radius, spacing } from '../ui/theme';

interface HomeSearchBarProps {
  onShowSelect?: (show: TMDBShow) => void;
}

export default function HomeSearchBar({ onShowSelect }: HomeSearchBarProps) {
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const data = await searchShows(query.trim());
      const results = data.results.filter((show) => show.poster_path);
      if (results.length > 0 && onShowSelect) {
        onShowSelect(results[0]);
      } else if (results.length > 0) {
        // Navigate to first result via root navigator
        const show = results[0];
        const mediaType = getMediaType(show);
        const rootNavigation = navigation.getParent()?.getParent();
        if (rootNavigation) {
          (rootNavigation as any).navigate('ShowDetail', {
            tmdbId: show.id,
            mediaType,
          });
        }
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Search for a show or movie..."
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
              returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={colors.muted} />
          </TouchableOpacity>
        )}
        {loading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  clearButton: {
    marginLeft: spacing.xs,
    padding: spacing.xs,
  },
});

