"use client";

import { AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useEffect, useMemo, useState } from "react";
import { DateStep } from "./DateStep";
import { DateAvatar } from "./DateAvatar";
import { DressStep } from "./DressStep";
import { EntreeStep } from "./EntreeStep";
import { FloatingDecor } from "./FloatingDecor";
import { InvitationStep } from "./InvitationStep";
import { LineupStep } from "./LineupStep";
import { ProgressHearts } from "./ProgressHearts";
import { PersonCursor } from "./PersonCursor";
import { SummaryStep } from "./SummaryStep";
import { TimeStep } from "./TimeStep";
import type { DatePlanState, PlannerStep } from "./types";

type DatePlannerProps = {
  recipientName: string;
  inviteToken?: string;
};

const initialStep: PlannerStep = "invite";

export function DatePlanner({ recipientName, inviteToken }: DatePlannerProps) {
  const [state, setState] = useState<DatePlanState>({
    recipientName,
    step: initialStep,
    selectedDate: null,
    selectedDateLabel: null,
    selectedTime: null,
    selectedTimeLabel: null,
    selectedEntree: null,
    selectedDessert: null,
    selectedActivities: [],
    dressVibe: null,
    noAttempts: 0,
    hasAccepted: false,
  });
  const [cursorMessage, setCursorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!cursorMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCursorMessage(null), 2200);

    return () => window.clearTimeout(timeoutId);
  }, [cursorMessage]);

  const canShowSummary = useMemo(
    () =>
      Boolean(
        state.selectedDateLabel &&
          state.selectedTimeLabel &&
          state.selectedEntree &&
          state.selectedActivities.length === 2 &&
          state.dressVibe,
      ),
    [
      state.selectedActivities.length,
      state.selectedDateLabel,
      state.selectedEntree,
      state.selectedTimeLabel,
    ],
  );

  function setStep(step: PlannerStep) {
    setState((current) => ({ ...current, step }));
  }

  function handleAccept() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduceMotion) {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.72 },
        scalar: 0.9,
        colors: ["#ff7aaa", "#ffd6e8", "#c7a6ff", "#b9e4ff", "#fff3d6"],
      });
    }

    setState((current) => ({
      ...current,
      step: "date",
      hasAccepted: true,
    }));
    setCursorMessage(null);
  }

  function toggleActivity(activity: string) {
    setState((current) => {
      const selectedActivities = current.selectedActivities.includes(activity)
        ? current.selectedActivities.filter((item) => item !== activity)
        : current.selectedActivities.length >= 2
          ? current.selectedActivities
          : [...current.selectedActivities, activity];

      return { ...current, selectedActivities };
    });
  }

  return (
    <main className="relative isolate flex min-h-svh flex-1 items-center justify-center overflow-hidden px-4 py-5 sm:px-6">
      <FloatingDecor />
      <PersonCursor message={cursorMessage} />
      <DateAvatar step={state.step} />
      <div className="relative z-10 w-full max-w-lg">
        <ProgressHearts currentStep={state.step} />
        <AnimatePresence mode="wait">
          {state.step === "invite" ? (
            <InvitationStep
              key="invite"
              recipientName={state.recipientName}
              noAttempts={state.noAttempts}
              onNoAttempt={() =>
                setState((current) => ({
                  ...current,
                  noAttempts: current.noAttempts + 1,
                }))
              }
              onNoCommentary={(message) => {
                setCursorMessage(message);
              }}
              onAccept={handleAccept}
            />
          ) : null}

          {state.step === "date" ? (
            <DateStep
              key="date"
              selectedDate={state.selectedDate}
              onSelect={(selectedDate, selectedDateLabel) =>
                setState((current) => ({
                  ...current,
                  selectedDate,
                  selectedDateLabel,
                  selectedTime: null,
                  selectedTimeLabel: null,
                  selectedActivities: [],
                }))
              }
              onBack={() => setStep("invite")}
              onNext={() => setStep("time")}
            />
          ) : null}

          {state.step === "time" ? (
            <TimeStep
              key="time"
              selectedDate={state.selectedDate}
              selectedTime={state.selectedTime}
              onSelect={(selectedTime, selectedTimeLabel) =>
                setState((current) => ({
                  ...current,
                  selectedTime,
                  selectedTimeLabel,
                  selectedActivities: [],
                }))
              }
              onBack={() => setStep("date")}
              onNext={() => setStep("lineup")}
            />
          ) : null}

          {state.step === "lineup" ? (
            <LineupStep
              key="lineup"
              selectedTime={state.selectedTime}
              selectedDateLabel={state.selectedDateLabel}
              selectedActivities={state.selectedActivities}
              onToggle={toggleActivity}
              onSetActivities={(selectedActivities) =>
                setState((current) => ({ ...current, selectedActivities }))
              }
              onBack={() => setStep("time")}
              onNext={() => setStep("entree")}
            />
          ) : null}

          {state.step === "entree" ? (
            <EntreeStep
              key="entree"
              selectedEntree={state.selectedEntree}
              onSelectEntree={(selectedEntree) =>
                setState((current) => ({ ...current, selectedEntree }))
              }
              onBack={() => setStep("lineup")}
              onNext={() => setStep("dress")}
            />
          ) : null}

          {state.step === "dress" ? (
            <DressStep
              key="dress"
              selected={state.dressVibe}
              onSelect={(dressVibe) =>
                setState((current) => ({ ...current, dressVibe }))
              }
              onBack={() => setStep("entree")}
              onNext={() => setStep("summary")}
            />
          ) : null}

          {state.step === "summary" && canShowSummary ? (
            <SummaryStep
              key="summary"
              recipientName={state.recipientName}
              selectedDateLabel={state.selectedDateLabel ?? ""}
              selectedTimeLabel={state.selectedTimeLabel ?? ""}
              selectedEntree={state.selectedEntree ?? ""}
              selectedActivities={state.selectedActivities}
              dressVibe={state.dressVibe}
              inviteToken={inviteToken}
              selectedDate={state.selectedDate ?? undefined}
              selectedTime={state.selectedTime ?? undefined}
              onEditDate={() => setStep("date")}
              onEditTime={() => setStep("time")}
              onEditEntree={() => setStep("entree")}
              onEditLineup={() => setStep("lineup")}
              onEditDress={() => setStep("dress")}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}
