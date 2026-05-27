import { describe, expect, it } from "vitest";
import { computeCopelandResult } from "./copeland";
import type { SnapshotVote } from "../types";

function vote(id: string, choice: number[], vp: number): SnapshotVote {
  return {
    id,
    voter: `0x${id.padStart(40, "0")}`,
    choice,
    vp,
    vp_by_strategy: [vp]
  };
}

describe("computeCopelandResult", () => {
  it("scores wins and ties from ranked Snapshot choices", () => {
    const result = computeCopelandResult(
      ["A", "B", "C"],
      [vote("1", [1, 2, 3], 3), vote("2", [2, 1, 3], 2), vote("3", [3, 2, 1], 1)],
      null
    );

    expect(result.validVotes).toHaveLength(3);
    expect(result.totalVotingPower).toBe(6);
    expect(result.choices[0].copelandPoints).toBe(1.5);
    expect(result.choices[1].copelandPoints).toBe(1.5);
    expect(result.choices[2].copelandPoints).toBe(0);
    expect(result.choices[0].normalizedScore).toBe(3);
    expect(result.choices[1].normalizedScore).toBe(3);
    expect(result.choices[2].normalizedScore).toBe(0);
  });

  it("ignores invalid votes and only compares ranked pairs", () => {
    const result = computeCopelandResult(
      ["A", "B", "C"],
      [
        vote("1", [1, 2], 10),
        vote("2", [2, 2], 20),
        { ...vote("3", [3, 4], 30), choice: [3, 4] }
      ],
      null
    );

    expect(result.validVotes).toHaveLength(1);
    expect(result.invalidVotes).toHaveLength(2);
    expect(result.matches.find((match) => match.id === "0-1")?.supportA).toBe(10);
    expect(result.matches.find((match) => match.id === "0-2")?.total).toBe(0);
  });
});
