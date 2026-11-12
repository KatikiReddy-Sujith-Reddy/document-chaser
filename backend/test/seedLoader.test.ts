import { describe, expect, it } from "vitest";
import { loadSeedCases, parseSeedCase } from "../src/db/seedLoader.js";

describe("synthetic seed loader", () => {
  it("loads the three synthetic case records", () => {
    const seeds = loadSeedCases();
    expect(seeds.map((seed) => seed.case.id)).toEqual(["CS-1041", "CS-1047", "CS-1052"]);
  });

  it("rejects a case record without the synthetic marker", () => {
    const seed = {
      isSynthetic: true,
      client: { id: "client-x", name: "Synthetic Example", clientType: "corporate", isSynthetic: true },
      case: { id: "CS-X", isSynthetic: false },
      requirements: [],
      documents: [],
      events: [],
    };
    expect(() => parseSeedCase(JSON.stringify(seed), "invalid.json")).toThrow(
      "Seed record in invalid.json is missing isSynthetic: true",
    );
  });

  it("rejects nested records without the synthetic marker", () => {
    const seed = {
      isSynthetic: true,
      client: { id: "client-x", name: "Synthetic Example", clientType: "corporate", isSynthetic: true },
      case: { id: "CS-X", isSynthetic: true },
      requirements: [{ id: "r1", isSynthetic: false }],
      documents: [],
      events: [],
    };
    expect(() => parseSeedCase(JSON.stringify(seed), "invalid.json")).toThrow(
      "Seed record in invalid.json is missing isSynthetic: true",
    );
  });
});
