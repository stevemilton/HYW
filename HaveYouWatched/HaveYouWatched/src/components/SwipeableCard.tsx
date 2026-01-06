import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { AccessibilityInfo, Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '../ui/theme';
import { SwipeableShow } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - spacing.md * 2;
const DEFAULT_CARD_HEIGHT = 500;
const SWIPE_THRESHOLD = 100;
const ROTATION_MAX = 15;

interface SwipeableCardProps {
  show: SwipeableShow;
  index: number;
  onSwipe: (action: 'saved' | 'watched' | 'dismissed') => void;
  isTopCard: boolean;
  onFirstInteraction?: () => void;
  hasInteracted?: boolean;
  cardHeight?: number;
}

export default function SwipeableCard({
  show,
  index,
  onSwipe,
  isTopCard,
  onFirstInteraction,
  hasInteracted = false,
  cardHeight = DEFAULT_CARD_HEIGHT,
}: SwipeableCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1 - index * 0.08);
  const opacity = useSharedValue(1 - index * 0.3);
  const offsetY = useSharedValue(index * 8);
  const hintOpacity = useSharedValue(isTopCard && !hasInteracted ? 0 : 0);
  const thresholdCrossed = useSharedValue(false);
  const reducedMotion = useSharedValue(false);

  // Check for reduced motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reducedMotion.value = enabled;
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reducedMotion.value = enabled;
    });
    return () => subscription?.remove();
  }, [reducedMotion]);

  // Trigger haptic feedback
  const triggerHaptic = (type: 'light' | 'medium') => {
    if (type === 'light') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // Fade in hints on mount (top card only)
  useEffect(() => {
    if (isTopCard && !hasInteracted) {
      hintOpacity.value = withTiming(0.5, { duration: 500 });
    }
  }, [isTopCard, hasInteracted, hintOpacity]);

  const panGesture = Gesture.Pan()
    .enabled(isTopCard)
    .onStart(() => {
      thresholdCrossed.value = false;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      rotation.value = (e.translationX / CARD_WIDTH) * ROTATION_MAX;

      // Check if threshold crossed (for haptic)
      const absX = Math.abs(e.translationX);
      const absY = Math.abs(e.translationY);
      if ((absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD) && !thresholdCrossed.value) {
        thresholdCrossed.value = true;
        runOnJS(triggerHaptic)('light');
        if (onFirstInteraction && !hasInteracted) {
          runOnJS(onFirstInteraction)();
        }
      }
    })
    .onEnd((e) => {
      const absX = Math.abs(e.translationX);
      const absY = Math.abs(e.translationY);

      if (absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD) {
        // Determine action based on swipe direction
        let action: 'saved' | 'watched' | 'dismissed';
        if (absX > absY) {
          action = e.translationX > 0 ? 'saved' : 'watched';
        } else {
          // Only allow swipe up for dismissed (removed swipe down / not_for_me)
          action = 'dismissed';
        }

        // Medium haptic on confirm
        runOnJS(triggerHaptic)('medium');

        // Hide hints on first interaction
        if (onFirstInteraction && !hasInteracted) {
          runOnJS(onFirstInteraction)();
        }
        hintOpacity.value = withTiming(0, { duration: 200 });

        // Animate card off screen
        const exitX = e.translationX > 0 ? CARD_WIDTH * 2 : -CARD_WIDTH * 2;
        const exitY = e.translationY > 0 ? cardHeight * 2 : -cardHeight * 2;

        translateX.value = withSpring(exitX, { damping: 20 });
        translateY.value = withSpring(exitY, { damping: 20 });
        opacity.value = withSpring(0);

        runOnJS(onSwipe)(action);
      } else {
        // Spring back to center
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
        rotation.value = withSpring(0, { damping: 15 });
        thresholdCrossed.value = false;
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const zIndex = isTopCard ? 3 : 3 - index;
    return {
      position: 'absolute',
      width: CARD_WIDTH,
      height: cardHeight,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + offsetY.value },
        { rotate: `${rotation.value}deg` },
        { scale: scale.value },
      ],
      opacity: opacity.value,
      zIndex,
    };
  });

  // Swipe progress overlay (tint based on direction)
  const overlayStyle = useAnimatedStyle(() => {
    // Disable overlay if reduced motion is enabled
    if (reducedMotion.value) {
      return { backgroundColor: 'transparent' };
    }

    const absX = Math.abs(translateX.value);
    const absY = Math.abs(translateY.value);
    const progress = Math.min(Math.max(absX, absY) / SWIPE_THRESHOLD, 1);

    let overlayColor = 'transparent';
    if (absX > absY) {
      // Horizontal swipe
      if (translateX.value > 0) {
        // Right (Save) - green
        overlayColor = `rgba(81, 207, 102, ${progress * 0.15})`;
      } else {
        // Left (Watched) - blue
        overlayColor = `rgba(0, 122, 255, ${progress * 0.15})`;
      }
    } else if (absY > 0) {
      // Down (Not for me) - red
      overlayColor = `rgba(255, 107, 107, ${progress * 0.15})`;
    }

    return {
      backgroundColor: overlayColor,
    };
  });

  // Hint opacity based on swipe direction
  const leftHintStyle = useAnimatedStyle(() => {
    const absX = Math.abs(translateX.value);
    const absY = Math.abs(translateY.value);
    const isDraggingLeft = translateX.value < -20 && absX > absY;
    const baseOpacity = hasInteracted ? 0 : hintOpacity.value;
    const dragOpacity = isDraggingLeft
      ? Math.min(baseOpacity + 0.3, 0.9)
      : baseOpacity;
    return {
      opacity: dragOpacity,
    };
  });

  const rightHintStyle = useAnimatedStyle(() => {
    const absX = Math.abs(translateX.value);
    const absY = Math.abs(translateY.value);
    const isDraggingRight = translateX.value > 20 && absX > absY;
    const baseOpacity = hasInteracted ? 0 : hintOpacity.value;
    const dragOpacity = isDraggingRight
      ? Math.min(baseOpacity + 0.3, 0.9)
      : baseOpacity;
    return {
      opacity: dragOpacity,
    };
  });

  const bottomHintStyle = useAnimatedStyle(() => {
    const absX = Math.abs(translateX.value);
    const absY = Math.abs(translateY.value);
    const isDraggingDown = translateY.value > 20 && absY > absX;
    const baseOpacity = hasInteracted ? 0 : hintOpacity.value;
    const dragOpacity = isDraggingDown
      ? Math.min(baseOpacity + 0.3, 0.9)
      : baseOpacity;
    return {
      opacity: dragOpacity,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[animatedStyle, styles.card]}>
        {/* Swipe Progress Overlay */}
        <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none" />

        <View style={styles.cardContent}>
          {/* Gesture Hints (top card only) */}
          {isTopCard && !hasInteracted && (
            <>
              <Animated.View style={[styles.hint, styles.hintLeft, leftHintStyle]}>
                <Text style={styles.hintText} accessibilityLabel="Swipe left to mark as watched">
                  WATCHED
                </Text>
              </Animated.View>
              <Animated.View style={[styles.hint, styles.hintRight, rightHintStyle]}>
                <Text style={styles.hintText} accessibilityLabel="Swipe right to save">
                  SAVE
                </Text>
              </Animated.View>
            </>
          )}

          {/* Poster with Score Overlay */}
          {show.poster_path && (
            <View style={styles.posterContainer}>
              <Image
                source={{
                  uri: `https://image.tmdb.org/t/p/w500${show.poster_path}`,
                }}
                style={styles.poster}
                resizeMode="cover"
              />
              {/* Score Pill Overlay */}
              <View style={styles.scoreOverlay}>
                <Text style={styles.scoreOverlayText}>{show.score.toFixed(1)}</Text>
              </View>
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>
            {/* Title */}
            <Text style={styles.title} numberOfLines={2}>
              {show.title}
            </Text>

            {/* Recommend % beneath title */}
            {(show.followingPercent !== null || show.overallPercent !== null) && (
              <Text style={styles.recommendLine}>
                {show.followingPercent !== null &&
                  `Following ${show.followingPercent}%`}
                {show.followingPercent !== null &&
                  show.overallPercent !== null &&
                  ' • '}
                {show.overallPercent !== null && `Overall ${show.overallPercent}%`}
              </Text>
            )}

            {/* Explanation */}
            <Text style={styles.explanation} numberOfLines={2}>
              {show.explanation}
            </Text>

            {/* Tags */}
            {show.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {show.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  cardContent: {
    flex: 1,
  },
  hint: {
    position: 'absolute',
    zIndex: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  hintLeft: {
    left: spacing.md,
    top: '50%',
    transform: [{ translateY: -12 }, { rotate: '-90deg' }],
  },
  hintRight: {
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -12 }, { rotate: '90deg' }],
  },
  hintBottom: {
    bottom: spacing.lg,
    left: '50%',
    transform: [{ translateX: -40 }],
  },
  hintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  posterContainer: {
    position: 'relative',
    width: '100%',
    height: 320,
  },
  poster: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.border,
  },
  scoreOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  scoreOverlayText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    padding: spacing.md,
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  recommendLine: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  explanation: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  tagText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
});
