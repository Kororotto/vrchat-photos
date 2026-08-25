import { describe, expect, it, vi } from "vitest";

vi.mock("sharp", () => ({ default: vi.fn() }));
import { generateUdonSharp } from "../src/uploader.js";
import type { PhotoManifest } from "../src/types.js";

const PORTRAIT_URL = (page: number, col: string) =>
  `https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page${page}/portrait/${col}.png`;
const WIDE_URL = (page: number, n: string) =>
  `https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page${page}/wide/${n}.png`;

describe("generateUdonSharp", () => {
  it("列ごとに portrait→wide×3 の順で出力する", () => {
    const manifest: PhotoManifest = {
      pages: {
        page1: [
          {
            portrait: PORTRAIT_URL(1, "01"),
            wide: [WIDE_URL(1, "01"), WIDE_URL(1, "02"), WIDE_URL(1, "03")],
          },
          {
            portrait: PORTRAIT_URL(1, "02"),
            wide: [WIDE_URL(1, "04"), WIDE_URL(1, "05"), WIDE_URL(1, "06")],
          },
        ],
      },
      lastUpdated: "2026-08-24T00:00:00.000Z",
    };

    const code = generateUdonSharp(manifest);

    expect(code).toContain("VRCUrl");
    expect(code).toContain("portrait/01.png");
    expect(code).toContain("wide/01.png");
    expect(code).toContain("wide/03.png");
    expect(code).toContain("portrait/02.png");
    expect(code).toContain("8枚");

    const portraitIdx = code.indexOf("portrait/01.png");
    const wide01Idx = code.indexOf("wide/01.png");
    expect(portraitIdx).toBeLessThan(wide01Idx);
  });

  it("写真がない場合は0枚と出力する", () => {
    const manifest: PhotoManifest = { pages: {}, lastUpdated: "" };
    const code = generateUdonSharp(manifest);
    expect(code).toContain("0枚");
  });
});
