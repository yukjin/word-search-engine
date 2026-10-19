import { ALL_DIRECTIONS, DIFFICULTY, type DirectionName } from "./spec.js";
import { directionFromDelta, findWordPaths, pathGeometryKey, readPath } from "./paths.js";
import { findSensitiveMatches } from "./safety.js";
import { puzzleChecksum } from "./checksum.js";
import type { Puzzle, PuzzleValidationIssue } from "./types.js";

export function validatePuzzle(puzzle: Puzzle): PuzzleValidationIssue[] {
  const issues: PuzzleValidationIssue[] = [];
  const spec = DIFFICULTY[puzzle.difficulty];
  if (puzzle.rows !== spec.rows || puzzle.cols !== spec.cols) {
    issues.push({ code: "GRID_SIZE", message: `${puzzle.difficulty} must be ${spec.rows}x${spec.cols}.` });
  }
  if (puzzle.grid.length !== puzzle.rows) {
    issues.push({ code: "GRID_ROWS", message: `Expected ${puzzle.rows} grid rows.` });
  }
  puzzle.grid.forEach((line, row) => {
    if (line.length !== puzzle.cols || !/^[A-Z]+$/.test(line)) {
      issues.push({ code: "GRID_ROW", message: `Grid row ${row} must contain ${puzzle.cols} uppercase A-Z letters.` });
    }
  });
  if (puzzle.targets.length !== spec.targetCount) {
    issues.push({ code: "TARGET_COUNT", message: `${puzzle.difficulty} requires ${spec.targetCount} targets.` });
  }
  if (puzzle.allowedDirections.join(",") !== spec.allowedDirections.join(",")) {
    issues.push({ code: "DIRECTIONS", message: `Allowed directions do not match the ${puzzle.difficulty} rules.` });
  }

  const ids = new Set<string>();
  const letters = new Set<string>();
  const allowedSet = new Set<DirectionName>(spec.allowedDirections);
  for (const target of puzzle.targets) {
    if (ids.has(target.id)) issues.push({ code: "DUPLICATE_TARGET_ID", message: "Target ids must be unique.", targetId: target.id });
    if (letters.has(target.letters)) issues.push({ code: "DUPLICATE_TARGET_WORD", message: "Normalized target words must be unique.", targetId: target.id });
    ids.add(target.id);
    letters.add(target.letters);
    if (target.letters.length < spec.minWordLength || target.letters.length > spec.maxWordLength || !/^[A-Z]+$/.test(target.letters)) {
      issues.push({ code: "TARGET_LENGTH", message: "Target letters do not fit the difficulty rules.", targetId: target.id });
    }
    if (target.display.replace(/[ -]/g, "").toUpperCase() !== target.letters) {
      issues.push({ code: "DISPLAY_MISMATCH", message: "Target display and normalized letters disagree.", targetId: target.id });
    }

    const providedKeys = new Set<string>();
    for (const path of target.paths) {
      const direction = directionFromDelta(path.start, path.end);
      const distance = Math.max(Math.abs(path.end.row - path.start.row), Math.abs(path.end.col - path.start.col));
      if (!direction || !allowedSet.has(direction) || distance !== target.letters.length - 1) {
        issues.push({ code: "PATH_GEOMETRY", message: "Target path must be a straight allowed segment of the correct length.", targetId: target.id });
        continue;
      }
      for (const coord of [path.start, path.end]) {
        if (coord.row < 0 || coord.row >= puzzle.rows || coord.col < 0 || coord.col >= puzzle.cols) {
          issues.push({ code: "PATH_BOUNDS", message: "Target path leaves the puzzle grid.", targetId: target.id });
          break;
        }
      }
      if (readPath(puzzle.grid, path.start, path.end) !== target.letters) {
        issues.push({ code: "PATH_TEXT", message: "Grid letters do not match the target path.", targetId: target.id });
      }
      const key = pathGeometryKey(path);
      if (providedKeys.has(key)) issues.push({ code: "DUPLICATE_PATH", message: "The same target path is listed more than once.", targetId: target.id });
      providedKeys.add(key);
    }

    const actual = findWordPaths(puzzle.grid, target.letters, spec.allowedDirections);
    const actualKeys = new Set(actual.map(({ path }) => pathGeometryKey(path)));
    for (const key of actualKeys) {
      if (!providedKeys.has(key)) issues.push({ code: "MISSING_PATH", message: "A valid target occurrence is missing from paths.", targetId: target.id });
    }
    for (const key of providedKeys) {
      if (!actualKeys.has(key)) issues.push({ code: "UNMATCHED_PATH", message: "A listed path is not present in the grid.", targetId: target.id });
    }

    const disallowed = findWordPaths(puzzle.grid, target.letters, ALL_DIRECTIONS)
      .filter(({ direction, path }) => !allowedSet.has(direction) && !actualKeys.has(pathGeometryKey(path)));
    if (disallowed.length) {
      issues.push({ code: "ILLEGAL_DIRECTION", message: "Target appears in a direction not allowed for this difficulty.", targetId: target.id });
    }
  }

  if (findSensitiveMatches(puzzle.grid).length) {
    issues.push({ code: "SENSITIVE_FILL", message: "Random filler contains a blocked term." });
  }
  if (puzzleChecksum(puzzle) !== puzzle.checksum) {
    issues.push({ code: "CHECKSUM", message: "Puzzle checksum does not match its content." });
  }
  return issues;
}

export function assertPuzzleValid(puzzle: Puzzle): void {
  const issues = validatePuzzle(puzzle);
  if (issues.length) {
    throw new Error(`Invalid puzzle ${puzzle.id}: ${issues.map((issue) => issue.code).join(", ")}`);
  }
}
