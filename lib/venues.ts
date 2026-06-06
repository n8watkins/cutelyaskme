export type Venue = {
  id: string;
  name: string;
  address: string;
  rating: number;
  priceLevel: 1 | 2 | 3 | 4;
  lat: number;
  lng: number;
};

export const PRICE_LABELS: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

export const ACTIVITY_PLACE_QUERY: Partial<Record<string, string>> = {
  Movie: "movie theater",
  Arcade: "arcade",
  Museum: "museum",
  Karaoke: "karaoke bar",
  "Mini golf": "mini golf course",
  "Live music": "live music venue",
  "Board games": "board game cafe",
  "Photo booth": "photo booth studio",
};

export const NO_VENUE_ACTIVITIES = new Set([
  "Coffee", "Walk", "Bookstore", "Drinks", "Farmers market", "Sunset view",
  "Night market", "Gallery stroll", "Park picnic", "Thrift browse", "Record store",
  "Plant shop", "Tea stop", "Stargazing", "Scenic drive", "Surprise ending",
]);
