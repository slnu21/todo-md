/**
 * 입력줄. 외울 문법 없이 필드로: 프로젝트(Enter 뒤에도 유지) + 제목 + 중요도·마감·담당(선택).
 * 달력에서 날짜를 고르면 마감일이 그날로 채워진다.
 */
import { useEffect, useRef, useState } from "react";
import type { PlainDate } from "../core/date";
import { INBOX_ID, type Importance, type Project } from "../core/model";
import { Bars, IMPORTANCES, Seg, useT } from "./ui";

const NEW = "__new";

export function QuickInput({
  projects, projectId, onProject, selDate, onAdd, onCreateProject,
}: {
  projects: Project[];
  projectId: string;
  onProject: (id: string) => void;
  selDate: PlainDate | "";
  onAdd: (a: { projectId: string; title: string; importance: Importance; due: PlainDate | ""; assignee: string }) => void;
  onCreateProject: (name: string) => string | null;
}) {
  const { t } = useT();
  const [title, setTitle] = useState("");
  const [imp, setImp] = useState<Importance>(2);
  const [due, setDue] = useState<PlainDate | "">(selDate);
  const [owner, setOwner] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDue(selDate), [selDate]);
  useEffect(() => { if (creating) newRef.current?.focus(); }, [creating]);

  const current = projects.some((p) => p.id === projectId) ? projectId : projects[0]?.id ?? INBOX_ID;
  const name = (p: Project) => (p.id === INBOX_ID ? t("inbox.name") : p.name);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ projectId: current, title, importance: imp, due, assignee: owner });
    // 프로젝트는 그대로 — 같은 프로젝트에 연달아 적는다. 마감일은 고른 날로 되돌린다.
    setTitle("");
    setOwner("");
    setImp(2);
    setDue(selDate);
    titleRef.current?.focus();
  }

  function create() {
    const id = onCreateProject(newName);
    if (!id) return;
    onProject(id);
    setNewName("");
    setCreating(false);
    titleRef.current?.focus();
  }

  return (
    <form className="quick" onSubmit={submit} autoComplete="off" data-testid="quick">
      <select
        className="field project"
        aria-label={t("q.project")}
        value={creating ? NEW : current}
        onChange={(e) => (e.target.value === NEW ? setCreating(true) : (setCreating(false), onProject(e.target.value)))}
      >
        {projects.map((p) => <option key={p.id} value={p.id}>{name(p)}</option>)}
        <option value={NEW}>{t("q.newProject")}</option>
      </select>
      {creating && (
        <div className="qrow">
          <input
            ref={newRef}
            className="field title"
            aria-label={t("q.newName")}
            placeholder={t("q.newName")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); create(); }
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
          />
          <button type="button" className="btn" onClick={create}>{t("q.create")}</button>
          <button type="button" className="btn ghost" onClick={() => { setCreating(false); setNewName(""); }}>{t("q.cancel")}</button>
        </div>
      )}
      <div className="qrow">
        <input
          ref={titleRef}
          className="field title"
          aria-label={t("q.titleAria")}
          placeholder={t("q.title")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className="btn">{t("q.add")}</button>
      </div>
      <div className="qrow">
        <Seg
          label={t("q.imp")}
          items={IMPORTANCES.map((l) => ({ v: l, label: <Bars level={l} />, aria: t("imp.title", { l: t(`imp.${l}`) }), title: t(`imp.${l}`) }))}
          value={imp}
          onPick={setImp}
        />
        <input className="field due" type="date" aria-label={t("q.due")} value={due} onChange={(e) => setDue(e.target.value)} />
        <input className="field owner" aria-label={t("q.owner")} placeholder={t("q.owner")} value={owner} onChange={(e) => setOwner(e.target.value)} />
      </div>
    </form>
  );
}
