export type DateOption = {
  id: string;
  label: string;
  display: string;
  value: string;
};

const targetDays = [
  { label: "Friday", day: 5 },
  { label: "Saturday", day: 6 },
  { label: "Sunday", day: 0 },
];

const shortFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const longFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function nextOccurrence(day: number, from: Date) {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);

  const distance = (day - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + distance);

  return date;
}

export function getCuratedDateOptions(from = new Date()): DateOption[] {
  return targetDays.map((item) => {
    const date = nextOccurrence(item.day, from);

    return {
      id: item.label.toLowerCase(),
      label: item.label,
      display: shortFormatter.format(date),
      value: toDateValue(date),
    };
  });
}

export function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  return longFormatter.format(date);
}
