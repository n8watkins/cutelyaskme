export type Venue = {
  id: string;
  name: string;
  address: string;
  rating: number;
  priceLevel: 1 | 2 | 3 | 4;
  lat: number;
  lng: number;
  imageUrl?: string;
  /** "custom" = a hand-dropped map pin (A5); absent = Google Places/OSM result */
  source?: "custom";
};

export const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

// Map a Google Places priceLevel enum to a 1–4 level.
const PRICE_LEVEL_MAP: Record<string, 1 | 2 | 3 | 4> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export function mapPriceLevel(priceLevel: string | undefined): 1 | 2 | 3 | 4 {
  return (priceLevel && PRICE_LEVEL_MAP[priceLevel]) || 2;
}

export const ACTIVITY_ICONS: Partial<Record<string, string>> = {
  Coffee: "☕", Movie: "🎞️", Arcade: "🕹️", Bookstore: "📚",
  Drinks: "🍹", "Photo booth": "📸", "Mini golf": "⛳",
  "Sunset view": "🌅", "Gallery stroll": "🖼️",
  "Park picnic": "🧺", "Thrift browse": "🧥", "Record store": "🎧",
  "Plant shop": "🪴", Museum: "🏛️", "Board games": "🎲", Karaoke: "🎤",
  "Live music": "🎵", Stargazing: "🌌", "Scenic drive": "🚗", "Tea stop": "🫖",
  "Surprise ending": "✨",
};

export const ACTIVITY_PLACE_QUERY: Partial<Record<string, string>> = {
  Coffee: "coffee shop",
  Bookstore: "bookstore",
  Drinks: "cocktail bar",
  Movie: "movie theater",
  Arcade: "arcade",
  Museum: "museum",
  Karaoke: "karaoke bar",
  "Mini golf": "mini golf course",
  "Live music": "live music venue",
  "Board games": "board game cafe",
  "Photo booth": "photo booth studio",
  "Gallery stroll": "art gallery",
  "Thrift browse": "thrift store",
  "Record store": "record store",
  "Plant shop": "plant nursery",
  "Tea stop": "tea room",
};

// Activities served by Overpass (OpenStreetMap) instead of Google Places
export const NATURAL_PLACE_ACTIVITIES: Record<string, string> = {
  "Park picnic": "park",
  "Sunset view": "viewpoint",
  "Stargazing": "stargazing",
  "Scenic drive": "scenic_drive",
};

export const NO_VENUE_ACTIVITIES = new Set(["Surprise ending"]);

// Default minutes to spend at each stop type
export const DEFAULT_STOP_DURATIONS: Record<string, number> = {
  Coffee: 45,
  Movie: 120,
  Arcade: 90,
  Bookstore: 60,
  Drinks: 75,
  "Photo booth": 30,
  "Mini golf": 90,
  "Sunset view": 45,
  "Gallery stroll": 75,
  "Park picnic": 90,
  "Thrift browse": 60,
  "Record store": 45,
  "Plant shop": 45,
  Museum: 120,
  "Board games": 90,
  Karaoke: 90,
  "Live music": 120,
  Stargazing: 60,
  "Scenic drive": 60,
  "Tea stop": 45,
  "Surprise ending": 60,
  __entree__: 75,
};
