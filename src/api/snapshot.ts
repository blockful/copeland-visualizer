import type { SnapshotDataset, SnapshotProposal, SnapshotVote } from "../types";

const SNAPSHOT_ENDPOINT = "https://hub.snapshot.org/graphql";
const PAGE_SIZE = 1000;

const PROPOSAL_AND_VOTES_QUERY = `
  query ProposalAndVotes($id: String!, $first: Int!, $skip: Int!) {
    proposal(id: $id) {
      id
      ipfs
      title
      body
      link
      choices
      type
      state
      scores
      scores_total
      scores_state
      votes
      quorum
      start
      end
      snapshot
      space {
        id
        name
        avatar
      }
      strategies {
        name
        network
        params
      }
    }
    votes(first: $first, skip: $skip, where: { proposal: $id }) {
      id
      voter
      created
      choice
      vp
      vp_by_strategy
      reason
    }
  }
`;

interface GraphqlPayload<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface ProposalAndVotesResponse {
  proposal: SnapshotProposal | null;
  votes: SnapshotVote[];
}

async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(SNAPSHOT_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ query, variables }),
    signal
  });

  const payload = (await response.json()) as GraphqlPayload<T>;

  if (!response.ok) {
    throw new Error(`Snapshot API returned ${response.status}`);
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("Snapshot API returned no data");
  }

  return payload.data;
}

export async function fetchSnapshotDataset(
  proposalId: string,
  signal?: AbortSignal
): Promise<SnapshotDataset> {
  let skip = 0;
  let proposal: SnapshotProposal | null = null;
  const votes: SnapshotVote[] = [];

  while (true) {
    const data = await graphqlRequest<ProposalAndVotesResponse>(
      PROPOSAL_AND_VOTES_QUERY,
      { id: proposalId, first: PAGE_SIZE, skip },
      signal
    );

    if (!proposal) {
      proposal = data.proposal;
    }

    votes.push(...data.votes);

    if (data.votes.length < PAGE_SIZE) {
      break;
    }

    skip += PAGE_SIZE;
  }

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  return { proposal, votes };
}
