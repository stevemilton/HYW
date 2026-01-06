import { NavigationContainer } from '@react-navigation/native';
import { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DEV_MODE, getCurrentUserId } from './src/lib/dev';
import { ensureProfile } from './src/lib/profile';
import { supabase } from './src/lib/supabase';
import RootNavigator from './src/navigation/RootNavigator';
import AuthScreen from './src/screens/AuthScreen';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      // DEV: Bypass auth if DEV_MODE is enabled
      if (DEV_MODE) {
        try {
          // Ensure profile exists in DEV_MODE
          const userId = await getCurrentUserId();
          const { data: { user } } = await supabase.auth.getUser();
          const email = user?.email || `dev-${userId}@example.com`;
          await ensureProfile(userId, email);
        } catch (error) {
          console.error('Failed to ensure profile in DEV_MODE:', error);
        }
        setSession({} as Session); // Fake session for DEV_MODE
        setLoading(false);
        return;
      }

      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) {
        // Ensure profile exists (creates if missing)
        await ensureProfile(session.user.id, session.user.email || '');
      }
      setLoading(false);
    };

    initializeApp();

    // Listen for auth changes
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        // Ensure profile exists after login (creates if missing)
        await ensureProfile(session.user.id, session.user.email || '');
      }
    });

    // Handle deep links for Supabase auth
    const handleDeepLink = async (url: string) => {
      if (url.includes('#access_token=') || url.includes('?access_token=')) {
        // Extract the URL fragment/query params
        const hash = url.split('#')[1] || url.split('?')[1];
        if (hash) {
          // Supabase will automatically handle the session from the URL
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await ensureProfile(session.user.id, session.user.email || '');
          }
        }
      }
    };

    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for deep links while app is running
    const linkingSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      authSubscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        {DEV_MODE || session ? <RootNavigator /> : <AuthScreen />}
        <StatusBar style="auto" />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
