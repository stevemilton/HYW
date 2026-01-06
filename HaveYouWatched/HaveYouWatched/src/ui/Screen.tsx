import React, { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from './theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  backgroundColor?: string;
}

export default function Screen({
  children,
  scroll = false,
  backgroundColor = colors.bg,
}: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      style={[styles.scrollView, { backgroundColor }]}
      contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { backgroundColor }]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});

