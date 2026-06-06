"use client";

import { useState } from "react";
import { entreeIcons } from "@/lib/food-options";
import { StepCard } from "./StepCard";
import { SharePlanButton } from "./SharePlanButton";
import type { DressVibe, EntreeOption } from "./types";

const DRESS_LABELS: Record<DressVibe, string> = {
  casual: "🧢 Keep it casual",
  "casual-cute": "🌸 Casual but cute",
  "dress-up": "👗 Ready to dress up",
  "match-you": "✨ I'll match whatever",
};

type SummaryStepProps = {
  recipientName: string;
  selectedDate?: string;
  selectedDateLabel: string;
  selectedTime?: string;
  selectedTimeLabel: string;
  selectedEntree: string;
  selectedActivities: string[];
  dressVibe: DressVibe | null;
  inviteToken?: string;
  onConfirmed: (planId: string) => void;
  onEditDate: () => void;
  onEditTime: () => void;
  onEditEntree: () => void;
  onEditLineup: () => void;
  onEditDress: () => void;
};

export function SummaryStep({
  recipientName,
  selectedDate,
  selectedDateLabel,
  selectedTime,
  selectedTimeLabel,
  selectedEntree,
  selectedActivities,
  dressVibe,
  inviteToken,
  onConfirmed,
  onEditDate,
  onEditTime,
  onEditEntree,
  onEditLineup,
  onEditDress,
}: SummaryStepProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const foodIcon =
    selectedEntree in entreeIcons
      ? entreeIcons[selectedEntree as EntreeOption]
      : "🍽️";

  async function handleLockIn() {
    if (!inviteToken) return;
    setSubmitting(true);
    setSubmitError(null);

    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteToken,
        selectedDate,
        selectedDateLabel,
        selectedTime,
        selectedTimeLabel,
        selectedEntree,
        selectedActivities,
        dressVibe,
      }),
    });

    if (!res.ok) {
      setSubmitting(false);
      setSubmitError("Couldn't save the plan. Try again.");
      return;
    }

    const { planId } = await res.json();
    onConfirmed(planId);
  }

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
          {dressVibe && (
            <SummaryRow
              icon="👗"
              label="Your vibe"
              value={DRESS_LABELS[dressVibe]}
              onEdit={onEditDress}
            />
          )}
        </dl>
      </div>
      <div className="mt-5">
        {inviteToken ? (
          <div className="grid gap-3">
            {submitError && (
              <p className="text-center text-sm text-red-500">{submitError}</p>
            )}
            <button
              type="button"
              onClick={handleLockIn}
              disabled={submitting}
              className="min-h-14 rounded-full bg-[#ff7aaa] px-5 py-3 text-lg font-black text-white shadow-[0_14px_30px_rgba(255,122,170,0.32)] outline-none transition disabled:opacity-60 focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
            >
              {submitting ? "Locking it in…" : "Lock it in 🔒"}
            </button>
          </div>
        ) : (
          <SharePlanButton
            recipientName={recipientName}
            selectedDateLabel={selectedDateLabel}
            selectedTimeLabel={selectedTimeLabel}
            selectedEntree={selectedEntree}
            selectedActivities={selectedActivities}
          />
        )}
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
        <dd className="mt-1 text-lg font-black text-[#3a2530]">{value}</dd>
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
