import { createHash } from "node:crypto";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function puzzleChecksum(puzzle: object): `sha256:${string}` {
  const { checksum: _omitted, ...withoutChecksum } = puzzle as Record<string, unknown>;
  const canonicalJson = JSON.stringify(stableValue(withoutChecksum));
  const hash = createHash("sha256").update(canonicalJson, "utf8").digest("hex");
  return `sha256:${hash}`;
}
