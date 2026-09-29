import { describe, expect, it } from "vitest";
import { isPermissive, renderNotices } from "./notices-lib.mjs";

describe("isPermissive", () => {
  it("단일 permissive", () => {
    for (const l of ["MIT", "Apache-2.0", "ISC", "BSD-3-Clause", "Unicode-3.0", "Zlib", "MPL-2.0"]) expect(isPermissive(l), l).toBe(true);
  });
  it("OR 는 하나만 허용이면 된다 — 옛 표기 '/' 포함", () => {
    expect(isPermissive("MIT OR Apache-2.0")).toBe(true);
    expect(isPermissive("GPL-3.0 OR MIT")).toBe(true);
    expect(isPermissive("MIT/Apache-2.0")).toBe(true);
  });
  it("AND 는 모두 허용이어야 한다", () => {
    expect(isPermissive("(MIT OR Apache-2.0) AND Unicode-3.0")).toBe(true);
    expect(isPermissive("MIT AND GPL-3.0")).toBe(false);
  });
  it("WITH 예외", () => {
    expect(isPermissive("Apache-2.0 WITH LLVM-exception OR MIT")).toBe(true);
    expect(isPermissive("GPL-2.0 WITH Classpath-exception-2.0")).toBe(false);
  });
  it("카피레프트·모르는 이름·빈 값·깨진 식은 false(사람이 본다)", () => {
    for (const l of ["GPL-3.0", "LGPL-2.1", "AGPL-3.0", "UNLICENSED", "SEE LICENSE IN x", "", "MIT OR", "(MIT", undefined]) {
      expect(isPermissive(l), String(l)).toBe(false);
    }
  });
});

describe("renderNotices", () => {
  const input = {
    product: "TODO.md",
    npm: [{ name: "react", version: "19.3.0", license: "MIT", repository: "https://github.com/facebook/react" }],
    cargo: [
      { name: "tauri", version: "2.12.0", license: "Apache-2.0 OR MIT", repository: "" },
      { name: "serde", version: "1.0.0", license: "MIT OR Apache-2.0", repository: "https://github.com/serde-rs/serde" },
    ],
    fonts: [{ name: "Pretendard", file: "PretendardVariable.woff2", copyright: ["Copyright (c) 2021, Kil Hyung-jin"] }],
    ofl: "SIL OPEN FONT LICENSE Version 1.1\n",
  };
  const md = renderNotices(input);
  it("구역별 개수·이름순 정렬·라이선스 요약·폰트 전문", () => {
    expect(md).toContain("## Frontend (npm, production — 1)");
    expect(md).toContain("## Rust shell (cargo, x86_64-pc-windows-msvc — 2)");
    expect(md.indexOf("| serde |")).toBeLessThan(md.indexOf("| tauri |"));
    expect(md).toContain("**사용 라이선스:** Apache-2.0 OR MIT, MIT, MIT OR Apache-2.0, OFL-1.1");
    expect(md).toContain("Copyright (c) 2021, Kil Hyung-jin");
    expect(md).toContain("SIL OPEN FONT LICENSE Version 1.1\n```");
  });
  it("같은 입력이면 같은 출력(입력 순서와 무관)", () => {
    expect(renderNotices({ ...input, cargo: [...input.cargo].reverse() })).toBe(md);
  });
});
