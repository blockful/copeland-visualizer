export interface SnapshotSpace {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface SnapshotStrategy {
  name: string;
  network?: string;
  params?: Record<string, unknown>;
}

export interface SnapshotProposal {
  id: string;
  ipfs?: string | null;
  title: string;
  body?: string | null;
  link?: string | null;
  choices: string[];
  type: string;
  state: string;
  scores?: number[] | null;
  scores_total?: number | null;
  scores_state?: string | null;
  votes?: number | null;
  quorum?: number | null;
  start?: number | null;
  end?: number | null;
  snapshot?: string | number | null;
  space: SnapshotSpace;
  strategies?: SnapshotStrategy[];
}

export interface SnapshotVote {
  id: string;
  voter: string;
  created?: number | null;
  choice: unknown;
  vp?: number | null;
  vp_by_strategy?: number[] | null;
  reason?: string | null;
}

export interface SnapshotDataset {
  proposal: SnapshotProposal;
  votes: SnapshotVote[];
}

export interface RankedVote {
  id: string;
  voter: string;
  created?: number | null;
  choice: number[];
  vp: number;
  vpByStrategy: number[];
}

export interface MatchVoter {
  voter: string;
  vp: number;
  voteId: string;
  created?: number | null;
}

export interface PairwiseMatch {
  id: string;
  choiceA: number;
  choiceB: number;
  supportA: number;
  supportB: number;
  margin: number;
  total: number;
  winner: number | null;
  supportersA: MatchVoter[];
  supportersB: MatchVoter[];
}

export interface MatrixCell {
  opponent: number;
  supportFor: number;
  supportAgainst: number;
  margin: number;
  outcome: "win" | "loss" | "tie";
}

export interface ChoiceResult {
  id: number;
  index: number;
  name: string;
  rank: number;
  copelandPoints: number;
  normalizedScore: number;
  snapshotScore: number | null;
  pairwiseWins: number;
  pairwiseLosses: number;
  pairwiseDraws: number;
  averageSupport: number;
  averageMargin: number;
}

export interface CopelandResult {
  choices: ChoiceResult[];
  rankedChoices: ChoiceResult[];
  matches: PairwiseMatch[];
  matrix: Array<Array<MatrixCell | null>>;
  validVotes: RankedVote[];
  invalidVotes: SnapshotVote[];
  totalVotingPower: number;
}
