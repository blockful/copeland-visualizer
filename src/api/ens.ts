import { createPublicClient, fallback, getAddress, http, isAddress } from "viem";
import { mainnet } from "viem/chains";

export type EnsLookupStatus = "loading" | "resolved" | "missing" | "error";

export interface EnsLookupResult {
  name: string | null;
  status: EnsLookupStatus;
}

const ensClient = createPublicClient({
  chain: mainnet,
  transport: fallback(
    [
      http("https://ethereum.publicnode.com"),
      http("https://eth.drpc.org"),
      http("https://rpc.ankr.com/eth")
    ],
    {
      retryCount: 1
    }
  )
});

const resolvedCache = new Map<string, EnsLookupResult>();
const pendingCache = new Map<string, Promise<EnsLookupResult>>();

export function normalizeEthereumAddress(address: string): `0x${string}` | null {
  if (!isAddress(address)) {
    return null;
  }

  return getAddress(address);
}

function cacheKey(address: string): string {
  return address.toLowerCase();
}

export function getCachedEnsLookup(address: string): EnsLookupResult | null {
  const normalizedAddress = normalizeEthereumAddress(address);

  if (!normalizedAddress) {
    return null;
  }

  return resolvedCache.get(cacheKey(normalizedAddress)) ?? null;
}

export async function resolveEnsName(address: string): Promise<EnsLookupResult> {
  const normalizedAddress = normalizeEthereumAddress(address);

  if (!normalizedAddress) {
    return { name: null, status: "error" };
  }

  const key = cacheKey(normalizedAddress);
  const cached = resolvedCache.get(key);

  if (cached) {
    return cached;
  }

  const pending = pendingCache.get(key);

  if (pending) {
    return pending;
  }

  const lookup = ensClient
    .getEnsName({ address: normalizedAddress })
    .then((name): EnsLookupResult => ({
      name,
      status: name ? "resolved" : "missing"
    }))
    .catch((): EnsLookupResult => ({ name: null, status: "error" }))
    .then((result) => {
      resolvedCache.set(key, result);
      pendingCache.delete(key);
      return result;
    });

  pendingCache.set(key, lookup);

  return lookup;
}

export async function resolveEnsNames(
  addresses: string[],
  concurrency = 4
): Promise<Record<string, EnsLookupResult>> {
  const uniqueAddresses = Array.from(
    new Set(
      addresses
        .map(normalizeEthereumAddress)
        .filter((address): address is `0x${string}` => address !== null)
    )
  );
  const results: Record<string, EnsLookupResult> = {};
  let cursor = 0;

  async function worker() {
    while (cursor < uniqueAddresses.length) {
      const address = uniqueAddresses[cursor];
      cursor += 1;
      results[cacheKey(address)] = await resolveEnsName(address);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, uniqueAddresses.length) },
      () => worker()
    )
  );

  return results;
}
