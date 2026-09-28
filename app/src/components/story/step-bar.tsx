import { Check, Undo2 } from "lucide-react";
import { Icon } from "@higgsfield/quanta/icon";
import { STORY_STEPS, stepIndex } from "@/lib/story-templates";

/**
 * The 8-step production journey bar (MVP v2 spec): always visible in the Story
 * Workspace so the user always knows where the story is and what to do next.
 *
 * It is also the way BACK. Production only ever moves forward one validation at
 * a time, but seeing a mistake in a later step (a drifted storyboard image, say)
 * must not be a dead end — every step the story has REACHED is clickable, and
 * selecting an earlier one opens it for review without rewinding the story.
 *
 * Two indices, deliberately separate:
 *   - `currentStep` — how far production has actually got (never moves back)
 *   - `viewStep`    — which step is on screen (may be an earlier one)
 */
export function StepBar({
  currentStep,
  viewStep,
  onSelectStep,
}: {
  currentStep: string;
  viewStep?: string;
  onSelectStep?: (stepId: string) => void;
}) {
  const reachedIdx = stepIndex(currentStep);
  const viewIdx = stepIndex(viewStep ?? currentStep);

  return (
    <nav aria-label="Production steps" className="flex w-full items-stretch gap-1 overflow-x-auto">
      {STORY_STEPS.map((step, idx) => {
        const isDone = reachedIdx >= 0 && idx < reachedIdx;
        const isViewed = idx === viewIdx;
        const reached = reachedIdx >= 0 && idx <= reachedIdx;
        const clickable = reached && onSelectStep != null;
        // Reviewing a step production has already moved past.
        const isReview = isViewed && isDone;
        const label = `Step ${idx + 1}: ${step.label}`;
        const hint = isReview
          ? `${label} (completed — click to reopen)`
          : isViewed
            ? `${label} (in progress)`
            : isDone
              ? `${label} (completed — click to reopen)`
              : reached
                ? `${label} (click to open)`
                : label;

        return (
          <button
            key={step.id}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onSelectStep?.(step.id)}
            title={hint}
            aria-label={hint}
            aria-current={isViewed ? "step" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-colors ${
              isViewed
                ? "border-q-brand-primary/60 bg-q-brand-primary/10"
                : isDone
                  ? "border-q-border-subtle bg-q-background-secondary hover:border-q-border-strong"
                  : "border-q-border-subtle bg-q-background-secondary/40 opacity-60"
            } ${clickable ? "cursor-pointer" : "cursor-default"}`}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                isDone
                  ? "bg-cine-success text-white"
                  : isViewed
                    ? "bg-q-brand-primary text-white"
                    : "bg-q-transparent-light-10 text-q-text-tertiary"
              }`}
            >
              {isDone ? <Icon as={Check} size="xs" /> : idx + 1}
            </span>
            <span
              className={`flex w-full items-center justify-center gap-1 truncate text-center text-[11px] font-medium ${
                isViewed ? "text-q-brand-primary" : "text-q-text-secondary"
              }`}
            >
              {isReview ? <Icon as={Undo2} size="xs" /> : null}
              <span className="truncate">{step.label}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
