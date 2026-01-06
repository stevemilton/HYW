import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { setCountry, setOnboardingStep } from '../../lib/onboarding';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import Button from '../../ui/Button';
import Screen from '../../ui/Screen';
import { colors, radius, spacing } from '../../ui/theme';

type CountryScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'Country'
>;

// Common countries list (ISO 3166-1 alpha-2 codes)
const COUNTRIES = [
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'IN', name: 'India' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ZA', name: 'South Africa' },
];

// Get device locale country code (simple detection)
function getDeviceCountryCode(): string | null {
  try {
    // Try to get from Intl (if available)
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      const parts = locale.split('-');
      if (parts.length > 1) {
        return parts[parts.length - 1].toUpperCase();
      }
    }
  } catch (error) {
    // Fallback if Intl not available
  }
  return null;
}

export default function CountryScreen() {
  const navigation = useNavigation<CountryScreenNavigationProp>();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCountries, setFilteredCountries] = useState(COUNTRIES);

  // Preselect device locale on mount
  useEffect(() => {
    const deviceCode = getDeviceCountryCode();
    if (deviceCode) {
      // Only preselect if it's a valid country in our list
      const isValid = COUNTRIES.some((c) => c.code === deviceCode);
      if (isValid) {
        setSelectedCode(deviceCode);
      }
    }
  }, []);

  // Filter countries based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCountries(COUNTRIES);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(query) ||
        country.code.toLowerCase().includes(query)
    );
    setFilteredCountries(filtered);
  }, [searchQuery]);

  const handleSelectCountry = (code: string) => {
    setSelectedCode(code);
    setShowOtherModal(false);
    setSearchQuery('');
  };

  const handleContinue = async () => {
    if (!selectedCode) {
      Alert.alert('Error', 'Please select a country');
      return;
    }

    setLoading(true);
    try {
      await setCountry(selectedCode);
      await setOnboardingStep('taste_setup');
      navigation.navigate('TasteSetup');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save country');
    } finally {
      setLoading(false);
    }
  };

  const renderCountryItem = ({ item }: { item: { code: string; name: string } }) => (
    <TouchableOpacity
      style={[
        styles.countryItem,
        selectedCode === item.code && styles.countryItemSelected,
      ]}
      onPress={() => handleSelectCountry(item.code)}>
      <Text
        style={[
          styles.countryName,
          selectedCode === item.code && styles.countryNameSelected,
        ]}>
        {item.name}
      </Text>
      <Text
        style={[
          styles.countryCode,
          selectedCode === item.code && styles.countryCodeSelected,
        ]}>
        {item.code}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Where are you located?</Text>
        <Text style={styles.subtitle}>
          This helps us show you relevant content
        </Text>

        {/* UK and US buttons */}
        <View style={styles.primaryButtons}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              selectedCode === 'GB' && styles.primaryButtonSelected,
            ]}
            onPress={() => setSelectedCode('GB')}>
            <Text
              style={[
                styles.primaryButtonText,
                selectedCode === 'GB' && styles.primaryButtonTextSelected,
              ]}>
              🇬🇧 United Kingdom
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              selectedCode === 'US' && styles.primaryButtonSelected,
            ]}
            onPress={() => setSelectedCode('US')}>
            <Text
              style={[
                styles.primaryButtonText,
                selectedCode === 'US' && styles.primaryButtonTextSelected,
              ]}>
              🇺🇸 United States
            </Text>
          </TouchableOpacity>
        </View>

        {/* Other button */}
        <TouchableOpacity
          style={styles.otherButton}
          onPress={() => setShowOtherModal(true)}>
          <Text style={styles.otherButtonText}>
            {selectedCode && selectedCode !== 'GB' && selectedCode !== 'US'
              ? COUNTRIES.find((c) => c.code === selectedCode)?.name || 'Other'
              : 'Other'}
          </Text>
        </TouchableOpacity>

        {/* Continue button */}
        <View style={styles.buttonContainer}>
          <Button
            variant="primary"
            onPress={handleContinue}
            loading={loading}
            disabled={loading || !selectedCode}>
            Continue
          </Button>
        </View>
      </View>

      {/* Searchable country list modal */}
      <Modal
        visible={showOtherModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowOtherModal(false);
          setSearchQuery('');
        }}>
        <Screen>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity
              onPress={() => {
                setShowOtherModal(false);
                setSearchQuery('');
              }}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search countries..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />

          <FlatList
            data={filteredCountries}
            renderItem={renderCountryItem}
            keyExtractor={(item) => item.code}
            style={styles.countryList}
            keyboardShouldPersistTaps="handled"
          />
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.muted,
    marginBottom: spacing.lg,
  },
  primaryButtons: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  primaryButton: {
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  primaryButtonTextSelected: {
    color: colors.primary,
  },
  otherButton: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  otherButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  buttonContainer: {
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalClose: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  searchInput: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.text,
  },
  countryList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  countryItemSelected: {
    backgroundColor: colors.primary + '10',
  },
  countryName: {
    fontSize: 16,
    color: colors.text,
  },
  countryNameSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  countryCode: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '500',
  },
  countryCodeSelected: {
    color: colors.primary,
  },
});
