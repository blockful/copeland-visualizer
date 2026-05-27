export function formatNumber(value: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits
  }).format(value);
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Math.abs(value) < 1000) {
    return formatNumber(value, 0);
  }

  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatSigned(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCompact(value)}`;
}

export function formatDate(timestamp?: number | null): string {
  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp * 1000));
}

export function truncateAddress(address: string): string {
  if (address.length <= 13) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ipfsToHttp(uri?: string | null): string | null {
  if (!uri) {
    return null;
  }

  if (uri.startsWith("ipfs://")) {
    return `https://snapshot.4everland.link/ipfs/${uri.replace("ipfs://", "")}`;
  }

  return uri;
}
