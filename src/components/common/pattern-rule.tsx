import { cn } from "@/lib/utils";

type PatternRuleProps = {
  className?: string;
  /** Vertical spacing applied above/below the rule. */
  spacing?: "none" | "sm" | "md" | "lg";
};

const SPACING: Record<NonNullable<PatternRuleProps["spacing"]>, string> = {
  none: "",
  sm: "my-3",
  md: "my-6",
  lg: "my-10",
};

/**
 * The thin "өлзий хээ" divider. Wraps the `.ulzii-rule` CSS class with
 * optional vertical spacing — used between sections and under chrome.
 */
export function PatternRule({ className, spacing = "md" }: PatternRuleProps) {
  return (
    <div
      role="separator"
      aria-hidden
      className={cn("ulzii-rule", SPACING[spacing], className)}
    />
  );
}
