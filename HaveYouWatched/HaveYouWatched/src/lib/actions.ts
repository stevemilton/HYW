/**
 * Watch actions helper functions
 * Records user swipe actions on shows (saved, watched, dismissed, not_for_me)
 */

import { getCurrentUserId } from './dev';
import { supabase } from './supabase';

export type WatchAction = 'saved' | 'watched' | 'dismissed' | 'not_for_me';

interface RecordWatchActionParams {
  userId?: string; // Optional - will use getCurrentUserId() if not provided
  showId: string;
  action: WatchAction;
}

/**
 * Record a watch action (saved, watched, dismissed, not_for_me) for a user and show
 * Uses DEV_USER_ID in DEV_MODE, otherwise uses authenticated user ID
 *
 * @param params - Object containing userId (optional), showId, and action
 * @throws Error if the action fails
 *
 * @example
 * // Record a "saved" action
 * await recordWatchAction({
 *   showId: '12345',
 *   action: 'saved'
 * });
 *
 * @example
 * // Record a "watched" action
 * await recordWatchAction({
 *   showId: '67890',
 *   action: 'watched'
 * });
 *
 * @example
 * // Record with explicit userId (rarely needed)
 * await recordWatchAction({
 *   userId: 'user-uuid',
 *   showId: '12345',
 *   action: 'dismissed'
 * });
 */
export async function recordWatchAction(
  params: RecordWatchActionParams
): Promise<void> {
  const { showId, action } = params;
  const userId = params.userId || (await getCurrentUserId());

  if (!showId || !action) {
    throw new Error('showId and action are required');
  }

  // Validate action type
  const validActions: WatchAction[] = ['saved', 'watched', 'dismissed', 'not_for_me'];
  if (!validActions.includes(action)) {
    throw new Error(`Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`);
  }

  const { error } = await supabase.from('watch_actions').insert({
    user_id: userId,
    show_id: showId,
    action,
    created_at: new Date().toISOString(),
  });

  if (error) {
    // Handle unique constraint violation (user already has this action for this show)
    if (error.code === '23505') {
      // Primary key violation - action already exists, this is fine
      // Optionally update the created_at timestamp
      const { error: updateError } = await supabase
        .from('watch_actions')
        .update({ created_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('show_id', showId)
        .eq('action', action);

      if (updateError) {
        throw new Error(`Failed to update watch action: ${updateError.message}`);
      }
      return; // Successfully updated
    }

    throw new Error(`Failed to record watch action: ${error.message}`);
  }
}

/**
 * Get all watch actions for a user
 * @param userId - Optional user ID (uses getCurrentUserId() if not provided)
 * @returns Array of watch actions
 */
export async function getUserWatchActions(userId?: string) {
  const currentUserId = userId || (await getCurrentUserId());

  const { data, error } = await supabase
    .from('watch_actions')
    .select('*')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch watch actions: ${error.message}`);
  }

  return data || [];
}

/**
 * Get watch actions for a specific show
 * @param showId - Show ID (TMDB ID)
 * @param userId - Optional user ID (uses getCurrentUserId() if not provided)
 * @returns Array of watch actions for the show
 */
export async function getShowWatchActions(showId: string, userId?: string) {
  const currentUserId = userId || (await getCurrentUserId());

  const { data, error } = await supabase
    .from('watch_actions')
    .select('*')
    .eq('user_id', currentUserId)
    .eq('show_id', showId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch show watch actions: ${error.message}`);
  }

  return data || [];
}

/**
 * Delete a watch action
 * @param showId - Show ID (TMDB ID)
 * @param action - Action type to delete
 * @param userId - Optional user ID (uses getCurrentUserId() if not provided)
 */
export async function deleteWatchAction(
  showId: string,
  action: WatchAction,
  userId?: string
): Promise<void> {
  const currentUserId = userId || (await getCurrentUserId());

  const { error } = await supabase
    .from('watch_actions')
    .delete()
    .eq('user_id', currentUserId)
    .eq('show_id', showId)
    .eq('action', action);

  if (error) {
    throw new Error(`Failed to delete watch action: ${error.message}`);
  }
}

