import { Check } from "lucide-react";
import { Icon } from "@higgsfield/quanta/icon";
import { STORY_STEPS, stepIndex } from "@/lib/story-templates";

/**
 * The 8-step production journey bar (MVP v2 spec): always visible in the Story
 * Workspace so the user always knows where the story is and what to do next.
 * Completed steps show a check, the current step is highlighted, later steps
 * are dimmed. Only validated (earlier) steps are clickable — production moves
 * forward one validation at a time, never on its own.
 */
export function StepBar({
  currentStep,
  onSelectStep,
}: {
  currentStep: string;
  onSelectStep?: (stepId: string) => void;
}) {
  const currentIdx = stepIndex(currentStep);
  const activeIdx = currentIdx >= 0 ? currentIdx : -1;

  return (
    <nav aria-label="Production steps" className="flex w-full items-stretch gap-1 overflow-x-auto">
      {STORY_STEPS.map((step, idx) => {
        const isDone = activeIdx >= 0 && idx < activeIdx;
        const isCurrent = idx === activeIdx;
        const clickable = isDone || isCurrent;

        return (
          <button
            key={step.id}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onSelectStep?.(step.id)}
            title={isDone ? `Step ${idx + 1}: ${step.label} (validated)` : isCurrent ? `Step ${idx + 1}: ${step.label} (in progress)` : `Step ${idx + 1}: ${step.label}`}
            aria-current={isCurrent ? "step" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-colors ${
              isCurrent
                ? "border-q-brand-primary/60 bg-q-brand-primary/10"
                : isDone
                  ? "border-q-border-subtle bg-q-background-secondary hover:border-q-border-strong"
                  : "border-q-border-subtle bg-q-background-secondary/40 opacity-60"
            }`}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                isDone
                  ? "bg-cine-success text-white"
                  : isCurrent
                    ? "bg-q-brand-primary text-white"
                    : "bg-q-transparent-light-10 text-q-text-tertiary"
              }`}
            >
              {isDone ? <Icon as={Check} size="xs" /> : idx + 1}
            </span>
            <span
              className={`w-full truncate text-center text-[11px] font-medium ${
                isCurrent ? "text-q-brand-primary" : "text-q-text-secondary"
              }`}
            >
              {step.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}