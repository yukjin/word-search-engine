import type { Coord, Path } from "./types.js";
import { ALL_DIRECTIONS, VECTORS, type DirectionName } from "./spec.js";

export interface FoundPath {
  path: Path;
  direction: DirectionName;
}

export function pathGeometryKey(path: Path): string {
  const first = `${path.start.row},${path.start.col}`;
  const second = `${path.end.row},${path.end.col}`;
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

export function directionFromDelta(start: Coord, end: Coord): DirectionName | null {
  const row = end.row - start.row;
  const col = end.col - start.col;
  if (row === 0 && col !== 0) return col > 0 ? "E" : "W";
  if (col === 0 && row !== 0) return row > 0 ? "S" : "N";
  if (Math.abs(row) === Math.abs(col) && row !== 0) {
    if (row > 0) return col > 0 ? "SE" : "SW";
    return col > 0 ? "NE" : "NW";
  }
  return null;
}

export function readPath(grid: readonly string[], start: Coord, end: Coord): string | null {
  const direction = directionFromDelta(start, end);
  if (!direction || grid.length === 0) return null;
  const vector = VECTORS[direction];
  const distance = Math.max(Math.abs(end.row - start.row), Math.abs(end.col - start.col));
  const letters: string[] = [];
  for (let step = 0; step <= distance; step += 1) {
    const row = start.row + vector.row * step;
    const col = start.col + vector.col * step;
    const letter = grid[row]?.[col];
    if (!letter) return null;
    letters.push(letter);
  }
  return letters.join("");
}

export function findWordPaths(
  grid: readonly string[],
  letters: string,
  directions: readonly DirectionName[] = ALL_DIRECTIONS,
): FoundPath[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const paths: FoundPath[] = [];
  const seen = new Set<string>();
  for (const direction of directions) {
    const vector = VECTORS[direction];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const endRow = row + vector.row * (letters.length - 1);
        const endCol = col + vector.col * (letters.length - 1);
        if (endRow < 0 || endRow >= rows || endCol < 0 || endCol >= cols) continue;
        let matched = true;
        for (let step = 0; step < letters.length; step += 1) {
          if (grid[row + vector.row * step]?.[col + vector.col * step] !== letters[step]) {
            matched = false;
            break;
          }
        }
        if (!matched) continue;
        const path: Path = {
          start: { row, col },
          end: { row: endRow, col: endCol },
        };
        const key = pathGeometryKey(path);
        if (seen.has(key)) continue;
        seen.add(key);
        paths.push({ path, direction });
      }
    }
  }
  return paths;
}

