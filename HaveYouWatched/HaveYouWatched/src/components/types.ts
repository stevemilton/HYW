/**
 * Types for swipeable card components
 */

export interface SwipeableShow {
  show_id: string;
  title: string;
  poster_path: string | null;
  score: number;
  followingPercent: number | null;
  overallPercent: number | null;
  explanation: string;
  tags: string[];
}

