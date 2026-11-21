/**
 * 화면 공용: 언어 문맥(`useT`), 아이콘. 아이콘은 목업과 같은 SVG — 색은 전부 CSS 토큰이라 테마를 따라간다.
 */
import { createContext, useContext } from "react";
import { t, type Key, type Lang, type Vars } from "../core/i18n";
import type { Importance, Status } from "../core/model";

export const LangContext = createContext<Lang>("ko");

export function useT(): { lang: Lang; t: (key: Key, vars?: Vars) => string } {
  const lang = useContext(LangContext);
  return { lang, t: (key, vars) => t(lang, key, vars) };
}

export function StatusIcon({ status }: { status: Status }) {
  if (status === "doing")
    return (
      <svg viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="8.4" fill="var(--hl)" stroke="var(--fg)" strokeWidth="1.7" />
        <path d="M11 2.6 A8.4 8.4 0 0 1 11 19.4 Z" fill="var(--fg)" />
      </svg>
    );
  if (status === "done")
    return (
      <svg viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="9.3" fill="var(--fg)" />
        <path d="M6.8 11.3 l2.9 2.9 l5.6 -6" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="8.4" fill="none" stroke="var(--faint)" strokeWidth="1.7" />
    </svg>
  );
}

/** 중요도 = 신호 막대 셋. 높음은 빨간 펜. */
export function Bars({ level }: { level: Importance }) {
  const color = level === 3 ? "var(--red)" : "var(--fg)";
  const heights = [5, 8, 11];
  return (
    <svg viewBox="0 0 14 12" aria-hidden="true">
      {heights.map((h, i) => (
        <rect key={i} x={i * 5} y={12 - h} width="3.4" height={h} rx="0.8" fill={i < level ? color : "var(--border)"} />
      ))}
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="10" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10" y="3.2" width="3.8" height="8.6" fill="currentColor" />
    </svg>
  );
}

export function Seg<T extends string | number>({
  items, value, onPick, label,
}: {
  items: { v: T; label: React.ReactNode; aria?: string; title?: string }[];
  value: T;
  onPick: (v: T) => void;
  label?: string;
}) {
  return (
    <span className="seg" role="group" aria-label={label}>
      {items.map((it) => (
        <button
          key={String(it.v)}
          type="button"
          aria-pressed={value === it.v}
          aria-label={it.aria}
          title={it.title}
          onClick={() => onPick(it.v)}
        >
          {it.label}
        </button>
      ))}
    </span>
  );
}

export const IMPORTANCES: Importance[] = [1, 2, 3];

/** 숨김 모드 제목 줄 아이콘(좁아서 글자 대신). 획은 currentColor. */
export function FindIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.4" />
      <path d="M10.4 10.4 14 14" />
    </svg>
  );
}

export function ReportIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="1.8" width="10" height="12.4" rx="1.5" />
      <path d="M5.6 5.6h4.8M5.6 8.4h4.8M5.6 11.2h2.8" />
    </svg>
  );
}

/** 고정 핀. 눌려 있으면 속을 채운다(CSS `[aria-pressed=true] svg`). */
export function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path className="pin-head" d="M5.6 1.8h4.8l-.7 4.3 2.6 2.6H3.7l2.6-2.6z" />
      <path d="M8 8.7v5.5" />
    </svg>
  );
}
