import { useEffect, useMemo, useState } from "react";
import {
  getCachedEnsLookup,
  normalizeEthereumAddress,
  resolveEnsNames,
  type EnsLookupResult
} from "../api/ens";

export type EnsLookupMap = Record<string, EnsLookupResult>;

function makeLoadingResult(): EnsLookupResult {
  return { name: null, status: "loading" };
}

export function useEnsNames(addresses: string[]): EnsLookupMap {
  const addressInputKey = addresses.join("|").toLowerCase();
  const normalizedAddresses = useMemo(
    () =>
      Array.from(
        new Set(
          addresses
            .map(normalizeEthereumAddress)
            .filter((address): address is `0x${string}` => address !== null)
            .map((address) => address.toLowerCase())
        )
      ),
    [addressInputKey]
  );
  const lookupKey = normalizedAddresses.join("|");
  const [lookups, setLookups] = useState<EnsLookupMap>({});

  useEffect(() => {
    let cancelled = false;
    const cachedUpdates: EnsLookupMap = {};
    const unresolved: string[] = [];

    for (const address of normalizedAddresses) {
      const cached = getCachedEnsLookup(address);

      if (cached) {
        cachedUpdates[address] = cached;
      } else {
        cachedUpdates[address] = makeLoadingResult();
        unresolved.push(address);
      }
    }

    setLookups((current) => ({ ...current, ...cachedUpdates }));

    if (!unresolved.length) {
      return () => {
        cancelled = true;
      };
    }

    resolveEnsNames(unresolved).then((results) => {
      if (cancelled) {
        return;
      }

      setLookups((current) => ({ ...current, ...results }));
    });

    return () => {
      cancelled = true;
    };
  }, [lookupKey]);

  return lookups;
}
