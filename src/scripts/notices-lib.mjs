/**
 * THIRD-PARTY-NOTICES 의 순수 부분 — 라이선스 식 판정과 문서 조립. 파일·프로세스는 notices.mjs 가 맡는다.
 */

/** 배포에 그대로 써도 되는 라이선스(SPDX). MPL-2.0 은 파일 단위 약카피레프트라 번들 배포 허용(md-reader 와 같은 기준). */
export const PERMISSIVE = new Set([
  "MIT", "MIT-0", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "Zlib", "Unlicense", "CC0-1.0",
  "Unicode-3.0", "Unicode-DFS-2016", "BSL-1.0", "MPL-2.0", "OFL-1.1", "Python-2.0", "BlueOak-1.0.0", "CDLA-Permissive-2.0",
  "Apache-2.0 WITH LLVM-exception",
]);

/**
 * 라이선스 식이 permissive 인가. `A OR B` 는 하나만, `A AND B` 는 모두 허용이어야 한다. 괄호·옛 표기(`MIT/Apache-2.0`) 지원.
 * 비었거나 모르는 이름이면 false — 사람이 보게 한다.
 */
export function isPermissive(expr) {
  if (typeof expr !== "string" || !expr.trim()) return false;
  const tokens = expr.replace(/\//g, " OR ").match(/\(|\)|[^\s()]+/g) ?? [];
  let i = 0;
  // or := and ("OR" and)* ; and := atom ("AND" atom)* ; atom := "(" or ")" | ID ["WITH" ID]
  const atom = () => {
    const t = tokens[i++];
    if (t === "(") {
      const v = or();
      if (tokens[i++] !== ")") throw new Error("괄호");
      return v;
    }
    if (t === undefined || t === ")" || /^(AND|OR|WITH)$/i.test(t)) throw new Error("식");
    let id = t;
    if (/^WITH$/i.test(tokens[i] ?? "")) { i++; id += " WITH " + tokens[i++]; }
    return PERMISSIVE.has(id);
  };
  const and = () => {
    let v = atom();
    while (/^AND$/i.test(tokens[i] ?? "")) { i++; v = atom() && v; }
    return v;
  };
  const or = () => {
    let v = and();
    while (/^OR$/i.test(tokens[i] ?? "")) { i++; v = and() || v; }
    return v;
  };
  try {
    const v = or();
    return i === tokens.length && v;
  } catch {
    return false;
  }
}

const byName = (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version);
const row = (p) => `| ${p.name} | ${p.version} | ${p.license || "—"} | ${p.repository ? `<${p.repository}>` : ""} |`;

/**
 * 문서 조립. `npm`·`cargo` = [{name, version, license, repository}], `fonts` = [{name, file, copyright[]}], `ofl` = 전문.
 * 같은 입력이면 같은 출력(정렬) — 다시 만들어도 diff 가 의존성 변화만 보이게.
 */
export function renderNotices({ product, npm, cargo, fonts, ofl }) {
  const all = [...npm, ...cargo, ...fonts.map(() => ({ license: "OFL-1.1" }))];
  const licenses = [...new Set(all.map((p) => p.license || "—"))].sort();
  const table = (list) => ["| 이름 | 버전 | 라이선스 | 저장소 |", "|---|---|---|---|", ...[...list].sort(byName).map(row)].join("\n");
  return [
    "# THIRD-PARTY-NOTICES",
    "",
    `**${product}**(Windows x64)는 아래 오픈소스 구성요소를 포함하며 전부 permissive 라이선스입니다.`,
    `${product} includes the open-source components below, all under permissive licenses.`,
    "",
    "목록은 `node scripts/notices.mjs` 가 자동 생성 — npm production 의존성(`npm ls --omit=dev`) + Rust 크레이트",
    "(`cargo metadata --filter-platform x86_64-pc-windows-msvc`, 일반 의존성). 번들 폰트는 OFL 전문을 함께 싣는다. 의존성이 바뀌면 다시 만든다.",
    "",
    `**사용 라이선스:** ${licenses.join(", ")}`,
    "",
    "> 다중 라이선스(`MIT OR Apache-2.0` 등)는 permissive 쪽을 택한다. `MPL-2.0` 은 파일 단위 약카피레프트로 번들 배포 허용.",
    "> `OFL-1.1` 은 폰트 파일에 적용되며 소프트웨어와 함께 번들·재배포 허용(폰트 단독 판매만 금지).",
    "",
    "## 번들 폰트 (SIL Open Font License 1.1)",
    "",
    ...fonts.flatMap((f) => [`- **${f.name}** — \`${f.file}\``, ...f.copyright.map((c) => `  ${c}`)]),
    "",
    "<details>",
    "<summary><strong>SIL OPEN FONT LICENSE Version 1.1</strong> (전문 / full text)</summary>",
    "",
    "```",
    ofl.trimEnd(),
    "```",
    "",
    "</details>",
    "",
    `## Frontend (npm, production — ${npm.length})`,
    "",
    table(npm),
    "",
    `## Rust shell (cargo, x86_64-pc-windows-msvc — ${cargo.length})`,
    "",
    table(cargo),
    "",
  ].join("\n");
}
