/**
 * Onboarding helper functions
 * Manages user onboarding state (country, completion status, current step)
 */

import { getCurrentUserId } from './dev';
import { supabase } from './supabase';

export interface OnboardingState {
  country_code: string | null;
  onboarding_completed: boolean;
  onboarding_step: string | null;
}

/**
 * Get onboarding state for a user
 * @param userId - Optional user ID (uses getCurrentUserId() if not provided)
 * @returns Onboarding state object
 */
export async function getOnboardingState(
  userId?: string
): Promise<OnboardingState> {
  const currentUserId = userId || (await getCurrentUserId());

  const { data, error } = await supabase
    .from('profiles')
    .select('country_code, onboarding_completed, onboarding_step')
    .eq('id', currentUserId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Profile doesn't exist yet, return defaults
      return {
        country_code: null,
        onboarding_completed: false,
        onboarding_step: null,
      };
    }
    throw new Error(`Failed to fetch onboarding state: ${error.message}`);
  }

  return {
    country_code: data?.country_code || null,
    onboarding_completed: data?.onboarding_completed ?? false,
    onboarding_step: data?.onboarding_step || null,
  };
}

/**
 * Set user's country code
 * @param countryCode - ISO country code (e.g., "US", "GB")
 * @param userId - Optional user ID (uses getCurrentUserId() if not provided)
 */
export async function setCountry(
  countryCode: string,
  userId?: string
): Promise<void> {
  const currentUserId = userId || (await getCurrentUserId());

  const { error } = await supabase
    .from('profiles')
    .update({ country_code: countryCode })
    .eq('id', currentUserId);

  if (error) {
    throw new Error(`Failed to set country: ${error.message}`);
  }
}

/**
 * Set user's current onboarding step
 * @param step - Current step identifier (e.g., "country", "preferences", "complete")
 * @param userId - Optional user ID (uses getCurrentUserId() if not provided)
 */
export async function setOnboardingStep(
  step: string,
  userId?: string
): Promise<void> {
  const currentUserId = userId || (await getCurrentUserId());

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_step: step })
    .eq('id', currentUserId);

  if (error) {
    throw new Error(`Failed to set onboarding step: ${error.message}`);
  }
}

/**
 * Mark onboarding as completed for a user
 * @param userId - Optional user ID (uses getCurrentUserId() if not provided)
 */
export async function completeOnboarding(userId?: string): Promise<void> {
  const currentUserId = userId || (await getCurrentUserId());

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed: true,
      onboarding_step: null, // Clear step when completed
    })
    .eq('id', currentUserId);

  if (error) {
    throw new Error(`Failed to complete onboarding: ${error.message}`);
  }
}

