import { useCallback, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../ui/theme';
import SwipeableCard from './SwipeableCard';
import { SwipeableShow } from './types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - spacing.md * 2;

interface CardStackProps {
  shows: SwipeableShow[];
  onSwipe: (showId: string, action: 'saved' | 'watched' | 'dismissed') => void;
  maxHeight?: number;
}

export default function CardStack({ shows, onSwipe, maxHeight }: CardStackProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const visibleCards = shows.slice(currentIndex, currentIndex + 3);
  
  // Calculate card height based on available space
  // Account for: top safe area, banner, CTA section (~180px), bottom tab bar (~80px), padding
  const calculatedHeight = maxHeight || Math.min(450, SCREEN_HEIGHT - insets.top - 100 - 180 - 80);

  const handleFirstInteraction = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  }, [hasInteracted]);

  const handleSwipe = useCallback(
    (action: 'saved' | 'watched' | 'dismissed') => {
      if (currentIndex < shows.length) {
        const showId = shows[currentIndex].show_id;
        onSwipe(showId, action);
        setCurrentIndex((prev) => prev + 1);
      }
    },
    [currentIndex, shows, onSwipe]
  );

  if (visibleCards.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No more shows to swipe</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height: calculatedHeight }]}>
      {visibleCards.map((show, index) => (
        <SwipeableCard
          key={`${show.show_id}-${currentIndex + index}`}
          show={show}
          index={index}
          onSwipe={handleSwipe}
          isTopCard={index === 0}
          onFirstInteraction={handleFirstInteraction}
          hasInteracted={hasInteracted}
          cardHeight={calculatedHeight}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    alignSelf: 'center',
    position: 'relative',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    fontSize: 18,
    color: colors.muted,
    textAlign: 'center',
  },
});
