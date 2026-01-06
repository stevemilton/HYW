import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DEV_MODE } from '../lib/dev';

export default function DevModeBanner() {
  if (!DEV_MODE) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>DEV MODE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea',
  },
  bannerText: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

