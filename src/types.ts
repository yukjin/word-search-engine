export type Difficulty = "easy" | "medium" | "hard";
export type Direction = "E" | "S" | "W" | "N" | "SE" | "SW" | "NE" | "NW";

/** Zero-based grid coordinate. Origin is top-left; rows grow downward, cols to the right. */
export interface Coord {
  row: number;
  col: number;
}

/** Straight horizontal, vertical, or diagonal segment. Start and end are inclusive. */
export interface Path {
  start: Coord;
  end: Coord;
}

export interface PuzzleTarget {
  id: string;
  display: string;
  letters: string;
  /** Every occurrence of the word in an allowed direction. */
  paths: Path[];
}

export interface Puzzle {
  id: string;
  themeId: string;
  locale: "en-US";
  difficulty: Difficulty;
  rows: 10 | 12 | 14;
  cols: 10 | 12 | 14;
  grid: string[];
  allowedDirections: Direction[];
  targets: PuzzleTarget[];
  engineVersion: string;
  contentVersion: string;
  /** `sha256:` + hex digest of the canonical JSON of every other field. */
  checksum: string;
}

export interface WordEntry {
  id: string;
  display: string;
  letters: string;
}

export interface GeneratePuzzleInput {
  id: string;
  themeId: string;
  wordPool: readonly WordEntry[];
  difficulty: Difficulty;
  seed: string | number;
  engineVersion: string;
  contentVersion: string;
  maxPlacementNodes?: number;
  placementAttempts?: number;
  fillAttempts?: number;
}

export type GenerationErrorCode =
  | "INVALID_INPUT"
  | "INVALID_WORD_POOL"
  | "INSUFFICIENT_WORDS"
  | "PLACEMENT_EXHAUSTED"
  | "SAFE_FILL_EXHAUSTED";

export class PuzzleGenerationError extends Error {
  constructor(
    readonly code: GenerationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PuzzleGenerationError";
  }
}

export interface PuzzleValidationIssue {
  code: string;
  message: string;
  targetId?: string;
}
