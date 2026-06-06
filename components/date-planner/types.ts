export type PlannerStep =
  | "invite"
  | "accepted"
  | "date"
  | "time"
  | "entree"
  | "lineup"
  | "dress"
  | "summary"
  | "confirmed";

export type DressVibe =
  | "casual"
  | "casual-cute"
  | "dress-up"
  | "match-you";

export type EntreeOption =
  | "Pizza"
  | "Sushi"
  | "Tacos"
  | "Ramen"
  | "Burgers"
  | "Pasta"
  | "Surprise me";

export type DessertOption =
  | "Ice cream"
  | "Pastries"
  | "Boba"
  | "Chocolate"
  | "Skip dessert";

export type ActivityOption =
  | "Coffee"
  | "Walk"
  | "Movie"
  | "Arcade"
  | "Bookstore"
  | "Drinks"
  | "Photo booth"
  | "Mini golf"
  | "Farmers market"
  | "Sunset view"
  | "Night market"
  | "Gallery stroll"
  | "Park picnic"
  | "Thrift browse"
  | "Record store"
  | "Plant shop"
  | "Museum"
  | "Board games"
  | "Karaoke"
  | "Live music"
  | "Stargazing"
  | "Scenic drive"
  | "Tea stop"
  | "Surprise ending";

export type DatePlanState = {
  recipientName: string;
  step: PlannerStep;
  selectedDate: string | null;
  selectedDateLabel: string | null;
  selectedTime: string | null;
  selectedTimeLabel: string | null;
  selectedEntree: EntreeOption | null;
  selectedDessert: DessertOption | null;
  selectedActivities: string[];
  dressVibe: DressVibe | null;
  noAttempts: number;
  hasAccepted: boolean;
  confirmedPlanId: string | null;
};
