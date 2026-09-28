/**
 * 주간보고 화면 — 왼쪽 규칙, 오른쪽 결과(마크다운 원문) + 복사 + .md 저장.
 * 데스크톱은 별도 창(ReportApp), 브라우저는 위젯 위 패널. 규칙 변경은 `onRules` 로 올려 보낸다
 * (위젯 창의 store 가 데이터 파일에 저장한다 — 보고 규칙은 데이터와 같이 옮겨 다닌다).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { isoWeek, pad2, type PlainDate } from "../core/date";
import type { Key, Lang } from "../core/i18n";
import type { TodoData } from "../core/model";
import {
  buildReport, DATE_FORMATS, genTemplates, presetFor, templatesOf, type PresetKey, type ReportRules, type Templates,
} from "../core/report";
import { copyText, io } from "../io/io";
import { useT } from "./ui";

/**
 * 글자 입력칸. 값을 로컬에 들고 있다가 바뀔 때마다 올려 보낸다. 포커스가 없을 때만 밖의 값을 받는다 —
 * 보고 창은 변경이 위젯 창을 한 바퀴 돌아오므로, 받은 값으로 매번 덮으면 빠르게 칠 때 글자가 빠진다.
 */
function TextField({ value, onCommit, ...rest }: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (document.activeElement !== ref.current) setV(value); }, [value]);
  return <input {...rest} ref={ref} value={v} onChange={(e) => { setV(e.target.value); onCommit(e.target.value); }} />;
}

export function ReportView({
  data, rules, today, lang, onRules, onClose,
}: {
  data: TodoData;
  rules: ReportRules;
  today: PlainDate;
  lang: Lang;
  onRules: (r: ReportRules) => void;
  onClose?: () => void;
}) {
  const { t } = useT();
  const [msg, setMsg] = useState("");
  const outRef = useRef<HTMLPreElement>(null);
  const result = useMemo(() => buildReport(data, rules, today, lang), [data, rules, today, lang]);
  const T = templatesOf(rules);
  const lines = result.text ? result.text.split("\n").length : 0;

  useEffect(() => {
    if (!msg) return;
    const h = setTimeout(() => setMsg(""), 2200);
    return () => clearTimeout(h);
  }, [msg]);

  const set = (patch: Partial<ReportRules>) => onRules({ ...rules, ...patch, preset: "" });
  const pickPreset = (k: PresetKey) => onRules({ ...rules, ...presetFor(k, lang), preset: k });
  const setTpl = (k: keyof Templates, v: string) => {
    if (!rules.custom) return;
    onRules({ ...rules, tpl: { ...(rules.tpl ?? genTemplates(rules)), [k]: v }, preset: "" });
  };
  const formats = DATE_FORMATS[lang].some((f) => f.fmt === rules.fmt) ? DATE_FORMATS[lang] : [...DATE_FORMATS[lang], { fmt: rules.fmt, sample: rules.fmt }];

  async function copy() {
    if (await copyText(result.text)) { setMsg(t("r.copied")); return; }
    // 복사가 막힌 환경 — 글을 선택해 두고 Ctrl+C 를 안내한다.
    const el = outRef.current;
    if (el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    setMsg(t("r.selected"));
  }

  async function save() {
    const w = isoWeek(today);
    const name = `${t("r.fileName")}-${w.year}-W${pad2(w.week)}.md`;
    try {
      if (await io.saveText(name, result.text + "\n")) setMsg(t("r.saved"));
    } catch (e) {
      setMsg(t("r.saveFail", { msg: String(e) }));
    }
  }

  const opt = (keys: [string, Key][]) => keys.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>);

  return (
    <div className="report-shell" data-testid="report">
      <div className="w-bar">
        <span className="name">{t("r.title")}</span>
        {onClose && <button type="button" className="iconbtn" aria-label={t("r.close")} onClick={onClose}>×</button>}
      </div>
      <div className="report-body">
        <div className="report">
          <form className="rules" onSubmit={(e) => e.preventDefault()} autoComplete="off">
            <div className="presets" role="group" aria-label={t("r.presets")}>
              {(["md", "brief", "mail"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={rules.preset === k} onClick={() => pickPreset(k)}>{t(`preset.${k}`)}</button>
              ))}
            </div>

            <fieldset>
              <legend>{t("r.what")}</legend>
              <label className="k" htmlFor="r-range">{t("r.range")}</label>
              <select id="r-range" className="field" value={rules.range} onChange={(e) => set({ range: e.target.value as ReportRules["range"] })}>
                {opt([["7d", "range.7d"], ["week", "range.week"], ["lastweek", "range.lastweek"]])}
              </select>
              <label className="k" htmlFor="r-actual-title">{t("r.actual")}</label>
              <span className="inline">
                <input type="checkbox" aria-label={t("r.actualAria")} checked={rules.actual} onChange={(e) => set({ actual: e.target.checked })} />
                <TextField id="r-actual-title" className="field" value={rules.actualTitle} onCommit={(v) => set({ actualTitle: v })} />
              </span>
              <label className="k" htmlFor="r-plan-title">{t("r.plan")}</label>
              <span className="inline">
                <input type="checkbox" aria-label={t("r.planAria")} checked={rules.plan} onChange={(e) => set({ plan: e.target.checked })} />
                <TextField id="r-plan-title" className="field" value={rules.planTitle} onCommit={(v) => set({ planTitle: v })} />
              </span>
              <label className="k" htmlFor="r-group">{t("r.group")}</label>
              <select id="r-group" className="field" value={rules.group} onChange={(e) => set({ group: e.target.value as ReportRules["group"] })}>
                {opt([["project", "group.project"], ["status", "group.status"]])}
              </select>
            </fieldset>

            <fieldset>
              <legend>{t("r.line")}</legend>
              <label className="k" htmlFor="r-pos">{t("r.pos")}</label>
              <select id="r-pos" className="field" disabled={rules.custom} value={rules.pos} onChange={(e) => set({ pos: e.target.value as ReportRules["pos"] })}>
                {opt([["front", "pos.front"], ["back", "pos.back"], ["none", "pos.none"]])}
              </select>
              <label className="k" htmlFor="r-l-done">{t("r.labels")}</label>
              <span className="inline">
                {(["done", "doing", "todo"] as const).map((s) => (
                  <TextField
                    key={s}
                    id={s === "done" ? "r-l-done" : undefined}
                    className="field"
                    aria-label={t(`status.${s}`)}
                    value={rules.labels[s]}
                    onCommit={(v) => set({ labels: { ...rules.labels, [s]: v } })}
                  />
                ))}
              </span>
              <label className="k" htmlFor="r-date">{t("r.date")}</label>
              <select id="r-date" className="field" disabled={rules.custom} value={rules.date} onChange={(e) => set({ date: e.target.value as ReportRules["date"] })}>
                {opt([["auto", "date.auto"], ["due", "date.due"], ["none", "date.none"]])}
              </select>
              <label className="k" htmlFor="r-fmt">{t("r.fmt")}</label>
              <select id="r-fmt" className="field" value={rules.fmt} onChange={(e) => set({ fmt: e.target.value })}>
                {formats.map((f) => <option key={f.fmt} value={f.fmt}>{f.sample}</option>)}
              </select>
            </fieldset>

            <fieldset>
              <legend>{t("r.detail")}</legend>
              <label className="k" htmlFor="r-subs">{t("r.subs")}</label>
              <select id="r-subs" className="field" value={rules.subs} onChange={(e) => set({ subs: e.target.value as ReportRules["subs"] })}>
                {opt([["none", "subs.none"], ["progress", "subs.progress"], ["open", "subs.open"], ["all", "subs.all"]])}
              </select>
              <label className="k" htmlFor="r-substyle">{t("r.substyle")}</label>
              <select id="r-substyle" className="field" disabled={rules.custom} value={rules.subStyle} onChange={(e) => set({ subStyle: e.target.value as ReportRules["subStyle"] })}>
                {opt([["check", "substyle.check"], ["plain", "substyle.plain"]])}
              </select>
              <label className="k" htmlFor="r-memos">{t("r.memos")}</label>
              <span className="inline">
                <select id="r-memos" className="field" value={rules.memos} onChange={(e) => set({ memos: e.target.value as ReportRules["memos"] })}>
                  {opt([["none", "memos.none"], ["range", "memos.range"], ["recent", "memos.recent"], ["all", "memos.all"]])}
                </select>
                <input
                  type="number"
                  className="field num"
                  min={1}
                  max={20}
                  aria-label={t("r.memoN")}
                  disabled={rules.memos !== "recent"}
                  value={rules.memoN}
                  onChange={(e) => set({ memoN: Math.min(20, Math.max(1, +e.target.value || 1)) })}
                />
              </span>
              <label className="k" htmlFor="r-memotime">{t("r.memotime")}</label>
              <select id="r-memotime" className="field" disabled={rules.custom} value={rules.memoTime} onChange={(e) => set({ memoTime: e.target.value as ReportRules["memoTime"] })}>
                {opt([["datetime", "mt.datetime"], ["date", "mt.date"], ["none", "mt.none"]])}
              </select>
            </fieldset>

            <details className="adv" open={rules.custom || undefined}>
              <summary>{t("r.adv")}</summary>
              <div className="tpl">
                <label className="row">
                  <input
                    type="checkbox"
                    checked={rules.custom}
                    onChange={(e) => onRules({ ...rules, custom: e.target.checked, tpl: e.target.checked ? rules.tpl ?? genTemplates(rules) : rules.tpl, preset: "" })}
                  />
                  <span>{t("r.custom")}</span>
                </label>
                {(["sec", "group", "line", "sub", "memo"] as const).map((k) => (
                  <label key={k}>
                    <span>{t(`t.${k}`)}</span>
                    <TextField className="field mono" readOnly={!rules.custom} value={T[k]} onCommit={(v) => setTpl(k, v)} />
                  </label>
                ))}
                <p className="hint">{t("t.hint")}</p>
              </div>
            </details>
          </form>

          <div className="out">
            <div className="out-bar">
              <span role="status">{msg || t("r.stat", { a: result.actualCount, b: result.planCount, n: lines })}</span>
              <span className="acts">
                <button type="button" className="btn ghost" onClick={save} disabled={!result.text}>{t("r.save")}</button>
                <button type="button" className="btn" onClick={copy} disabled={!result.text}>{t("r.copy")}</button>
              </span>
            </div>
            <pre ref={outRef} className="mono" tabIndex={0} aria-label={t("r.outAria")} data-testid="report-out">
              {result.text || t("r.empty")}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
