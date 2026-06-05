export function formatRecipientName(value?: string) {
  if (!value) {
    return "Hey";
  }

  const decoded = decodeURIComponent(value).replace(/[-_]+/g, " ").trim();

  if (!decoded) {
    return "Hey";
  }

  return decoded
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export const noButtonLabels = [
  "No",
  "wait",
  "but consider yes",
  "tiny ouch",
  "you're really trying huh",
  "what if yes though",
  "this feels personal",
  "the heart says yes",
  "bold move honestly",
  "I respect the effort",
  "still no? wow",
  "okay but dinner",
  "think of the dessert",
] as const;
