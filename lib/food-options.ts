import type { EntreeOption } from "@/components/date-planner/types";

export const entreeOptions: EntreeOption[] = [
  "Pizza",
  "Sushi",
  "Tacos",
  "Ramen",
  "Burgers",
  "Pasta",
  "Surprise me",
];

export const entreeNotes: Record<EntreeOption, string> = {
  Pizza: "cozy, cheesy, very hard to mess up",
  Sushi: "cute little plates, cute little plans",
  Tacos: "easy, fun, and full of good decisions",
  Ramen: "warm bowls and sitting close",
  Burgers: "classic date-night comfort",
  Pasta: "soft lighting would be required",
  "Surprise me": "I pick, you just show up cute",
};

export const entreeIcons: Record<EntreeOption, string> = {
  Pizza: "🍕",
  Sushi: "🍣",
  Tacos: "🌮",
  Ramen: "🍜",
  Burgers: "🍔",
  Pasta: "🍝",
  "Surprise me": "✨",
};
