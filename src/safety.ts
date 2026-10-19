import { ALL_DIRECTIONS } from "./spec.js";
import { findWordPaths } from "./paths.js";

// This small rule list catches common accidental filler matches. It is a backstop,
// not an exhaustive language or age-appropriateness review.
const BLOCKED_FILL_TERMS = [
  "ASSHOLE", "BASTARD", "BITCH", "COCK", "CUNT", "FUCK", "PISS", "SHIT", "SLUT", "WHORE",
];

export function findSensitiveMatches(grid: readonly string[]): string[] {
  const matches = new Set<string>();
  for (const term of BLOCKED_FILL_TERMS) {
    if (findWordPaths(grid, term, ALL_DIRECTIONS).length > 0) matches.add(term);
  }
  return [...matches].sort();
}

