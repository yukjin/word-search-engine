import type { Path, Puzzle, PuzzleTarget, WordEntry, Difficulty, GeneratePuzzleInput } from "./types.js";
import { PuzzleGenerationError } from "./types.js";
import { DIFFICULTY, VECTORS, type DirectionName, type Vector } from "./spec.js";
import { puzzleChecksum } from "./checksum.js";
import { findWordPaths, pathGeometryKey } from "./paths.js";
import { findSensitiveMatches } from "./safety.js";
import { seededRandom, shuffle, type Random } from "./random.js";
import { validatePuzzle } from "./validate.js";

interface Placement {
  path: Path;
  cells: Array<{ row: number; col: number; letter: string }>;
}

function normalizedPool(pool: readonly WordEntry[], difficulty: Difficulty): WordEntry[] {
  if (!Array.isArray(pool) || pool.length === 0) {
    throw new PuzzleGenerationError("INVALID_WORD_POOL", "wordPool must contain candidate words.");
  }
  const spec = DIFFICULTY[difficulty];
  const ids = new Set<string>();
  const normalizedLetters = new Set<string>();
  const result: WordEntry[] = [];
  for (const [index, entry] of pool.entries()) {
    if (!entry || typeof entry.id !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(entry.id)) {
      throw new PuzzleGenerationError("INVALID_WORD_POOL", `Word ${index} has an invalid id.`);
    }
    if (typeof entry.display !== "string" || entry.display.trim().length === 0 || entry.display.length > 64) {
      throw new PuzzleGenerationError("INVALID_WORD_POOL", `Word ${entry.id} has an invalid display value.`);
    }
    if (typeof entry.letters !== "string" || !/^[A-Z]+$/.test(entry.letters)) {
      throw new PuzzleGenerationError("INVALID_WORD_POOL", `Word ${entry.id} letters must be uppercase A-Z.`);
    }
    if (entry.display.replace(/[ -]/g, "").toUpperCase() !== entry.letters) {
      throw new PuzzleGenerationError("INVALID_WORD_POOL", `Word ${entry.id} display does not normalize to its letters.`);
    }
    if (ids.has(entry.id) || normalizedLetters.has(entry.letters)) {
      throw new PuzzleGenerationError("INVALID_WORD_POOL", `Word pool has a duplicate id or normalized spelling at ${entry.id}.`);
    }
    ids.add(entry.id);
    normalizedLetters.add(entry.letters);
    if (entry.letters.length >= spec.minWordLength && entry.letters.length <= spec.maxWordLength) {
      result.push({ id: entry.id, display: entry.display.trim(), letters: entry.letters });
    }
  }
  if (result.length < spec.targetCount) {
    throw new PuzzleGenerationError(
      "INSUFFICIENT_WORDS",
      `${difficulty} needs ${spec.targetCount} unique words of length ${spec.minWordLength}-${spec.maxWordLength}; found ${result.length}.`,
    );
  }
  return result;
}

function endpointFits(row: number, col: number, vector: Vector, length: number, rows: number, cols: number): boolean {
  const endRow = row + vector.row * (length - 1);
  const endCol = col + vector.col * (length - 1);
  return endRow >= 0 && endRow < rows && endCol >= 0 && endCol < cols;
}

function allPlacements(rows: number, cols: number, entry: WordEntry, directions: readonly DirectionName[], random: Random): Placement[] {
  const candidates: Placement[] = [];
  for (const direction of shuffle(directions, random)) {
    const vector = VECTORS[direction];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (!endpointFits(row, col, vector, entry.letters.length, rows, cols)) continue;
        const endRow = row + vector.row * (entry.letters.length - 1);
        const endCol = col + vector.col * (entry.letters.length - 1);
        const cells = [...entry.letters].map((letter, step) => ({
          row: row + vector.row * step,
          col: col + vector.col * step,
          letter,
        }));
        candidates.push({ path: { start: { row, col }, end: { row: endRow, col: endCol } }, cells });
      }
    }
  }
  return shuffle(candidates, random);
}

function tryPlaceWords(
  entries: readonly WordEntry[],
  rows: number,
  cols: number,
  directions: readonly DirectionName[],
  random: Random,
  maxNodes: number,
  diagnostics: { nodes: number; deepest: number },
): { grid: Array<Array<string | null>>; placements: Map<string, Path> } | null {
  const grid = Array.from({ length: rows }, () => Array<string | null>(cols).fill(null));
  const placements = new Map<string, Path>();
  let nodes = 0;

  const placeAt = (index: number): boolean => {
    diagnostics.deepest = Math.max(diagnostics.deepest, index);
    if (index >= entries.length) return true;
    const entry = entries[index]!;
    const candidates = allPlacements(rows, cols, entry, directions, random);
    for (const candidate of candidates) {
      nodes += 1;
      if (nodes > maxNodes) return false;
      let fits = true;
      for (const cell of candidate.cells) {
        const existing = grid[cell.row]?.[cell.col];
        if (existing !== null && existing !== cell.letter) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;
      const changed: Array<{ row: number; col: number }> = [];
      for (const cell of candidate.cells) {
        if (grid[cell.row]?.[cell.col] === null) {
          grid[cell.row]![cell.col] = cell.letter;
          changed.push({ row: cell.row, col: cell.col });
        }
      }
      placements.set(entry.id, candidate.path);
      if (placeAt(index + 1)) return true;
      placements.delete(entry.id);
      for (const cell of changed) grid[cell.row]![cell.col] = null;
      if (nodes > maxNodes) return false;
    }
    return false;
  };

  const success = placeAt(0);
  diagnostics.nodes = nodes;
  return success ? { grid, placements } : null;
}

function fillGrid(
  grid: Array<Array<string | null>>,
  random: Random,
): string[] {
  return grid.map((row) => row.map((letter) => letter ?? String.fromCharCode(65 + Math.floor(random() * 26))).join(""));
}

function hasFixedIllegalTarget(
  grid: Array<Array<string | null>>,
  entries: readonly WordEntry[],
  allowedDirections: readonly DirectionName[],
): boolean {
  const allowed = new Set(allowedDirections);
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  for (const entry of entries) {
    for (const direction of Object.keys(VECTORS) as DirectionName[]) {
      if (allowed.has(direction)) continue;
      const vector = VECTORS[direction];
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (!endpointFits(row, col, vector, entry.letters.length, rows, cols)) continue;
          let fixedMatch = true;
          for (let step = 0; step < entry.letters.length; step += 1) {
            const value = grid[row + vector.row * step]?.[col + vector.col * step];
            if (value === null || value !== entry.letters[step]) {
              fixedMatch = false;
              break;
            }
          }
          if (fixedMatch) return true;
        }
      }
    }
  }
  return false;
}

function chooseEntries(pool: readonly WordEntry[], count: number, random: Random): WordEntry[] {
  return shuffle(pool, random)
    .slice(0, count)
    .sort((left, right) => right.letters.length - left.letters.length || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

export function generatePuzzle(input: GeneratePuzzleInput): Puzzle {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(input.id) || !/^[a-z0-9][a-z0-9_-]*$/.test(input.themeId)) {
    throw new PuzzleGenerationError("INVALID_INPUT", "Puzzle id and themeId must use the contract id format.");
  }
  if (!String(input.seed).length || !input.engineVersion.trim() || !input.contentVersion.trim()) {
    throw new PuzzleGenerationError("INVALID_INPUT", "seed, engineVersion, and contentVersion are required.");
  }
  const spec = DIFFICULTY[input.difficulty];
  if (!spec) throw new PuzzleGenerationError("INVALID_INPUT", `Unsupported difficulty: ${String(input.difficulty)}.`);
  const pool = normalizedPool(input.wordPool, input.difficulty);
  const maxNodes = input.maxPlacementNodes ?? 250_000;
  const fillAttempts = input.fillAttempts ?? 96;
  const placementAttempts = input.placementAttempts ?? 48;
  let lastGrid: string[] | undefined;
  let lastPlacementNodes = 0;
  let lastPlacementDepth = 0;
  let lastChosen: WordEntry[] = [];
  let hadPlacedLayout = false;

  for (let placementAttempt = 0; placementAttempt < placementAttempts; placementAttempt += 1) {
    const chosen = chooseEntries(pool, spec.targetCount, seededRandom(`${input.seed}:choose:${placementAttempt}`));
    lastChosen = chosen;
    const random = seededRandom(`${input.seed}:place:${placementAttempt}`);
    const diagnostics = { nodes: 0, deepest: 0 };
    const placed = tryPlaceWords(chosen, spec.rows, spec.cols, spec.allowedDirections, random, maxNodes, diagnostics);
    lastPlacementNodes = diagnostics.nodes;
    lastPlacementDepth = diagnostics.deepest;
    if (!placed) continue;
    hadPlacedLayout = true;
    if (hasFixedIllegalTarget(placed.grid, chosen, spec.allowedDirections)) continue;
    for (let fillAttempt = 0; fillAttempt < fillAttempts; fillAttempt += 1) {
      const filled = fillGrid(placed.grid, seededRandom(`${input.seed}:fill:${placementAttempt}:${fillAttempt}`));
      lastGrid = filled;
      if (findSensitiveMatches(filled).length > 0) continue;

      const targets: PuzzleTarget[] = [];
      let safe = true;
      for (const entry of chosen) {
        const allowedPaths = findWordPaths(filled, entry.letters, spec.allowedDirections);
        const allowedKeys = new Set(allowedPaths.map(({ path }) => pathGeometryKey(path)));
        const illegalPaths = findWordPaths(filled, entry.letters)
          .filter(({ direction, path }) => !spec.allowedDirections.includes(direction) && !allowedKeys.has(pathGeometryKey(path)));
        if (!allowedPaths.length || illegalPaths.length || allowedPaths.length > 392) {
          safe = false;
          break;
        }
        targets.push({
          id: entry.id,
          display: entry.display,
          letters: entry.letters,
          paths: allowedPaths.map(({ path }) => path),
        });
      }
      if (!safe) continue;

      const candidate = {
        id: input.id,
        themeId: input.themeId,
        locale: "en-US" as const,
        difficulty: input.difficulty,
        rows: spec.rows,
        cols: spec.cols,
        grid: filled,
        allowedDirections: [...spec.allowedDirections],
        targets,
        engineVersion: input.engineVersion,
        contentVersion: input.contentVersion,
      };
      const puzzle: Puzzle = { ...candidate, checksum: puzzleChecksum(candidate) };
      const validation = validatePuzzle(puzzle);
      if (validation.length === 0) return puzzle;
    }
  }

  if (!lastGrid) {
    const code = hadPlacedLayout ? "SAFE_FILL_EXHAUSTED" : "PLACEMENT_EXHAUSTED";
    const message = hadPlacedLayout
      ? `Could not find a safe layout within ${placementAttempts} bounded placement attempts.`
      : `Could not place every target within ${maxNodes} search nodes per attempt (${lastPlacementNodes} nodes at depth ${lastPlacementDepth}/${lastChosen.length}; targets=${lastChosen.map((entry) => entry.id).join(",")}).`;
    throw new PuzzleGenerationError(code, message);
  }
  throw new PuzzleGenerationError("SAFE_FILL_EXHAUSTED", `Could not fill the grid safely after ${placementAttempts} placement attempts and ${fillAttempts} filler attempts each.`);
}
