export const DEFAULT_SPACE = "ens.eth";
export const DEFAULT_PROPOSAL =
  "0xe4e1c052b2ea4f640cab27ddec326df6290d8996a9219b60cda4c4d4509f5f9a";

export interface RouteConfig {
  space: string;
  proposalId: string;
}

export function parseSnapshotUrl(input: string): Partial<RouteConfig> {
  const decoded = decodeURIComponent(input);
  const match = decoded.match(/s:([^/\s?#]+)\/proposal\/(0x[a-fA-F0-9]+)/i);

  if (!match) {
    return {};
  }

  return {
    space: match[1],
    proposalId: match[2]
  };
}

export function readRouteConfig(location: Location): RouteConfig {
  const params = new URLSearchParams(location.search);
  const urlParam =
    params.get("snapshot") ??
    params.get("snapshotUrl") ??
    params.get("url") ??
    "";
  const parsedUrlParam = urlParam ? parseSnapshotUrl(urlParam) : {};
  const parsedHash = location.hash ? parseSnapshotUrl(location.hash) : {};

  const rawProposal =
    params.get("proposal") ??
    params.get("proposalId") ??
    params.get("id") ??
    params.get("p") ??
    "";
  const parsedProposalParam = rawProposal ? parseSnapshotUrl(rawProposal) : {};

  return {
    space:
      params.get("space") ??
      params.get("dao") ??
      params.get("s") ??
      parsedProposalParam.space ??
      parsedUrlParam.space ??
      parsedHash.space ??
      DEFAULT_SPACE,
    proposalId:
      parsedProposalParam.proposalId ??
      (rawProposal.startsWith("0x") ? rawProposal : undefined) ??
      parsedUrlParam.proposalId ??
      parsedHash.proposalId ??
      DEFAULT_PROPOSAL
  };
}

export function writeRouteConfig(config: RouteConfig): void {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("space", config.space.trim());
  url.searchParams.set("proposal", config.proposalId.trim());
  window.history.pushState({}, "", url);
}
