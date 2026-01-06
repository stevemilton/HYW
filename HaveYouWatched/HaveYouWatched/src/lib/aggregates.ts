/**
 * Aggregation helpers for computing statistics from ratings data
 */

/**
 * Compute the percentage of ratings that recommend a show
 * @param ratings Array of rating objects with a recommend boolean field
 * @returns Percentage (0-100) rounded to nearest integer, or null if no ratings
 *
 * @example
 * // Basic usage
 * const ratings = [
 *   { recommend: true },
 *   { recommend: true },
 *   { recommend: false },
 *   { recommend: null }
 * ];
 * const percent = computeRecommendPercent(ratings); // => 67 (2 out of 3 non-null)
 *
 * @example
 * // Empty array
 * const percent = computeRecommendPercent([]); // => null
 *
 * @example
 * // All recommend
 * const percent = computeRecommendPercent([
 *   { recommend: true },
 *   { recommend: true }
 * ]); // => 100
 *
 * @example
 * // All null (treated as no ratings)
 * const percent = computeRecommendPercent([
 *   { recommend: null },
 *   { recommend: null }
 * ]); // => null
 */
export function computeRecommendPercent(
  ratings: Array<{ recommend: boolean | null }>
): number | null {
  if (ratings.length === 0) {
    return null;
  }

  // Filter out null values (treat as no recommendation)
  const validRatings = ratings.filter(
    (r) => r.recommend !== null && r.recommend !== undefined
  );

  if (validRatings.length === 0) {
    return null;
  }

  const positive = validRatings.filter((r) => r.recommend === true).length;
  const percent = Math.round((positive / validRatings.length) * 100);

  return percent;
}

/**
 * Compute detailed recommendation statistics for a show
 * @param ratings Array of rating objects with a recommend boolean field
 * @returns Object with total count, positive count, and percentage
 *
 * @example
 * // Basic usage
 * const ratings = [
 *   { recommend: true },
 *   { recommend: true },
 *   { recommend: false },
 *   { recommend: null }
 * ];
 * const stats = computeRecommendStats(ratings);
 * // => { total: 3, positive: 2, percent: 67 }
 *
 * @example
 * // Empty array
 * const stats = computeRecommendStats([]);
 * // => { total: 0, positive: 0, percent: null }
 *
 * @example
 * // All null
 * const stats = computeRecommendStats([
 *   { recommend: null },
 *   { recommend: null }
 * ]);
 * // => { total: 0, positive: 0, percent: null }
 *
 * @example
 * // Mixed with nulls
 * const stats = computeRecommendStats([
 *   { recommend: true },
 *   { recommend: null },
 *   { recommend: false },
 *   { recommend: true }
 * ]);
 * // => { total: 3, positive: 2, percent: 67 }
 */
export function computeRecommendStats(
  ratings: Array<{ recommend: boolean | null }>
): { total: number; positive: number; percent: number | null } {
  // Filter out null values (treat as no recommendation)
  const validRatings = ratings.filter(
    (r) => r.recommend !== null && r.recommend !== undefined
  );

  const total = validRatings.length;
  const positive = validRatings.filter((r) => r.recommend === true).length;
  const percent = total > 0 ? Math.round((positive / total) * 100) : null;

  return {
    total,
    positive,
    percent,
  };
}

