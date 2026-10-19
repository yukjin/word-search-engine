import { generatePuzzle, validatePuzzle } from "../src/index.js";

const words = [
  "Cat", "Dog", "Bird", "Fish", "Frog", "Lion", "Bear", "Duck", "Goat", "Wolf",
].map((display) => ({ id: display.toLowerCase(), display, letters: display.toUpperCase() }));

const puzzle = generatePuzzle({
  id: "animals-easy-demo",
  themeId: "animals",
  wordPool: words,
  difficulty: "easy",
  seed: "hello-world",
  engineVersion: "1.0.0",
  contentVersion: "demo",
});

console.log(puzzle.grid.join("\n"));
console.log();
for (const target of puzzle.targets) {
  const { start, end } = target.paths[0]!;
  console.log(`${target.display.padEnd(6)} (${start.row},${start.col}) -> (${end.row},${end.col})`);
}
console.log(`\nvalid: ${validatePuzzle(puzzle).length === 0}  checksum: ${puzzle.checksum.slice(0, 19)}...`);
