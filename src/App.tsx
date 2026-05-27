import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  Trophy,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { fetchSnapshotDataset } from "./api/snapshot";
import { normalizeEthereumAddress } from "./api/ens";
import { useEnsNames, type EnsLookupMap } from "./hooks/useEnsNames";
import {
  formatCompact,
  formatDate,
  formatNumber,
  formatPercent,
  formatSigned,
  ipfsToHttp,
  truncateAddress
} from "./lib/format";
import { computeCopelandResult } from "./lib/copeland";
import { readRouteConfig, RouteConfig, writeRouteConfig } from "./lib/url";
import type {
  ChoiceResult,
  CopelandResult,
  PairwiseMatch,
  RankedVote,
  SnapshotDataset
} from "./types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; dataset: SnapshotDataset };

function getSnapshotLink(config: RouteConfig, dataset?: SnapshotDataset): string {
  return (
    dataset?.proposal.link ||
    `https://snapshot.org/#/s:${config.space}/proposal/${config.proposalId}`
  );
}

function getStateTone(state: string): "success" | "warning" | "neutral" {
  if (state === "active") {
    return "success";
  }

  if (state === "pending") {
    return "warning";
  }

  return "neutral";
}

function getTimeRemaining(endTimestamp?: number | null): number {
  if (!endTimestamp) {
    return 0;
  }

  return Math.max(0, endTimestamp * 1000 - Date.now());
}

function splitDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the textarea copy path for browsers that expose but block clipboard writes.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function App(): JSX.Element {
  const initialConfig = useMemo(() => readRouteConfig(window.location), []);
  const [config, setConfig] = useState<RouteConfig>(initialConfig);
  const [draftSpace, setDraftSpace] = useState(initialConfig.space);
  const [draftProposal, setDraftProposal] = useState(initialConfig.proposalId);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    setLoadState({ status: "loading" });
    setSelectedChoiceId(null);

    fetchSnapshotDataset(config.proposalId, abortController.signal)
      .then((dataset) => {
        setLoadState({ status: "success", dataset });
        setDraftSpace(dataset.proposal.space.id || config.space);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLoadState({
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load proposal"
        });
      });

    return () => abortController.abort();
  }, [config.proposalId, refreshKey]);

  const result = useMemo<CopelandResult | null>(() => {
    if (loadState.status !== "success") {
      return null;
    }

    return computeCopelandResult(
      loadState.dataset.proposal.choices,
      loadState.dataset.votes,
      loadState.dataset.proposal.scores
    );
  }, [loadState]);

  const selectedChoice =
    selectedChoiceId !== null && result
      ? result.choices.find((choice) => choice.id === selectedChoiceId) ?? null
      : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextConfig = {
      space: draftSpace.trim() || config.space,
      proposalId: draftProposal.trim()
    };

    if (!nextConfig.proposalId) {
      return;
    }

    writeRouteConfig(nextConfig);
    setConfig(nextConfig);
  }

  const dataset = loadState.status === "success" ? loadState.dataset : undefined;
  const proposal = dataset?.proposal;
  const snapshotLink = getSnapshotLink(config, dataset);
  const avatarUrl = ipfsToHttp(proposal?.space.avatar);

  return (
    <div className="appShell">
      <header className="topBar">
        <div className="brandBlock">
          <div className="spaceAvatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              <span>{(proposal?.space.name || config.space).slice(0, 2)}</span>
            )}
          </div>
          <div>
            <div className="eyebrow">{proposal?.space.name || config.space}</div>
            <h1>{proposal?.title || "Copeland Snapshot"}</h1>
          </div>
        </div>

        <form className="queryForm" onSubmit={handleSubmit}>
          <label>
            <span>DAO</span>
            <input
              value={draftSpace}
              onChange={(event) => setDraftSpace(event.target.value)}
              spellCheck={false}
            />
          </label>
          <label className="proposalInput">
            <span>Proposal</span>
            <input
              value={draftProposal}
              onChange={(event) => setDraftProposal(event.target.value)}
              spellCheck={false}
            />
          </label>
          <button type="submit" className="primaryButton">
            <Search size={16} />
            Load
          </button>
          <button
            type="button"
            className="iconButton"
            onClick={() => setRefreshKey((key) => key + 1)}
            aria-label="Refresh Snapshot data"
            title="Refresh"
          >
            <RefreshCw size={17} />
          </button>
          <a
            className="iconButton"
            href={snapshotLink}
            target="_blank"
            rel="noreferrer"
            aria-label="Open on Snapshot"
            title="Snapshot"
          >
            <ExternalLink size={17} />
          </a>
        </form>
      </header>

      {loadState.status === "loading" && <LoadingState />}

      {loadState.status === "error" && (
        <section className="notice errorNotice">
          <AlertCircle size={18} />
          <span>{loadState.error}</span>
        </section>
      )}

      {loadState.status === "success" && result && proposal && (
        <main className="dashboard">
          <section className="proposalMeta">
            <div>{proposal.type}</div>
            <div>{formatDate(proposal.start)} to {formatDate(proposal.end)}</div>
            <div>Snapshot {proposal.snapshot || "-"}</div>
          </section>

          <ProposalStatus proposal={proposal} />

          {proposal.type !== "copeland" && (
            <section className="notice warningNotice">
              <AlertCircle size={18} />
              <span>Proposal type is {proposal.type}; ranked Copeland votes are required.</span>
            </section>
          )}

          <section className="contentGrid">
            <div className="mainPanel">
              <div className="sectionHeader">
                <div>
                  <div className="eyebrow">Results</div>
                  <h2>Ranked choices</h2>
                </div>
              </div>
              <ResultsTable
                result={result}
                onSelectChoice={(choiceId) => setSelectedChoiceId(choiceId)}
              />
            </div>

            <aside className="sidePanel">
              <div className="sectionHeader">
                <div>
                  <div className="eyebrow">Pairwise</div>
                  <h2>Matrix</h2>
                </div>
              </div>
              <PairwiseMatrix
                result={result}
                onSelectChoice={(choiceId) => setSelectedChoiceId(choiceId)}
              />
            </aside>
          </section>

          <TopVotes result={result} choices={proposal.choices} />

          <Footer />

          <DetailsDrawer
            open={selectedChoice !== null}
            choice={selectedChoice}
            result={result}
            onClose={() => setSelectedChoiceId(null)}
          />
        </main>
      )}
    </div>
  );
}

function ProposalStatus({ proposal }: { proposal: SnapshotDataset["proposal"] }): JSX.Element {
  const [timeRemaining, setTimeRemaining] = useState(() =>
    getTimeRemaining(proposal.end)
  );
  const countdown = splitDuration(timeRemaining);
  const hasEnded = Boolean(proposal.end && timeRemaining <= 0);

  useEffect(() => {
    setTimeRemaining(getTimeRemaining(proposal.end));

    const intervalId = window.setInterval(() => {
      setTimeRemaining(getTimeRemaining(proposal.end));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [proposal.end]);

  return (
    <section className="statusPanel">
      <div>
        <div className="eyebrow">Proposal status</div>
        <div className={`statusValue ${getStateTone(proposal.state)}`}>
          {proposal.state}
        </div>
      </div>
      <div>
        <div className="eyebrow">{hasEnded ? "Ended" : "Ends in"}</div>
        <div className="countdownGrid">
          <CountdownUnit label="Days" value={countdown.days} />
          <CountdownUnit label="Hours" value={countdown.hours} />
          <CountdownUnit label="Minutes" value={countdown.minutes} />
          <CountdownUnit label="Seconds" value={countdown.seconds} />
        </div>
      </div>
    </section>
  );
}

function CountdownUnit({
  label,
  value
}: {
  label: string;
  value: number;
}): JSX.Element {
  return (
    <div className="countdownUnit">
      <strong>{String(value).padStart(2, "0")}</strong>
      <span>{label}</span>
    </div>
  );
}

function LoadingState(): JSX.Element {
  return (
    <main className="dashboard">
      <section className="loadingPanel">
        <div className="spinner" />
        <span>Loading Snapshot data...</span>
      </section>
    </main>
  );
}

function ResultsTable({
  result,
  onSelectChoice
}: {
  result: CopelandResult;
  onSelectChoice: (choiceId: number) => void;
}): JSX.Element {
  const maxScore = Math.max(
    ...result.rankedChoices.map((choice) => choice.normalizedScore),
    1
  );

  return (
    <div className="tableScroll">
      <table className="resultsTable">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Choice</th>
            <th>Computed score</th>
            <th>Snapshot score</th>
            <th>Copeland</th>
            <th>Record</th>
            <th>Avg support</th>
            <th>Avg margin</th>
            <th aria-label="Details" />
          </tr>
        </thead>
        <tbody>
          {result.rankedChoices.map((choice) => {
            const scoreShare =
              result.totalVotingPower > 0
                ? choice.normalizedScore / result.totalVotingPower
                : 0;

            return (
              <tr key={choice.id} onClick={() => onSelectChoice(choice.id)}>
                <td>
                  <span className={choice.rank === 1 ? "rankBadge winner" : "rankBadge"}>
                    {choice.rank}
                  </span>
                </td>
                <td>
                  <div className="choiceName">
                    <span className="choiceNumber">{choice.index + 1}</span>
                    <span>{choice.name}</span>
                    {choice.rank === 1 && <Trophy size={15} className="winnerIcon" />}
                  </div>
                </td>
                <td className="scoreCell">
                  <div className="scoreBar">
                    <span style={{ width: `${(choice.normalizedScore / maxScore) * 100}%` }} />
                  </div>
                  <div className="scoreText">
                    <strong>{formatNumber(choice.normalizedScore)}</strong>
                    <small>{formatPercent(scoreShare)}</small>
                  </div>
                </td>
                <td>
                  {choice.snapshotScore === null ? "-" : formatNumber(choice.snapshotScore)}
                </td>
                <td>{formatNumber(choice.copelandPoints, 1)}</td>
                <td>
                  {choice.pairwiseWins}-{choice.pairwiseDraws}-{choice.pairwiseLosses}
                </td>
                <td>{formatCompact(choice.averageSupport)}</td>
                <td className={choice.averageMargin >= 0 ? "positive" : "negative"}>
                  {formatSigned(choice.averageMargin)}
                </td>
                <td>
                  <button
                    className="rowButton"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectChoice(choice.id);
                    }}
                    aria-label={`Open details for ${choice.name}`}
                  >
                    <ChevronRight size={18} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Footer(): JSX.Element {
  return (
    <footer className="footer">
      <span>Powered by</span>
      <a href="https://blockful.io" target="_blank" rel="noreferrer">
        blockful
      </a>
    </footer>
  );
}

function PairwiseMatrix({
  result,
  onSelectChoice
}: {
  result: CopelandResult;
  onSelectChoice: (choiceId: number) => void;
}): JSX.Element {
  return (
    <div className="matrixScroll">
      <table className="matrixTable">
        <thead>
          <tr>
            <th />
            {result.choices.map((choice) => (
              <th key={choice.id}>{choice.index + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.choices.map((choice) => (
            <tr key={choice.id}>
              <th>
                <button onClick={() => onSelectChoice(choice.id)}>
                  <span>{choice.index + 1}</span>
                  {choice.name}
                </button>
              </th>
              {result.matrix[choice.id].map((cell, index) => (
                <td key={index} className={cell ? cell.outcome : "selfCell"}>
                  {cell ? (
                    <>
                      <strong>{cell.outcome === "win" ? "W" : cell.outcome === "loss" ? "L" : "T"}</strong>
                      <span>{formatSigned(cell.margin)}</span>
                    </>
                  ) : (
                    <span>-</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopVotes({
  result,
  choices
}: {
  result: CopelandResult;
  choices: string[];
}): JSX.Element {
  const [sortBy, setSortBy] = useState<"vp" | "timestamp">("vp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const votes = result.validVotes;
  const sortedVotes = [...votes].sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;

    if (sortBy === "timestamp") {
      return (
        ((a.created ?? 0) - (b.created ?? 0)) * direction ||
        (a.vp - b.vp) * direction
      );
    }

    return (
      (a.vp - b.vp) * direction ||
      ((a.created ?? 0) - (b.created ?? 0)) * direction
    );
  });
  const ensLookups = useEnsNames(sortedVotes.map((vote) => vote.voter));
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  function copyAddress(address: string) {
    void copyTextToClipboard(address).finally(() => {
      setCopiedAddress(address);
      window.setTimeout(() => setCopiedAddress(null), 1400);
    });
  }

  function handleSortClick(nextSortBy: "vp" | "timestamp") {
    if (sortBy === nextSortBy) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(nextSortBy);
    setSortDirection("desc");
  }

  return (
    <section className="mainPanel">
      <div className="sectionHeader">
        <div>
          <div className="eyebrow">Votes</div>
          <h2>All ranked ballots</h2>
        </div>
        <div className="voteStats">
          <span>{formatNumber(votes.length, 0)} votes</span>
          <span>{formatNumber(result.totalVotingPower)} voting power</span>
          {result.invalidVotes.length > 0 && (
            <span>{formatNumber(result.invalidVotes.length, 0)} invalid</span>
          )}
        </div>
      </div>
      <div className="voteTableHeader">
        <div>Voter</div>
        <button
          className={sortBy === "timestamp" ? "voteSortButton active" : "voteSortButton"}
          onClick={() => handleSortClick("timestamp")}
          type="button"
        >
          Date
          <SortArrow active={sortBy === "timestamp"} direction={sortDirection} />
        </button>
        <button
          className={sortBy === "vp" ? "voteSortButton active" : "voteSortButton"}
          onClick={() => handleSortClick("vp")}
          type="button"
        >
          Voting power
          <SortArrow active={sortBy === "vp"} direction={sortDirection} />
        </button>
      </div>
      <div className="voteList">
        {sortedVotes.map((vote) => (
          <div className="voteRow" key={vote.id}>
            <div className="voteIdentity">
              <CopyAddressButton
                address={vote.voter}
                copied={copiedAddress === vote.voter}
                onCopy={copyAddress}
              />
              <VoterIdentity address={vote.voter} ensLookups={ensLookups} />
              <span className="voteRanking">
                {vote.choice.map((choiceIndex) => choices[choiceIndex - 1]).join(" > ")}
              </span>
            </div>
            <div className="voteDate">{formatDate(vote.created)}</div>
            <div className="votePower">{formatCompact(vote.vp)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SortArrow({
  active,
  direction
}: {
  active: boolean;
  direction: "asc" | "desc";
}): JSX.Element | null {
  if (!active) {
    return null;
  }

  return direction === "asc" ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
}

function DetailsDrawer({
  open,
  choice,
  result,
  onClose
}: {
  open: boolean;
  choice: ChoiceResult | null;
  result: CopelandResult;
  onClose: () => void;
}): JSX.Element {
  const [expandedMatches, setExpandedMatches] = useState<Record<string, boolean>>({});
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setExpandedMatches({});
      setCopiedAddress(null);
    }
  }, [open]);

  if (!choice) {
    return <></>;
  }

  const matches = result.matches.filter(
    (match) => match.choiceA === choice.id || match.choiceB === choice.id
  );

  function copyAddress(address: string) {
    void copyTextToClipboard(address).finally(() => {
      setCopiedAddress(address);
      window.setTimeout(() => setCopiedAddress(null), 1400);
    });
  }

  return (
    <>
      <div className={open ? "drawerBackdrop open" : "drawerBackdrop"} onClick={onClose} />
      <aside className={open ? "detailsDrawer open" : "detailsDrawer"}>
        <div className="drawerHeader">
          <div>
            <div className="eyebrow">Choice {choice.index + 1}</div>
            <h2>{choice.name}</h2>
          </div>
          <button className="iconButton" onClick={onClose} aria-label="Close details">
            <X size={18} />
          </button>
        </div>

        <div className="drawerStats">
          <span>{choice.pairwiseWins} wins</span>
          <span>{choice.pairwiseDraws} draws</span>
          <span>{choice.pairwiseLosses} losses</span>
        </div>

        <div className="matchList">
          {matches.map((match) => {
            const selectedIsA = match.choiceA === choice.id;
            const opponentId = selectedIsA ? match.choiceB : match.choiceA;
            const opponent = result.choices[opponentId];
            const selectedSupport = selectedIsA ? match.supportA : match.supportB;
            const opponentSupport = selectedIsA ? match.supportB : match.supportA;
            const selectedVoters = selectedIsA ? match.supportersA : match.supportersB;
            const opponentVoters = selectedIsA ? match.supportersB : match.supportersA;
            const selectedWon = match.winner === choice.id;
            const opponentWon = match.winner === opponentId;
            const isExpanded = Boolean(expandedMatches[match.id]);
            const selectedWidth = match.total > 0 ? (selectedSupport / match.total) * 100 : 50;
            const opponentWidth = match.total > 0 ? (opponentSupport / match.total) * 100 : 50;

            return (
              <article className="matchCard" key={match.id}>
                <button
                  className="matchSummary"
                  onClick={() =>
                    setExpandedMatches((current) => ({
                      ...current,
                      [match.id]: !current[match.id]
                    }))
                  }
                >
                  <div className="matchNames">
                    <strong>{choice.name}</strong>
                    <span>vs</span>
                    <strong>{opponent.name}</strong>
                  </div>
                  <div className="matchScores">
                    <span className={selectedWon ? "positive" : ""}>
                      {selectedWon && <Trophy size={15} />}
                      {formatCompact(selectedSupport)}
                    </span>
                    <span className={opponentWon ? "positive" : ""}>
                      {formatCompact(opponentSupport)}
                      {opponentWon && <Trophy size={15} />}
                    </span>
                  </div>
                  <div className="splitBar" aria-hidden="true">
                    <span
                      className={selectedWon ? "selectedWin" : "selectedSide"}
                      style={{ width: `${selectedWidth}%` }}
                    />
                    <span
                      className={opponentWon ? "opponentWin" : "opponentSide"}
                      style={{ width: `${opponentWidth}%` }}
                    />
                  </div>
                  {isExpanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                </button>

                {isExpanded && (
                  <div className="voterColumns">
                    <VoterColumn
                      title={choice.name}
                      voters={selectedVoters}
                      copiedAddress={copiedAddress}
                      onCopy={copyAddress}
                    />
                    <VoterColumn
                      title={opponent.name}
                      voters={opponentVoters}
                      copiedAddress={copiedAddress}
                      onCopy={copyAddress}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </aside>
    </>
  );
}

function VoterColumn({
  title,
  voters,
  copiedAddress,
  onCopy
}: {
  title: string;
  voters: Array<{ voter: string; vp: number }>;
  copiedAddress: string | null;
  onCopy: (address: string) => void;
}): JSX.Element {
  const ensLookups = useEnsNames(voters.map((voter) => voter.voter));

  return (
    <div className="voterColumn">
      <h3>{title}</h3>
      <div className="voterScroller">
        {voters.length ? (
          voters.map((voter) => (
            <button
              key={`${voter.voter}-${voter.vp}`}
              className="voterLine"
              onClick={() => onCopy(voter.voter)}
              title={`Copy address: ${voter.voter}`}
            >
              <span>
                {copiedAddress === voter.voter ? <Check size={13} /> : <Copy size={13} />}
                <VoterIdentity address={voter.voter} ensLookups={ensLookups} compact />
              </span>
              <strong>{formatCompact(voter.vp)}</strong>
            </button>
          ))
        ) : (
          <div className="emptyVoters">No ranked support</div>
        )}
      </div>
    </div>
  );
}

function VoterIdentity({
  address,
  ensLookups,
  compact = false
}: {
  address: string;
  ensLookups: EnsLookupMap;
  compact?: boolean;
}): JSX.Element {
  const normalizedAddress = normalizeEthereumAddress(address);
  const lookup = normalizedAddress
    ? ensLookups[normalizedAddress.toLowerCase()]
    : undefined;
  const resolvedName = lookup?.name ?? null;
  const displayName = resolvedName || truncateAddress(address);
  const status = lookup?.status;

  return (
    <span className={compact ? "identityLabel compact" : "identityLabel"}>
      <span className="identityName">{displayName}</span>
      {resolvedName ? (
        null
      ) : status === "loading" ? (
        <span className="identityAddress">resolving ENS</span>
      ) : null}
    </span>
  );
}

function CopyAddressButton({
  address,
  copied,
  onCopy
}: {
  address: string;
  copied: boolean;
  onCopy: (address: string) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className="copyAddressButton"
      onClick={() => onCopy(address)}
      aria-label={`Copy address ${address}`}
      title={copied ? "Copied" : "Copy address"}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export default App;
