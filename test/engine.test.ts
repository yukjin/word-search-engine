import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { generatePuzzle, PuzzleGenerationError, validatePuzzle } from "../src/index.js";
import type { Difficulty, Puzzle, WordEntry } from "../src/types.js";

const fixtures = resolve(import.meta.dirname, "fixtures");
const themes = JSON.parse(await readFile(resolve(fixtures, "themes.json"), "utf8")).themes as Array<{
  id: string;
  contentVersion: string;
  words: WordEntry[];
}>;
const animalPool = themes[0]!.words;

async function fixture(name: string): Promise<Puzzle> {
  const file = JSON.parse(await readFile(resolve(fixtures, name), "utf8")) as { data: Puzzle };
  return file.data;
}

test("easy, medium, and hard fixtures pass semantic and checksum validation", async () => {
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    const puzzle = await fixture(`puzzle.${difficulty}.success.json`);
    assert.deepEqual(validatePuzzle(puzzle), [], `${difficulty} fixture`);
  }
});

test("validation catches a tampered grid", async () => {
  const puzzle = await fixture("puzzle.easy.success.json");
  const tampered = { ...puzzle, grid: [...puzzle.grid] };
  tampered.grid[0] = tampered.grid[0]!.replace(/^./, (letter) => (letter === "Q" ? "X" : "Q"));
  assert.ok(validatePuzzle(tampered).some((issue) => issue.code === "CHECKSUM"));
});

test("generation is deterministic for the same id, inputs, and seed", () => {
  const input = {
    id: "animals-easy-determinism-0001",
    themeId: "animals",
    wordPool: animalPool,
    difficulty: "easy" as const,
    seed: "reproducible-seed-1",
    engineVersion: "1.0.0",
    contentVersion: "animals-v1-draft",
  };
  assert.deepEqual(generatePuzzle(input), generatePuzzle(input));
});

test("rejects insufficient, duplicate, and malformed word pools", () => {
  const base = {
    id: "animals-easy-invalid-test",
    themeId: "animals",
    difficulty: "easy" as const,
    seed: "invalid-test",
    engineVersion: "1.0.0",
    contentVersion: "animals-v1-draft",
  };
  assert.throws(
    () => generatePuzzle({ ...base, wordPool: animalPool.slice(0, 7) }),
    (error: unknown) => error instanceof PuzzleGenerationError && error.code === "INSUFFICIENT_WORDS",
  );
  assert.throws(
    () => generatePuzzle({ ...base, wordPool: [...animalPool, animalPool[0]!] }),
    (error: unknown) => error instanceof PuzzleGenerationError && error.code === "INVALID_WORD_POOL",
  );
  assert.throws(
    () => generatePuzzle({ ...base, wordPool: [{ id: "broken", display: "Not A Word", letters: "WORD" }] }),
    (error: unknown) => error instanceof PuzzleGenerationError && error.code === "INVALID_WORD_POOL",
  );
});

test("5,000 deterministic seeds across all themes and difficulty levels produce valid puzzles", { timeout: 600_000 }, () => {
  const difficulties: Difficulty[] = ["easy", "medium", "hard"];
  for (let index = 0; index < 5_000; index += 1) {
    const theme = themes[index % themes.length]!;
    const difficulty = difficulties[Math.floor(index / themes.length) % difficulties.length]!;
    let puzzle: Puzzle;
    try {
      puzzle = generatePuzzle({
        id: `seed-check-${theme.id}-${difficulty}-${index}`,
        themeId: theme.id,
        wordPool: theme.words,
        difficulty,
        seed: `engine-seed-${index}`,
        engineVersion: "1.0.0",
        contentVersion: theme.contentVersion,
      });
    } catch (error) {
      throw new Error(`seed ${index} (${theme.id}/${difficulty}) failed: ${(error as Error).message}`);
    }
    assert.deepEqual(validatePuzzle(puzzle), [], `seed ${index}, ${theme.id}/${difficulty}`);
  }
});
