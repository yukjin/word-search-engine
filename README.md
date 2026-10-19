# word-search-engine

Seeded, deterministic word search puzzle generator and validator for TypeScript and Node.js.

This is the engine behind [zlingbo.com](https://zlingbo.com), a free word search site where you can [play online](https://zlingbo.com/), [print puzzles with answer keys](https://zlingbo.com/printable-word-search/), [make your own](https://zlingbo.com/word-search-maker/), or [embed a puzzle](https://zlingbo.com/embed-word-search/) on your site.

## Why this engine

- **Deterministic.** The same input and seed always produce the same puzzle, byte for byte. You can ship a seed instead of a grid, or regenerate a printable answer key later.
- **No silent drops.** Every requested word is placed, or generation fails with a typed `PuzzleGenerationError` (`INSUFFICIENT_WORDS`, `PLACEMENT_EXHAUSTED`, ...). It never quietly returns a puzzle with fewer words.
- **Complete answer paths.** Each target lists every occurrence in an allowed direction, so a word that appears twice by accident is still accepted wherever the player finds it.
- **Fair difficulty.** A word never also appears in a direction the difficulty does not allow (for example, backwards on easy).
- **Filler safety check.** Random filler letters are re-rolled if they spell a small list of common offensive words. This is a backstop, not a full content filter.
- **Semantic validation.** `validatePuzzle` re-checks geometry, bounds, letters, directions, duplicates, and a SHA-256 checksum, so you can verify puzzles you stored or received.
- **Bounded work.** Backtracking search is capped by node and attempt limits, so a bad word list fails fast instead of hanging.
- **Zero runtime dependencies.** Only `node:crypto` is used, for the checksum.

## Install

Not on npm yet. Install from GitHub:

```sh
npm install github:yukjin/word-search-engine
```

Requires Node.js 20.11 or newer.

## Quick start

```ts
import { generatePuzzle, validatePuzzle } from "word-search-engine";

const words = ["Cat", "Dog", "Bird", "Fish", "Frog", "Lion", "Bear", "Duck", "Goat", "Wolf"]
  .map((display) => ({ id: display.toLowerCase(), display, letters: display.toUpperCase() }));

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
console.log(validatePuzzle(puzzle)); // []
```

Output:

```text
EGOATNUGQF
YWALIONWMD
KOZTRFUUJO
FLMFISHVVW
TFPBVTPOGF
CNVIEVSUNR
ASBRDFPXPO
TDPDUABVVG
VMJICVGKQT
VHHLKESHTQ
```

Run it yourself with `npm run example`.

## Difficulty levels

| Difficulty | Grid | Words | Word length | Directions |
| --- | --- | --- | --- | --- |
| `easy` | 10 x 10 | 8 | 3 to 8 | right, down |
| `medium` | 12 x 12 | 12 | 3 to 10 | right, down, two diagonals |
| `hard` | 14 x 14 | 16 | 3 to 12 | all 8, including backwards |

You can see each level on the live site: [easy word search](https://zlingbo.com/easy-word-search/) and [hard word search](https://zlingbo.com/hard-word-search/).

## Word pool rules

Each entry is `{ id, display, letters }`:

- `id` matches `^[a-z0-9][a-z0-9_-]*$` and is unique.
- `letters` is uppercase `A-Z` only and unique across the pool.
- `display` must normalize to `letters` after removing spaces and hyphens and uppercasing, so `"Ice Cream"` pairs with `"ICECREAM"`.

Words outside the difficulty's length range are skipped. If fewer than the required count remain, you get `INSUFFICIENT_WORDS`.

## Output shape

```ts
interface Puzzle {
  id: string;
  themeId: string;
  locale: "en-US";
  difficulty: "easy" | "medium" | "hard";
  rows: 10 | 12 | 14;
  cols: 10 | 12 | 14;
  grid: string[];                 // one uppercase string per row
  allowedDirections: Direction[];
  targets: Array<{
    id: string;
    display: string;
    letters: string;
    paths: Array<{ start: Coord; end: Coord }>; // inclusive, zero-based, origin top-left
  }>;
  engineVersion: string;
  contentVersion: string;
  checksum: `sha256:${string}`;
}
```

The checksum is the SHA-256 of the puzzle JSON with keys sorted recursively and the `checksum` field omitted.

## API

| Export | Purpose |
| --- | --- |
| `generatePuzzle(input)` | Build a puzzle or throw `PuzzleGenerationError`. |
| `validatePuzzle(puzzle)` | Return a list of issues; empty means valid. |
| `assertPuzzleValid(puzzle)` | Throw if any issue is found. |
| `findWordPaths(grid, letters, directions?)` | Find every occurrence of a word. |
| `readPath(grid, start, end)` | Read the letters along a straight segment. |
| `directionFromDelta(start, end)` | `"E"`, `"NW"`, ... or `null` if not straight. |
| `puzzleChecksum(puzzle)` | Compute the canonical checksum. |
| `seededRandom(seed)`, `shuffle(values, random)` | The deterministic PRNG used internally. |
| `DIFFICULTY`, `VECTORS`, `ALL_DIRECTIONS` | Rule tables. |

Optional tuning on `generatePuzzle`: `maxPlacementNodes` (default 250,000), `placementAttempts` (default 48), and `fillAttempts` (default 96).

## Development

```sh
npm install
npm test        # includes a 5,000-seed sweep across 12 themes and 3 difficulties
npm run build
```

## License

MIT. If you build something with it, a link back to [zlingbo.com](https://zlingbo.com) is appreciated but not required.
