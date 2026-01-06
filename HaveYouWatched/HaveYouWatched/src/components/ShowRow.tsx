import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../ui/theme';

interface ShowRowProps {
  posterPath: string | null;
  title: string;
  metaLine: string; // e.g., "2024" or "@username • 2h ago"
  secondaryLine: string; // e.g., "Enjoyment: 8/10" or overview text
  onPress?: () => void;
  rightAccessory?: React.ReactNode; // e.g., score pill
}

export default function ShowRow({
  posterPath,
  title,
  metaLine,
  secondaryLine,
  onPress,
  rightAccessory,
}: ShowRowProps) {
  const content = (
    <View style={styles.row}>
      {posterPath && (
        <Image
          source={{
            uri: `https://image.tmdb.org/t/p/w342${posterPath}`,
          }}
          style={styles.poster}
          resizeMode="cover"
        />
      )}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.metaLine} numberOfLines={1}>
          {metaLine}
        </Text>
        <Text style={styles.secondaryLine} numberOfLines={1}>
          {secondaryLine}
        </Text>
      </View>
      {rightAccessory && <View style={styles.accessory}>{rightAccessory}</View>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  poster: {
    width: 56,
    height: 84,
    borderRadius: 10,
    marginRight: spacing.sm,
    backgroundColor: colors.border,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  metaLine: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 2,
  },
  secondaryLine: {
    fontSize: 13,
    color: colors.muted,
  },
  accessory: {
    marginLeft: spacing.sm,
  },
});

