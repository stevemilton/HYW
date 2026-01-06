import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CountryScreen from '../screens/onboarding/CountryScreen';
import FindFriendsScreen from '../screens/onboarding/FindFriendsScreen';
import TasteSetupScreen from '../screens/onboarding/TasteSetupScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';

export type OnboardingStackParamList = {
  Welcome: undefined;
  Country: undefined;
  TasteSetup: undefined;
  FindFriends: undefined;
};

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
      }}>
      <OnboardingStack.Screen name="Welcome" component={WelcomeScreen} />
      <OnboardingStack.Screen name="Country" component={CountryScreen} />
      <OnboardingStack.Screen name="TasteSetup" component={TasteSetupScreen} />
      <OnboardingStack.Screen name="FindFriends" component={FindFriendsScreen} />
    </OnboardingStack.Navigator>
  );
}

