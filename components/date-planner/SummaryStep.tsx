"use client";

import { entreeIcons } from "@/lib/food-options";
import { StepCard } from "./StepCard";
import { SharePlanButton } from "./SharePlanButton";
import type { EntreeOption } from "./types";

type SummaryStepProps = {
  recipientName: string;
  selectedDateLabel: string;
  selectedTimeLabel: string;
  selectedEntree: string;
  selectedActivities: string[];
  onEditDate: () => void;
  onEditTime: () => void;
  onEditEntree: () => void;
  onEditLineup: () => void;
};

export function SummaryStep({
  recipientName,
  selectedDateLabel,
  selectedTimeLabel,
  selectedEntree,
  selectedActivities,
  onEditDate,
  onEditTime,
  onEditEntree,
  onEditLineup,
}: SummaryStepProps) {
  const foodIcon =
    selectedEntree in entreeIcons
      ? entreeIcons[selectedEntree as EntreeOption]
      : "🍽️";

  return (
    <StepCard
      stickerSrc="/assets/speech-heart.svg"
      stickerAlt="Speech bubble with heart"
      eyebrow="all set"
      title="It's a date."
      subtitle="A tiny plan, officially sealed with a heart."
    >
      <div className="rounded-[24px] border-2 border-[#ffd6e8] bg-white/90 p-4 text-left shadow-sm">
        <dl className="grid gap-4">
          <SummaryRow
            icon="📅"
            label="Date"
            value={selectedDateLabel}
            onEdit={onEditDate}
          />
          <SummaryRow
            icon="🕰️"
            label="Time"
            value={selectedTimeLabel}
            onEdit={onEditTime}
          />
          <SummaryRow
            icon="💌"
            label="Date plan"
            value={selectedActivities.join(" + ")}
            onEdit={onEditLineup}
          />
          <SummaryRow
            icon={foodIcon}
            label="Food"
            value={selectedEntree}
            onEdit={onEditEntree}
          />
        </dl>
      </div>
      <div className="mt-5">
        <SharePlanButton
          recipientName={recipientName}
          selectedDateLabel={selectedDateLabel}
          selectedTimeLabel={selectedTimeLabel}
          selectedEntree={selectedEntree}
          selectedActivities={selectedActivities}
        />
      </div>
    </StepCard>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  onEdit,
}: {
  icon: string;
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full items-start gap-3 rounded-[20px] p-2 text-left outline-none transition hover:bg-[#fff7fb] focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
      aria-label={`Edit ${label}`}
    >
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff7fb] text-2xl shadow-inner"
      >
        {icon}
      </span>
      <div>
        <dt className="text-xs font-black uppercase tracking-[0.16em] text-[#8a6a78]">
          {label}
        </dt>
        <dd className="mt-1 text-lg font-black text-[#3a2530]">
          {value}
        </dd>
      </div>
      <span
        aria-hidden
        className="ml-auto mt-3 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ffd6e8] text-lg font-black text-[#7c3653]"
      >
        ⋯
      </span>
    </button>
  );
}
