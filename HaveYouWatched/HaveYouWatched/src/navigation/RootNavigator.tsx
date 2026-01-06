import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { getOnboardingState } from '../lib/onboarding';
import RateShowScreen from '../screens/RateShowScreen';
import ShowDetailScreen from '../screens/ShowDetailScreen';
import { colors } from '../ui/theme';
import AppNavigator from './AppNavigator';
import OnboardingNavigator from './OnboardingNavigator';

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  ShowDetail: { tmdbId: number; mediaType: 'movie' | 'tv' };
  RateShow: {
    show: {
      id: number;
      title?: string;
      name?: string;
      overview: string;
      poster_path: string | null;
      first_air_date?: string;
      release_date?: string;
    };
    initialRating?: {
      hook: number;
      consistency: number;
      payoff: number;
      heat: number;
      enjoyment: number;
      recommend: boolean;
      tags: string[];
    };
  };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkOnboarding = async () => {
      try {
        const state = await getOnboardingState();
        if (mounted) {
          setOnboardingCompleted(state.onboarding_completed);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to check onboarding state:', error);
        // Default to showing onboarding if we can't check
        if (mounted) {
          setOnboardingCompleted(false);
          setLoading(false);
        }
      }
    };

    // Initial check
    checkOnboarding();

    // Poll for onboarding completion changes (e.g., when user completes onboarding)
    // Poll every 500ms for faster response when onboarding is completed
    const interval = setInterval(checkOnboarding, 500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading || onboardingCompleted === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Use key prop to force remount when onboarding state changes
  // This ensures the navigator uses the correct initialRouteName
  return (
    <RootStack.Navigator
      key={onboardingCompleted ? 'tabs' : 'onboarding'}
      initialRouteName={onboardingCompleted ? 'Tabs' : 'Onboarding'}
      screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Onboarding" component={OnboardingNavigator} />
      <RootStack.Screen name="Tabs" component={AppNavigator} />
      <RootStack.Screen
        name="ShowDetail"
        component={ShowDetailScreen}
        options={{
          title: 'Details',
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <RootStack.Screen
        name="RateShow"
        component={RateShowScreen}
        options={{
          title: 'Rate',
          headerShown: true,
          headerBackTitle: '',
        }}
      />
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
});

