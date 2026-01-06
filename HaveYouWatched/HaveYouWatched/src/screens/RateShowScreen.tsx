import Slider from '@react-native-community/slider';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DevModeBanner from '../components/DevModeBanner';
import { RatingData, ShowData, upsertRating, upsertShow } from '../lib/db';
import { DEV_USER_ID, getCurrentUserId } from '../lib/dev';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { colors, radius, spacing } from '../ui/theme';
import { RootStackParamList } from '../navigation/RootNavigator';

type RateShowRouteProp = RouteProp<RootStackParamList, 'RateShow'>;
type RateShowNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RateShow'
>;

const AVAILABLE_TAGS = ['easy watch', 'slow burn', 'couples', 'smart TV'];

type Sentiment = 'loved' | 'ok' | 'not_for_me';

interface SentimentDefaults {
  enjoyment: number;
  hook: number;
  consistency: number;
  payoff: number;
  heat: number;
  recommend: boolean;
}

// Helper function to map sentiment to default values
function getSentimentDefaults(sentiment: Sentiment): SentimentDefaults {
  switch (sentiment) {
    case 'loved':
      return {
        enjoyment: 9,
        hook: 8,
        consistency: 8,
        payoff: 8,
        heat: 7,
        recommend: true,
      };
    case 'ok':
      return {
        enjoyment: 6,
        hook: 6,
        consistency: 6,
        payoff: 6,
        heat: 5,
        recommend: true,
      };
    case 'not_for_me':
      return {
        enjoyment: 3,
        hook: 4,
        consistency: 5,
        payoff: 4,
        heat: 4,
        recommend: false,
      };
  }
}

// Infer sentiment from enjoyment value
function inferSentimentFromEnjoyment(enjoyment: number): Sentiment | null {
  if (enjoyment >= 8) return 'loved';
  if (enjoyment >= 5 && enjoyment <= 7) return 'ok';
  if (enjoyment <= 4) return 'not_for_me';
  return null;
}

// Check if rating values differ from sentiment defaults by >=2 on any dimension
function hasNonDefaultDetails(
  sentiment: Sentiment | null,
  hook: number,
  consistency: number,
  payoff: number,
  heat: number,
  enjoyment: number
): boolean {
  if (!sentiment) return false;
  const defaults = getSentimentDefaults(sentiment);
  return (
    Math.abs(hook - defaults.hook) >= 2 ||
    Math.abs(consistency - defaults.consistency) >= 2 ||
    Math.abs(payoff - defaults.payoff) >= 2 ||
    Math.abs(heat - defaults.heat) >= 2 ||
    Math.abs(enjoyment - defaults.enjoyment) >= 2
  );
}

export default function RateShowScreen() {
  const navigation = useNavigation<RateShowNavigationProp>();
  const route = useRoute<RateShowRouteProp>();
  const { show, initialRating } = route.params;

  // Initialize sentiment from existing rating or null
  const initialSentiment = initialRating
    ? inferSentimentFromEnjoyment(initialRating.enjoyment)
    : null;

  const [simpleSentiment, setSimpleSentiment] = useState<Sentiment | null>(
    initialSentiment
  );
  const [hook, setHook] = useState(initialRating?.hook ?? 0);
  const [consistency, setConsistency] = useState(initialRating?.consistency ?? 0);
  const [payoff, setPayoff] = useState(initialRating?.payoff ?? 0);
  const [heat, setHeat] = useState(initialRating?.heat ?? 0);
  const [enjoyment, setEnjoyment] = useState(initialRating?.enjoyment ?? 0);
  const [recommend, setRecommend] = useState(initialRating?.recommend || false);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialRating?.tags || []
  );
  const [showDetails, setShowDetails] = useState(false);
  const [recommendManuallyToggled, setRecommendManuallyToggled] = useState(
    !!initialRating
  ); // If editing, consider recommend as already set
  const [loading, setLoading] = useState(false);
  const [isInitialMount, setIsInitialMount] = useState(true);

  // Track if details were manually adjusted
  const [detailsAdjusted, setDetailsAdjusted] = useState(false);

  // Check if existing rating has non-default details
  const hasNonDefault = initialRating
    ? hasNonDefaultDetails(
        initialSentiment,
        initialRating.hook,
        initialRating.consistency,
        initialRating.payoff,
        initialRating.heat,
        initialRating.enjoyment
      )
    : false;

  // When sentiment changes (after initial mount), update defaults
  useEffect(() => {
    // Skip on initial mount to preserve existing rating values
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }

    if (simpleSentiment) {
      const defaults = getSentimentDefaults(simpleSentiment);
      setHook(defaults.hook);
      setConsistency(defaults.consistency);
      setPayoff(defaults.payoff);
      setHeat(defaults.heat);
      setEnjoyment(defaults.enjoyment);
      if (!recommendManuallyToggled) {
        setRecommend(defaults.recommend);
      }
    }
  }, [simpleSentiment, recommendManuallyToggled, isInitialMount]);

  // Track when sliders are adjusted
  const handleSliderChange = (
    setter: (value: number) => void,
    value: number
  ) => {
    setter(value);
    setDetailsAdjusted(true);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSentimentSelect = (sentiment: Sentiment) => {
    setSimpleSentiment(sentiment);
    setDetailsAdjusted(false); // Reset when sentiment changes
  };

  const handleRecommendToggle = (value: boolean) => {
    setRecommend(value);
    setRecommendManuallyToggled(true);
  };

  const handleSubmit = async () => {
    // Validate that a sentiment is selected
    if (!simpleSentiment) {
      Alert.alert('Error', 'Please select how you felt about this show');
      return;
    }

    setLoading(true);
    try {
      console.log('DEV_USER_ID used for rating:', DEV_USER_ID);

      const showData: ShowData = {
        id: show.id.toString(),
        title: (show.title || show.name || 'Unknown') as string,
        poster_path: show.poster_path,
        overview: show.overview,
        first_air_date: show.first_air_date || show.release_date || null,
      };

      await upsertShow(showData);

      const userId = await getCurrentUserId();

      const ratingData: RatingData = {
        user_id: userId,
        show_id: show.id.toString(),
        hook,
        consistency,
        payoff,
        heat,
        enjoyment,
        recommend,
        tags: selectedTags,
      };

      await upsertRating(ratingData);

      Alert.alert('Success', 'Rating saved successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save rating');
      setLoading(false);
    }
  };

  const renderRatingSlider = (
    label: string,
    value: number,
    onValueChange: (value: number) => void
  ) => (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.valuePill}>
        <Text style={styles.valuePillText}>{value}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={10}
        step={1}
        value={value}
        onValueChange={(val) => handleSliderChange(onValueChange, val)}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
        disabled={loading}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <DevModeBanner />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.title}>Rate Show</Text>
          <Text style={styles.showTitle}>
            {show.title || show.name || 'Unknown'}
          </Text>

          {/* Level 1: Quick Rating */}
          <Card style={styles.level1Card}>
            <Text style={styles.level1Title}>Quick rating</Text>

            {/* Sentiment Pills */}
            <View style={styles.sentimentContainer}>
              <TouchableOpacity
                style={[
                  styles.sentimentPill,
                  simpleSentiment === 'loved' && styles.sentimentPillSelected,
                ]}
                onPress={() => handleSentimentSelect('loved')}
                disabled={loading}>
                <Text
                  style={[
                    styles.sentimentPillText,
                    simpleSentiment === 'loved' && styles.sentimentPillTextSelected,
                  ]}>
                  Loved
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sentimentPill,
                  simpleSentiment === 'ok' && styles.sentimentPillSelected,
                ]}
                onPress={() => handleSentimentSelect('ok')}
                disabled={loading}>
                <Text
                  style={[
                    styles.sentimentPillText,
                    simpleSentiment === 'ok' && styles.sentimentPillTextSelected,
                  ]}>
                  It was OK
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sentimentPill,
                  simpleSentiment === 'not_for_me' && styles.sentimentPillSelected,
                ]}
                onPress={() => handleSentimentSelect('not_for_me')}
                disabled={loading}>
                <Text
                  style={[
                    styles.sentimentPillText,
                    simpleSentiment === 'not_for_me' &&
                      styles.sentimentPillTextSelected,
                  ]}>
                  Not for me
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recommend Switch */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Recommend</Text>
              <Switch
                value={recommend}
                onValueChange={handleRecommendToggle}
                disabled={loading}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            {/* Tags */}
            <View style={styles.tagsSection}>
              <Text style={styles.tagsLabel}>Add tags (optional)</Text>
              <View style={styles.tagsContainer}>
                {AVAILABLE_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.tag,
                        isSelected ? styles.tagSelected : styles.tagOutline,
                      ]}
                      onPress={() => toggleTag(tag)}
                      disabled={loading}>
                      <Text
                        style={[
                          styles.tagText,
                          isSelected && styles.tagTextSelected,
                        ]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Card>

          {/* Level 2: Details Toggle */}
          <TouchableOpacity
            style={styles.detailsToggle}
            onPress={() => setShowDetails(!showDetails)}
            disabled={loading}>
            <Text style={styles.detailsToggleText}>
              {showDetails ? 'Hide details' : 'Add details'}
            </Text>
            {hasNonDefault && !showDetails && (
              <Text style={styles.detailsSavedLabel}>Details saved</Text>
            )}
          </TouchableOpacity>

          {/* Level 2: Detailed Sliders */}
          {showDetails && (
            <Card style={styles.level2Card}>
              {renderRatingSlider('Hook', hook, setHook)}
              {renderRatingSlider('Consistency', consistency, setConsistency)}
              {renderRatingSlider('Payoff', payoff, setPayoff)}
              {renderRatingSlider('Heat', heat, setHeat)}
              {renderRatingSlider('Enjoyment', enjoyment, setEnjoyment)}
            </Card>
          )}
        </View>
      </ScrollView>
      <View style={styles.stickyButton}>
        <Button
          variant="primary"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading || !simpleSentiment}>
          Save
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
    color: colors.text,
  },
  showTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.lg,
    color: colors.muted,
  },
  level1Card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  level1Title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  sentimentContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  sentimentPill: {
    flex: 1,
    minWidth: 100,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentimentPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sentimentPillText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  sentimentPillTextSelected: {
    color: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  tagsSection: {
    marginBottom: 0,
  },
  tagsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  tagOutline: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  tagSelected: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  tagTextSelected: {
    color: '#fff',
  },
  detailsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  detailsToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  detailsSavedLabel: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: 'italic',
  },
  level2Card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  ratingRow: {
    marginBottom: spacing.md,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  valuePill: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  valuePillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: spacing.xs,
  },
  stickyButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
