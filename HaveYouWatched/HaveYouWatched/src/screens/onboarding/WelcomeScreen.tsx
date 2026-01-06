import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import Button from '../../ui/Button';
import Screen from '../../ui/Screen';
import { colors, spacing } from '../../ui/theme';

type WelcomeScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'Welcome'
>;

export default function WelcomeScreen() {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();

  const handleNext = () => {
    navigation.navigate('Country');
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to HaveYouWatched</Text>
        <Text style={styles.subtitle}>
          Discover shows and movies based on what you and your friends love
        </Text>
        <View style={styles.buttonContainer}>
          <Button variant="primary" onPress={handleNext}>
            Get Started
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    marginTop: spacing.lg,
  },
});

