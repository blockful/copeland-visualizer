import type {
  ChoiceResult,
  CopelandResult,
  MatchVoter,
  MatrixCell,
  PairwiseMatch,
  RankedVote,
  SnapshotVote
} from "../types";

function isValidChoice(choice: number[], choicesCount: number): boolean {
  if (
    !Array.isArray(choice) ||
    choice.length === 0 ||
    choice.length > choicesCount ||
    new Set(choice).size !== choice.length
  ) {
    return false;
  }

  return choice.every(
    (choiceIndex) =>
      Number.isInteger(choiceIndex) &&
      choiceIndex >= 1 &&
      choiceIndex <= choicesCount
  );
}

export function normalizeRankedVote(
  vote: SnapshotVote,
  choicesCount: number
): RankedVote | null {
  if (!Array.isArray(vote.choice)) {
    return null;
  }

  const choice = vote.choice.map((value) => Number(value));
  const vp = Number(vote.vp ?? 0);

  if (!isValidChoice(choice, choicesCount) || !Number.isFinite(vp) || vp < 0) {
    return null;
  }

  return {
    id: vote.id,
    voter: vote.voter,
    created: vote.created,
    choice,
    vp,
    vpByStrategy: Array.isArray(vote.vp_by_strategy)
      ? vote.vp_by_strategy.map((score) => Number(score) || 0)
      : []
  };
}

function sortVoters(voters: MatchVoter[]): MatchVoter[] {
  return voters.sort((a, b) => b.vp - a.vp || a.voter.localeCompare(b.voter));
}

function assignRanks(choices: ChoiceResult[]): ChoiceResult[] {
  let currentRank = 0;
  let previousScore: number | null = null;

  return choices.map((choice, index) => {
    if (previousScore === null || choice.normalizedScore !== previousScore) {
      currentRank = index + 1;
      previousScore = choice.normalizedScore;
    }

    return { ...choice, rank: currentRank };
  });
}

export function computeCopelandResult(
  choiceNames: string[],
  votes: SnapshotVote[],
  snapshotScores: number[] | null | undefined
): CopelandResult {
  const choicesCount = choiceNames.length;
  const validVotes: RankedVote[] = [];
  const invalidVotes: SnapshotVote[] = [];

  for (const vote of votes) {
    const normalizedVote = normalizeRankedVote(vote, choicesCount);
    if (normalizedVote) {
      validVotes.push(normalizedVote);
    } else {
      invalidVotes.push(vote);
    }
  }

  const totalVotingPower = validVotes.reduce((total, vote) => total + vote.vp, 0);
  const rawPoints = Array(choicesCount).fill(0) as number[];
  const wins = Array(choicesCount).fill(0) as number[];
  const losses = Array(choicesCount).fill(0) as number[];
  const draws = Array(choicesCount).fill(0) as number[];
  const supportTotals = Array(choicesCount).fill(0) as number[];
  const marginTotals = Array(choicesCount).fill(0) as number[];

  const pairDetails = new Map<
    string,
    {
      supportA: number;
      supportB: number;
      supportersA: MatchVoter[];
      supportersB: MatchVoter[];
    }
  >();

  for (let a = 0; a < choicesCount; a += 1) {
    for (let b = a + 1; b < choicesCount; b += 1) {
      pairDetails.set(`${a}-${b}`, {
        supportA: 0,
        supportB: 0,
        supportersA: [],
        supportersB: []
      });
    }
  }

  for (const vote of validVotes) {
    for (let currentRank = 0; currentRank < vote.choice.length; currentRank += 1) {
      for (
        let nextRank = currentRank + 1;
        nextRank < vote.choice.length;
        nextRank += 1
      ) {
        const preferredChoice = vote.choice[currentRank] - 1;
        const lowerChoice = vote.choice[nextRank] - 1;
        const a = Math.min(preferredChoice, lowerChoice);
        const b = Math.max(preferredChoice, lowerChoice);
        const detail = pairDetails.get(`${a}-${b}`);

        if (!detail) {
          continue;
        }

        const voter: MatchVoter = {
          voter: vote.voter,
          vp: vote.vp,
          voteId: vote.id,
          created: vote.created
        };

        if (preferredChoice === a) {
          detail.supportA += vote.vp;
          detail.supportersA.push(voter);
        } else {
          detail.supportB += vote.vp;
          detail.supportersB.push(voter);
        }
      }
    }
  }

  const matches: PairwiseMatch[] = [];
  const matrix: Array<Array<MatrixCell | null>> = Array.from(
    { length: choicesCount },
    () => Array(choicesCount).fill(null)
  );

  for (let a = 0; a < choicesCount; a += 1) {
    for (let b = a + 1; b < choicesCount; b += 1) {
      const detail = pairDetails.get(`${a}-${b}`);
      if (!detail) {
        continue;
      }

      const margin = detail.supportA - detail.supportB;
      const total = detail.supportA + detail.supportB;
      let winner: number | null = null;

      supportTotals[a] += detail.supportA;
      supportTotals[b] += detail.supportB;
      marginTotals[a] += margin;
      marginTotals[b] -= margin;

      if (margin > 0) {
        winner = a;
        rawPoints[a] += 1;
        wins[a] += 1;
        losses[b] += 1;
      } else if (margin < 0) {
        winner = b;
        rawPoints[b] += 1;
        wins[b] += 1;
        losses[a] += 1;
      } else {
        rawPoints[a] += 0.5;
        rawPoints[b] += 0.5;
        draws[a] += 1;
        draws[b] += 1;
      }

      const match: PairwiseMatch = {
        id: `${a}-${b}`,
        choiceA: a,
        choiceB: b,
        supportA: detail.supportA,
        supportB: detail.supportB,
        margin,
        total,
        winner,
        supportersA: sortVoters(detail.supportersA),
        supportersB: sortVoters(detail.supportersB)
      };

      matches.push(match);

      matrix[a][b] = {
        opponent: b,
        supportFor: detail.supportA,
        supportAgainst: detail.supportB,
        margin,
        outcome: margin > 0 ? "win" : margin < 0 ? "loss" : "tie"
      };

      matrix[b][a] = {
        opponent: a,
        supportFor: detail.supportB,
        supportAgainst: detail.supportA,
        margin: -margin,
        outcome: margin < 0 ? "win" : margin > 0 ? "loss" : "tie"
      };
    }
  }

  const totalRawPoints = rawPoints.reduce((total, score) => total + score, 0);
  const matchupCount = Math.max(choicesCount - 1, 1);
  const normalizedScores = rawPoints.map((score) => {
    if (choicesCount === 1) {
      return totalVotingPower;
    }

    if (totalRawPoints > 0) {
      return (score / totalRawPoints) * totalVotingPower;
    }

    return choicesCount > 0 ? totalVotingPower / choicesCount : 0;
  });

  const choices: ChoiceResult[] = choiceNames.map((name, index) => {
    const snapshotScore =
      Array.isArray(snapshotScores) && Number.isFinite(snapshotScores[index])
        ? Number(snapshotScores[index])
        : null;
    const normalizedScore = normalizedScores[index] ?? 0;

    return {
      id: index,
      index,
      name,
      rank: 0,
      copelandPoints: rawPoints[index] ?? 0,
      normalizedScore,
      snapshotScore,
      pairwiseWins: wins[index] ?? 0,
      pairwiseLosses: losses[index] ?? 0,
      pairwiseDraws: draws[index] ?? 0,
      averageSupport: supportTotals[index] / matchupCount,
      averageMargin: marginTotals[index] / matchupCount
    };
  });

  const rankedChoices = assignRanks(
    [...choices].sort(
      (a, b) =>
        b.normalizedScore - a.normalizedScore ||
        b.copelandPoints - a.copelandPoints ||
        a.index - b.index
    )
  );

  const rankedById = new Map(rankedChoices.map((choice) => [choice.id, choice]));
  const choicesWithRanks = choices.map((choice) => rankedById.get(choice.id) ?? choice);

  return {
    choices: choicesWithRanks,
    rankedChoices,
    matches,
    matrix,
    validVotes,
    invalidVotes,
    totalVotingPower
  };
}
