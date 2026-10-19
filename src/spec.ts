import type { Difficulty } from "./types.js";

export interface DifficultySpec {
  rows: 10 | 12 | 14;
  cols: 10 | 12 | 14;
  targetCount: 8 | 12 | 16;
  minWordLength: 3;
  maxWordLength: 8 | 10 | 12;
  allowedDirections: readonly DirectionName[];
}

export type DirectionName = "E" | "S" | "W" | "N" | "SE" | "SW" | "NE" | "NW";
export interface Vector {
  row: number;
  col: number;
}

export const VECTORS: Readonly<Record<DirectionName, Vector>> = {
  E: { row: 0, col: 1 },
  S: { row: 1, col: 0 },
  W: { row: 0, col: -1 },
  N: { row: -1, col: 0 },
  SE: { row: 1, col: 1 },
  SW: { row: 1, col: -1 },
  NE: { row: -1, col: 1 },
  NW: { row: -1, col: -1 },
};

export const ALL_DIRECTIONS = Object.freeze(Object.keys(VECTORS) as DirectionName[]);

export const DIFFICULTY: Readonly<Record<Difficulty, DifficultySpec>> = {
  easy: {
    rows: 10,
    cols: 10,
    targetCount: 8,
    minWordLength: 3,
    maxWordLength: 8,
    allowedDirections: ["E", "S"],
  },
  medium: {
    rows: 12,
    cols: 12,
    targetCount: 12,
    minWordLength: 3,
    maxWordLength: 10,
    allowedDirections: ["E", "S", "SE", "NE"],
  },
  hard: {
    rows: 14,
    cols: 14,
    targetCount: 16,
    minWordLength: 3,
    maxWordLength: 12,
    allowedDirections: ALL_DIRECTIONS,
  },
};

