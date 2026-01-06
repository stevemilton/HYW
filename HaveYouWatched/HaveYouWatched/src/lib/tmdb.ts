const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export interface TMDBShow {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  media_type?: string;
}

export interface TMDBSearchResponse {
  results: TMDBShow[];
  total_results: number;
  total_pages: number;
}

export interface TMDBShowDetails extends TMDBShow {
  genres: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status: string;
  tagline?: string;
}

export async function searchShows(query: string): Promise<TMDBSearchResponse> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API key is not configured');
  }

  const response = await fetch(
    `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`
  );

  if (!response.ok) {
    throw new Error('Failed to search shows');
  }

  return response.json();
}

export async function getShowDetails(
  id: number,
  mediaType: 'movie' | 'tv'
): Promise<TMDBShowDetails> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API key is not configured');
  }

  const response = await fetch(
    `${TMDB_BASE_URL}/${mediaType}/${id}?api_key=${TMDB_API_KEY}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch show details');
  }

  return response.json();
}

export function getPosterUrl(posterPath: string | null): string {
  if (!posterPath) return '';
  return `https://image.tmdb.org/t/p/w500${posterPath}`;
}

export function getBackdropUrl(backdropPath: string | null): string {
  if (!backdropPath) return '';
  return `https://image.tmdb.org/t/p/w1280${backdropPath}`;
}

export function getShowTitle(show: TMDBShow): string {
  return show.title || show.name || 'Unknown';
}

export function getShowDate(show: TMDBShow): string {
  return show.release_date || show.first_air_date || '';
}

export function getMediaType(show: TMDBShow): 'movie' | 'tv' {
  if (show.media_type) {
    return show.media_type === 'movie' ? 'movie' : 'tv';
  }
  return show.title ? 'movie' : 'tv';
}

export interface TMDBTrendingResponse {
  results: TMDBShow[];
  page: number;
  total_results: number;
  total_pages: number;
}

/**
 * Get trending shows from TMDB (daily or weekly)
 */
export async function getTrendingShows(
  timeWindow: 'day' | 'week' = 'day'
): Promise<TMDBTrendingResponse> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API key is not configured');
  }

  const response = await fetch(
    `${TMDB_BASE_URL}/trending/all/${timeWindow}?api_key=${TMDB_API_KEY}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch trending shows');
  }

  return response.json();
}

/**
 * Get trending shows weekly (for Inspiration Mode shelves)
 */
export async function fetchTrendingWeekly(): Promise<TMDBShow[]> {
  const response = await getTrendingShows('week');
  return response.results.filter((show) => show.poster_path);
}

/**
 * Get top rated shows from TMDB (movies + TV)
 */
export async function fetchTopRated(): Promise<TMDBShow[]> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API key is not configured');
  }

  // Fetch top rated movies and TV separately, then combine
  const [moviesResponse, tvResponse] = await Promise.all([
    fetch(`${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}`),
    fetch(`${TMDB_BASE_URL}/tv/top_rated?api_key=${TMDB_API_KEY}`),
  ]);

  if (!moviesResponse.ok || !tvResponse.ok) {
    throw new Error('Failed to fetch top rated shows');
  }

  const moviesData = await moviesResponse.json();
  const tvData = await tvResponse.json();

  // Combine and filter for posters
  const combined = [
    ...(moviesData.results || []).map((m: TMDBShow) => ({ ...m, media_type: 'movie' })),
    ...(tvData.results || []).map((t: TMDBShow) => ({ ...t, media_type: 'tv' })),
  ];

  return combined.filter((show) => show.poster_path).slice(0, 20);
}

