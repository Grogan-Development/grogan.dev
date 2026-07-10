import { describe, expect, it } from "vitest";
import { getIndustryImage, SITE_IMAGES } from "@/lib/images";

describe("site image manifest", () => {
  it("keeps the hero photography release-gated until an approved source is supplied", () => {
    expect(SITE_IMAGES.hero).toMatchObject({
      id: "hero",
      src: null,
      alt: "",
      caption: "",
      objectPosition: "50% 50%",
      source: null,
      license: null,
      releaseStatus: "awaiting-approval",
    });
  });

  it("records each planned photography slot as unreleased while provenance is missing", () => {
    const records = [
      SITE_IMAGES.hero,
      SITE_IMAGES.founder,
      ...Object.values(SITE_IMAGES.industries),
      SITE_IMAGES.og,
    ];

    expect(records).toHaveLength(9);
    for (const image of records) {
      expect(image).toMatchObject({
        src: null,
        source: null,
        license: null,
        releaseStatus: "awaiting-approval",
      });
    }
  });

  it("does not substitute media when an industry lacks a manifest record", () => {
    expect(() => getIndustryImage("unmapped-industry")).toThrow(
      "No photography manifest record",
    );
  });
});
