// Retained only so existing projects can recognize and remove the old seeded template bank.
export const LEGACY_DEFAULT_HOOK_PATTERNS = [
  "how to actually use {app} without making it complicated",
  "everyone uses {app} wrong... here's the easier way",
  "they really hid this {category} feature 💀",
  "i had NO idea {app} could do this",
  "3 years struggling with {problem}... and this was the fix??",
  "why is literally nobody talking about this?",
  "i can't believe i was doing this manually",
  "this feels illegal... but it works 😭",
  "i wish someone showed me this sooner",
  "this one feature saved me hours",
  "you're overcomplicating {task}",
  "stop doing {task} the hard way",
  "this tiny trick changes everything",
  "the easiest way to {desired outcome}",
  "the {app} feature everyone ignores",
  "i found the shortcut nobody mentions",
  "if you use {app}, watch this first",
  "this is the only {app} tutorial you actually need",
  "you can do THIS in {app}?!",
  "the fastest way to {outcome} without paying",
  "wait... you can actually do this??",
  "i've been doing this wrong the whole time 💀",
  "nobody told me there was an easier way",
  "why did i only find this NOW",
  "i thought this would take hours...",
  "apparently i've been wasting so much time 😭",
  "there's no way it's actually this easy",
  "this would've saved me so much time",
  "i accidentally found the easiest way to {outcome}",
  "okay this is actually useful",
  "POV: you finally stop doing {task} manually",
] as const;

export function containsOnlyLegacyDefaultHookPatterns(patterns: readonly string[]): boolean {
  return patterns.length > 0 && patterns.every((pattern) => LEGACY_DEFAULT_HOOK_PATTERNS.includes(
    pattern as (typeof LEGACY_DEFAULT_HOOK_PATTERNS)[number],
  ));
}
