// Simulated venue data — replaced by Google Places API in production.
// Coordinates are real NYC locations so the map renders meaningfully.

export type MockVenue = {
  id: string;
  name: string;
  category: string;
  address: string;
  rating: number;
  priceLevel: 1 | 2 | 3 | 4; // $ $$ $$$ $$$$
  lat: number;
  lng: number;
  note: string; // one-line vibe description
};

// Food venues by category
export const MOCK_RESTAURANTS: Record<string, MockVenue[]> = {
  Sushi: [
    { id: "s1", name: "Nobu Downtown", category: "Sushi", address: "195 Hudson St, New York", rating: 4.6, priceLevel: 4, lat: 40.7195, lng: -74.009, note: "iconic, needs a reservation" },
    { id: "s2", name: "Sushi Nakazawa", category: "Sushi", address: "23 Commerce St, New York", rating: 4.8, priceLevel: 4, lat: 40.7333, lng: -74.003, note: "omakase, unforgettable" },
    { id: "s3", name: "Mu Ramen (with sushi bar)", category: "Sushi", address: "12-09 Jackson Ave, Queens", rating: 4.5, priceLevel: 3, lat: 40.7454, lng: -73.9474, note: "tiny, intimate, worth it" },
    { id: "s4", name: "Tanoshi Sushi", category: "Sushi", address: "1372 York Ave, New York", rating: 4.7, priceLevel: 3, lat: 40.7707, lng: -73.9512, note: "neighborhood gem" },
    { id: "s5", name: "Zuma", category: "Sushi", address: "261 Madison Ave, New York", rating: 4.5, priceLevel: 4, lat: 40.7524, lng: -73.9823, note: "great for a special night" },
  ],
  Pizza: [
    { id: "p1", name: "Lucali", category: "Pizza", address: "575 Henry St, Brooklyn", rating: 4.8, priceLevel: 2, lat: 40.6784, lng: -73.9984, note: "BYOB, bring wine, arrive early" },
    { id: "p2", name: "Una Pizza Napoletana", category: "Pizza", address: "175 Orchard St, New York", rating: 4.7, priceLevel: 3, lat: 40.7205, lng: -73.9882, note: "wood-fired, Neapolitan" },
    { id: "p3", name: "Roberta's", category: "Pizza", address: "261 Moore St, Brooklyn", rating: 4.5, priceLevel: 2, lat: 40.7057, lng: -73.9338, note: "cool neighborhood, great garden" },
  ],
  Tacos: [
    { id: "t1", name: "Los Tacos No. 1", category: "Tacos", address: "75 9th Ave, New York", rating: 4.6, priceLevel: 1, lat: 40.7429, lng: -74.005, note: "legendary, cash only" },
    { id: "t2", name: "Tacombi", category: "Tacos", address: "267 Elizabeth St, New York", rating: 4.5, priceLevel: 2, lat: 40.7235, lng: -73.9942, note: "festive, great margaritas" },
  ],
  Ramen: [
    { id: "r1", name: "Ichiran Ramen", category: "Ramen", address: "132 W 49th St, New York", rating: 4.5, priceLevel: 2, lat: 40.7588, lng: -73.9814, note: "solo booths, incredibly cozy" },
    { id: "r2", name: "Totto Ramen", category: "Ramen", address: "248 W 52nd St, New York", rating: 4.6, priceLevel: 2, lat: 40.7624, lng: -73.9844, note: "tiny, worth the wait" },
  ],
  Burgers: [
    { id: "b1", name: "Corner Bistro", category: "Burgers", address: "331 W 4th St, New York", rating: 4.5, priceLevel: 1, lat: 40.7355, lng: -74.0026, note: "no-frills, legendary patty" },
    { id: "b2", name: "J.G. Melon", category: "Burgers", address: "1291 3rd Ave, New York", rating: 4.4, priceLevel: 2, lat: 40.7741, lng: -73.9566, note: "Upper East Side classic" },
  ],
  Pasta: [
    { id: "pa1", name: "Lilia", category: "Pasta", address: "567 Union Ave, Brooklyn", rating: 4.8, priceLevel: 3, lat: 40.7172, lng: -73.9517, note: "book weeks ahead, worth it" },
    { id: "pa2", name: "Carbone", category: "Pasta", address: "181 Thompson St, New York", rating: 4.7, priceLevel: 4, lat: 40.7288, lng: -74.0003, note: "classic, very romantic" },
  ],
  "Surprise me": [
    { id: "sm1", name: "Atomix", category: "Korean tasting menu", address: "104 E 30th St, New York", rating: 4.9, priceLevel: 4, lat: 40.7441, lng: -73.9835, note: "2 Michelin stars, unforgettable" },
    { id: "sm2", name: "Don Angie", category: "Italian-American", address: "103 Greenwich Ave, New York", rating: 4.7, priceLevel: 3, lat: 40.7385, lng: -74.0014, note: "charming, book ahead" },
  ],
};

// Activity venues by activity type
export const MOCK_ACTIVITY_VENUES: Record<string, MockVenue[]> = {
  Movie: [
    { id: "mv1", name: "Alamo Drafthouse", category: "Movie theater", address: "28 Liberty St, New York", rating: 4.6, priceLevel: 3, lat: 40.7083, lng: -74.0095, note: "food and drinks at your seat" },
    { id: "mv2", name: "IFC Center", category: "Movie theater", address: "323 6th Ave, New York", rating: 4.7, priceLevel: 2, lat: 40.7333, lng: -74.0019, note: "indie films, cozy" },
    { id: "mv3", name: "Metrograph", category: "Movie theater", address: "7 Ludlow St, New York", rating: 4.7, priceLevel: 2, lat: 40.7154, lng: -73.9909, note: "gorgeous theater, great bar upstairs" },
  ],
  Arcade: [
    { id: "ac1", name: "Two-Bit's Retro Arcade", category: "Arcade", address: "153 Essex St, New York", rating: 4.5, priceLevel: 2, lat: 40.7191, lng: -73.9867, note: "all-you-can-play, cocktails" },
    { id: "ac2", name: "Barcade Williamsburg", category: "Arcade bar", address: "388 Union Ave, Brooklyn", rating: 4.5, priceLevel: 2, lat: 40.7147, lng: -73.9496, note: "vintage games, great beer list" },
  ],
  Museum: [
    { id: "ms1", name: "The Met", category: "Museum", address: "1000 5th Ave, New York", rating: 4.8, priceLevel: 2, lat: 40.7794, lng: -73.9632, note: "rooftop bar views are incredible" },
    { id: "ms2", name: "Brooklyn Museum", category: "Museum", address: "200 Eastern Pkwy, Brooklyn", rating: 4.7, priceLevel: 2, lat: 40.6712, lng: -73.9637, note: "first Saturdays free + party" },
    { id: "ms3", name: "MoMA", category: "Museum", address: "11 W 53rd St, New York", rating: 4.7, priceLevel: 3, lat: 40.7614, lng: -73.9776, note: "worth the price, design store too" },
  ],
  Karaoke: [
    { id: "k1", name: "Karaoke Duet 35", category: "Karaoke", address: "33 W 35th St, New York", rating: 4.4, priceLevel: 2, lat: 40.7493, lng: -73.9886, note: "private rooms, great song library" },
    { id: "k2", name: "TAGS Bar & Lounge", category: "Karaoke bar", address: "593 Flushing Ave, Brooklyn", rating: 4.3, priceLevel: 1, lat: 40.7006, lng: -73.9443, note: "chill, unpretentious" },
  ],
  "Live music": [
    { id: "lm1", name: "Smalls Jazz Club", category: "Jazz", address: "183 W 10th St, New York", rating: 4.8, priceLevel: 2, lat: 40.7339, lng: -74.0022, note: "legendary, late nights" },
    { id: "lm2", name: "Brooklyn Steel", category: "Concert venue", address: "319 Frost St, Brooklyn", rating: 4.6, priceLevel: 2, lat: 40.7228, lng: -73.9444, note: "great sound, good floor" },
  ],
  "Mini golf": [
    { id: "mg1", name: "Holey Moley Golf Club", category: "Mini golf", address: "68 8th Ave, Brooklyn", rating: 4.4, priceLevel: 2, lat: 40.6749, lng: -73.9894, note: "themed holes, cocktails" },
  ],
  "Photo booth": [
    { id: "pb1", name: "Foto Moto", category: "Photo booth", address: "69 N 7th St, Brooklyn", rating: 4.5, priceLevel: 1, lat: 40.7195, lng: -73.9589, note: "vintage strip booth, Williamsburg" },
  ],
  // Outdoor / no-venue activities — these use landmark coordinates
  Walk: [
    { id: "w1", name: "Brooklyn Bridge Walk", category: "Walk", address: "Brooklyn Bridge, New York", rating: 4.9, priceLevel: 1, lat: 40.7061, lng: -73.9969, note: "iconic, best at golden hour" },
    { id: "w2", name: "High Line", category: "Walk", address: "Gansevoort St, New York", rating: 4.7, priceLevel: 1, lat: 40.748, lng: -74.0048, note: "elevated park, great views" },
    { id: "w3", name: "Dumbo Waterfront", category: "Walk", address: "Main St, Brooklyn", rating: 4.8, priceLevel: 1, lat: 40.7033, lng: -73.9896, note: "best Manhattan views in the city" },
  ],
  "Sunset view": [
    { id: "sv1", name: "Top of the Rock", category: "Observation deck", address: "30 Rockefeller Plaza, New York", rating: 4.8, priceLevel: 3, lat: 40.7587, lng: -73.9787, note: "unobstructed Empire State views" },
    { id: "sv2", name: "Brooklyn Heights Promenade", category: "Waterfront park", address: "Montague St, Brooklyn", rating: 4.9, priceLevel: 1, lat: 40.696, lng: -73.9988, note: "free, best sunset in NYC" },
    { id: "sv3", name: "Gantry Plaza State Park", category: "Waterfront park", address: "Long Island City, Queens", rating: 4.8, priceLevel: 1, lat: 40.7453, lng: -73.9566, note: "Midtown skyline, very romantic" },
  ],
  "Scenic drive": [
    { id: "sd1", name: "Ocean Parkway", category: "Scenic drive", address: "Ocean Pkwy, Brooklyn", rating: 4.5, priceLevel: 1, lat: 40.6501, lng: -73.9604, note: "beautiful tree-lined boulevard" },
  ],
  Stargazing: [
    { id: "sg1", name: "Staten Island Greenbelt", category: "Park", address: "200 Nevada Ave, Staten Island", rating: 4.6, priceLevel: 1, lat: 40.5842, lng: -74.1503, note: "darkest skies in NYC" },
  ],
};

// Activity types that don't have a specific venue (pure activities)
export const NO_VENUE_ACTIVITIES = new Set([
  "Coffee",
  "Bookstore",
  "Drinks",
  "Farmers market",
  "Night market",
  "Gallery stroll",
  "Park picnic",
  "Thrift browse",
  "Record store",
  "Plant shop",
  "Board games",
  "Tea stop",
  "Surprise ending",
]);

export function getVenuesForActivity(activity: string): MockVenue[] {
  return MOCK_ACTIVITY_VENUES[activity] ?? [];
}

export function getVenuesForFood(food: string): MockVenue[] {
  return MOCK_RESTAURANTS[food] ?? MOCK_RESTAURANTS["Surprise me"] ?? [];
}

export const PRICE_LABELS: Record<number, string> = {
  1: "$",
  2: "$$",
  3: "$$$",
  4: "$$$$",
};

// Dress code suggestion based on venue price levels and her vibe
export function suggestDressCode(
  venues: MockVenue[],
  dressVibe: string | null,
): { code: string; message: string } {
  if (!venues.length) return { code: "Cute and comfortable", message: "Dress however feels like you ✨" };

  const avgPrice = venues.reduce((s, v) => s + v.priceLevel, 0) / venues.length;

  if (avgPrice >= 3.5) {
    if (dressVibe === "dress-up") return { code: "Cocktail attire", message: "You said you love an excuse to dress up — tonight's the night 🍸" };
    if (dressVibe === "casual") return { code: "Smart casual", message: "Nice jeans and a good top works perfectly for where we're going 🌟" };
    return { code: "Smart casual", message: "Somewhere between dinner-ready and date-ready — you'll know 💫" };
  }
  if (avgPrice >= 2.5) {
    if (dressVibe === "dress-up") return { code: "Cute and put-together", message: "A fun excuse to wear something nice without going full formal 🌸" };
    if (dressVibe === "casual") return { code: "Whatever feels like you", message: "Casual is absolutely fine — come as you are 🧢" };
    return { code: "Casual cute", message: "Comfortable but the version of you that's excited about tonight 🌷" };
  }
  return { code: "Come as you are", message: "Comfortable, easy, no stress — just bring you 💕" };
}
