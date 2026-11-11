"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { motion } from "framer-motion";
import { noButtonLabels } from "@/lib/planner-copy";
import { useHydratedReducedMotion } from "./useHydratedReducedMotion";

type Point = {
  x: number;
  y: number;
};

const FALLBACK_YES_HALF_SIZE = {
  x: 88,
  y: 40,
};

const FALLBACK_NO_HALF_SIZE = {
  x: 40,
  y: 32,
};

const CONTROL_GAP = 8;
const INITIAL_POSITION: Point = {
  x: -(FALLBACK_YES_HALF_SIZE.x + FALLBACK_NO_HALF_SIZE.x + CONTROL_GAP),
  y: 0,
};

const RAY_EPSILON = 0.001;
const MIN_DODGE_DISTANCE = 34;

type EvasiveNoButtonProps = {
  attempts: number;
  yesButtonRef: RefObject<HTMLButtonElement | null>;
  onAttempt: () => void;
  onCommentary: (message: string) => void;
  /**
   * The box the No button must stay inside, centred on the Yes button (the
   * button's positioned parent). Without it the button may roam a little
   * outside its parent, which the full-page invite has room for.
   */
  boundsRef?: RefObject<HTMLElement | null>;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getDodgeHalfSize(
  yesButtonRef: RefObject<HTMLButtonElement | null>,
  noButton: HTMLButtonElement | null,
  bounds?: HTMLElement | null,
) {
  const yesRect = yesButtonRef.current?.getBoundingClientRect();
  const noRect = noButton?.getBoundingClientRect();
  const halfSize = {
    x:
      (yesRect?.width ?? FALLBACK_YES_HALF_SIZE.x * 2) / 2 +
      (noRect?.width ?? FALLBACK_NO_HALF_SIZE.x * 2) / 2 +
      CONTROL_GAP,
    y:
      (yesRect?.height ?? FALLBACK_YES_HALF_SIZE.y * 2) / 2 +
      (noRect?.height ?? FALLBACK_NO_HALF_SIZE.y * 2) / 2 +
      CONTROL_GAP,
  };
  if (!bounds) return halfSize;

  // Keep the whole button inside the bounds: its centre may travel at most
  // half the bounds minus half the button.
  const boundsRect = bounds.getBoundingClientRect();
  const noWidth = noRect?.width ?? FALLBACK_NO_HALF_SIZE.x * 2;
  const noHeight = noRect?.height ?? FALLBACK_NO_HALF_SIZE.y * 2;
  return {
    x: Math.max(0, Math.min(halfSize.x, (boundsRect.width - noWidth) / 2)),
    y: Math.max(0, Math.min(halfSize.y, (boundsRect.height - noHeight) / 2)),
  };
}

function findPerimeterTarget(
  currentPosition: Point,
  direction: Point,
  halfSize: Point,
) {
  const origin = {
    x: clamp(currentPosition.x, -halfSize.x, halfSize.x),
    y: clamp(currentPosition.y, -halfSize.y, halfSize.y),
  };
  const intersections: number[] = [];

  if (direction.x > RAY_EPSILON) {
    intersections.push((halfSize.x - origin.x) / direction.x);
  } else if (direction.x < -RAY_EPSILON) {
    intersections.push((-halfSize.x - origin.x) / direction.x);
  }

  if (direction.y > RAY_EPSILON) {
    intersections.push((halfSize.y - origin.y) / direction.y);
  } else if (direction.y < -RAY_EPSILON) {
    intersections.push((-halfSize.y - origin.y) / direction.y);
  }

  const distanceToEdge = Math.min(
    ...intersections.filter((distance) => distance > RAY_EPSILON),
  );

  if (!Number.isFinite(distanceToEdge)) {
    return origin;
  }

  return {
    x: clamp(origin.x + direction.x * distanceToEdge, -halfSize.x, halfSize.x),
    y: clamp(origin.y + direction.y * distanceToEdge, -halfSize.y, halfSize.y),
  };
}

function choosePerimeterDodgeTarget(currentPosition: Point, halfSize: Point) {
  const origin = {
    x: clamp(currentPosition.x, -halfSize.x, halfSize.x),
    y: clamp(currentPosition.y, -halfSize.y, halfSize.y),
  };
  const hasDirectionToYes =
    Math.abs(origin.x) > RAY_EPSILON || Math.abs(origin.y) > RAY_EPSILON;
  const angleToYes = hasDirectionToYes
    ? Math.atan2(-origin.y, -origin.x)
    : Math.random() * Math.PI * 2;
  let bestTarget = origin;
  let bestDistance = 0;

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const angle = angleToYes + (Math.random() - 0.5) * Math.PI;
    const direction = {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };
    const target = findPerimeterTarget(origin, direction, halfSize);
    const travelDistance = Math.hypot(target.x - origin.x, target.y - origin.y);

    if (travelDistance > bestDistance) {
      bestTarget = target;
      bestDistance = travelDistance;
    }

    if (travelDistance >= MIN_DODGE_DISTANCE) {
      return target;
    }
  }

  return bestTarget;
}

export function EvasiveNoButton({
  attempts,
  yesButtonRef,
  onAttempt,
  onCommentary,
  boundsRef,
}: EvasiveNoButtonProps) {
  const reduceMotion = useHydratedReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<Point>(INITIAL_POSITION);
  // With bounds, move the resting spot inside them before the first paint
  // (no spring), measured from the real button sizes.
  const [settled, setSettled] = useState(!boundsRef);
  useLayoutEffect(() => {
    if (!boundsRef) return;
    const halfSize = getDodgeHalfSize(yesButtonRef, buttonRef.current, boundsRef.current);
    setPosition({ x: -halfSize.x, y: 0 });
  }, [boundsRef, yesButtonRef]);
  // Runs after the instant move above has rendered; dodges spring from here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flips once after the instant settle
    setSettled(true);
  }, []);
  const [remainingLabels, setRemainingLabels] = useState<string[]>(
    noButtonLabels.slice(1),
  );

  function dodge() {
    onAttempt();

    const lastText = remainingLabels.length
      ? ""
      : noButtonLabels[Math.min(attempts, noButtonLabels.length - 1)];
    const pool = remainingLabels.length
      ? remainingLabels
      : noButtonLabels.filter((label) => label !== lastText);
    const nextText = pool[Math.floor(Math.random() * pool.length)] ?? noButtonLabels[0];

    onCommentary(nextText);
    setRemainingLabels(pool.filter((label) => label !== nextText));

    if (reduceMotion || typeof window === "undefined") {
      return;
    }

    setPosition((currentPosition) =>
      choosePerimeterDodgeTarget(
        currentPosition,
        getDodgeHalfSize(yesButtonRef, buttonRef.current, boundsRef?.current),
      ),
    );
  }

  const scale = Math.max(0.86, 1 - attempts * 0.035);
  return (
    <motion.div
      className={
        reduceMotion
          ? "absolute bottom-0 left-1/2 -translate-x-1/2"
          : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      }
      initial={reduceMotion ? false : { x: position.x, y: position.y }}
      animate={reduceMotion ? undefined : { x: position.x, y: position.y, scale }}
      transition={settled ? { type: "spring", stiffness: 420, damping: 26 } : { duration: 0 }}
    >
      <button
        ref={buttonRef}
        type="button"
        // One dodge per attempt: a mouse dodges on approach, a finger on touch
        // down, and the keyboard on Enter or Space (a click with detail 0).
        // React's touch listeners are passive, so preventDefault there only
        // logged an error and a tap dodged up to three times.
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") dodge();
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "touch") dodge();
        }}
        onClick={(event) => {
          if (event.detail === 0) dodge();
        }}
        className="grid min-h-16 min-w-20 place-items-center rounded-full border-2 border-[#ffd6e8] bg-white px-6 py-4 text-xl font-black text-[#8a6a78] shadow-[0_12px_24px_rgba(255,122,170,0.18)] outline-none transition hover:border-[#ff7aaa] focus-visible:ring-4 focus-visible:ring-[#ffd6e8]"
        aria-label="No"
      >
        No
      </button>
    </motion.div>
  );
}
