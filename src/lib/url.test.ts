import { describe, expect, it } from "vitest";
import { parseSnapshotUrl } from "./url";

describe("parseSnapshotUrl", () => {
  it("extracts space and proposal from a Snapshot proposal URL", () => {
    expect(
      parseSnapshotUrl(
        "https://snapshot.org/#/s:ens.eth/proposal/0xe4e1c052b2ea4f640cab27ddec326df6290d8996a9219b60cda4c4d4509f5f9a"
      )
    ).toEqual({
      space: "ens.eth",
      proposalId:
        "0xe4e1c052b2ea4f640cab27ddec326df6290d8996a9219b60cda4c4d4509f5f9a"
    });
  });
});
