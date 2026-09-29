/**
 * THIRD-PARTY-NOTICES.md 생성(레포 루트). 새 의존성 없이 npm·cargo 가 주는 정보만 쓴다.
 *   node scripts/notices.mjs          # 만들고 쓴다
 *   node scripts/notices.mjs --check  # 만든 것과 파일이 다르면 1 로 끝난다(의존성 바꾸고 안 만든 것 잡기)
 * permissive 가 아닌 라이선스가 하나라도 있으면 목록을 보이고 2 로 끝난다(파일은 쓰지 않는다).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isPermissive, renderNotices } from "./notices-lib.mjs";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(SRC, "..", "THIRD-PARTY-NOTICES.md");

const repoUrl = (r) => {
  const u = typeof r === "string" ? r : r?.url ?? "";
  return u.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://").replace(/^github:/, "https://github.com/");
};

function npmPackages() {
  // Windows 에서 npm 은 npm.cmd — shell 로 부른다(인자는 고정 문자열뿐).
  const out = execFileSync("npm ls --omit=dev --all --parseable", { cwd: SRC, encoding: "utf8", shell: true, maxBuffer: 64 << 20 });
  const seen = new Map();
  for (const dir of out.split(/\r?\n/).filter(Boolean)) {
    if (resolve(dir) === SRC) continue; // 우리 자신
    const pj = join(dir, "package.json");
    if (!existsSync(pj)) continue;
    const p = JSON.parse(readFileSync(pj, "utf8"));
    const license = typeof p.license === "string" ? p.license : p.license?.type ?? (Array.isArray(p.licenses) ? p.licenses.map((l) => l.type).join(" OR ") : "");
    seen.set(`${p.name}@${p.version}`, { name: p.name, version: p.version, license, repository: repoUrl(p.repository) || p.homepage || "" });
  }
  return [...seen.values()];
}

function cargoPackages() {
  const out = execFileSync(
    "cargo",
    ["metadata", "--format-version", "1", "--locked", "--filter-platform", "x86_64-pc-windows-msvc", "--manifest-path", join(SRC, "src-tauri", "Cargo.toml")],
    { encoding: "utf8", maxBuffer: 256 << 20 },
  );
  const meta = JSON.parse(out);
  const pkgs = new Map(meta.packages.map((p) => [p.id, p]));
  const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
  // 루트에서 **일반 의존성**만 따라간다(빌드·개발 의존성은 배포물에 안 들어간다).
  const root = meta.resolve.root;
  const keep = new Set();
  const stack = [root];
  while (stack.length) {
    const id = stack.pop();
    for (const d of nodes.get(id)?.deps ?? []) {
      if (!d.dep_kinds.some((k) => k.kind === null)) continue;
      if (keep.has(d.pkg)) continue;
      keep.add(d.pkg);
      stack.push(d.pkg);
    }
  }
  return [...keep].map((id) => {
    const p = pkgs.get(id);
    return { name: p.name, version: p.version, license: p.license ?? (p.license_file ? `파일: ${p.license_file}` : ""), repository: repoUrl(p.repository ?? "") };
  });
}

const npm = npmPackages();
const cargo = cargoPackages();
const bad = [...npm.map((p) => ["npm", p]), ...cargo.map((p) => ["cargo", p])].filter(([, p]) => !isPermissive(p.license));
if (bad.length) {
  console.error("permissive 가 아니거나 판정하지 못한 라이선스 — 사람이 확인할 것:");
  for (const [kind, p] of bad) console.error(`  ${kind}  ${p.name}@${p.version}  ${p.license || "(없음)"}`);
  process.exit(2);
}

const ofl = readFileSync(join(SRC, "app", "assets", "fonts", "OFL.txt"), "utf8");
const md = renderNotices({
  product: "TODO.md",
  npm,
  cargo,
  fonts: [{
    name: "Pretendard Variable",
    file: "app/assets/fonts/PretendardVariable.woff2",
    copyright: ofl.split(/\r?\n/).filter((l) => l.startsWith("Copyright")),
  }],
  ofl: ofl.slice(ofl.indexOf("This Font Software")),
});

if (process.argv.includes("--check")) {
  // git(autocrlf)이 체크아웃 때 CRLF 로 바꿀 수 있다 — 줄끝은 비교에서 뺀다.
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
  if (cur !== md) {
    console.error("THIRD-PARTY-NOTICES.md 가 의존성과 다르다 → node scripts/notices.mjs");
    process.exit(1);
  }
  console.log(`OK  npm ${npm.length} · cargo ${cargo.length}`);
} else {
  writeFileSync(OUT, md);
  console.log(`썼다: ${OUT}  (npm ${npm.length} · cargo ${cargo.length})`);
}
