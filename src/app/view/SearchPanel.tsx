/**
 * 찾기 패널 — 목록 자리에 뜬다. 검색어가 비면 '완료한 일' 기록(지난 완료 보기).
 * 보관 파일(30일 지난 완료)은 **체크했을 때만** 읽는다 — 평소엔 읽지 않는다는 규칙(archive.ts) 그대로.
 * 규칙은 core/search 에 있고 여기선 그리기만 한다.
 */
import { useEffect, useMemo, useState } from "react";
import { archiveName, archiveSources, archiveYears, parseArchive } from "../core/archive";
import { dateOfStamp, type PlainDate } from "../core/date";
import { mdLabel, type Key } from "../core/i18n";
import { INBOX_ID, type TodoData } from "../core/model";
import { highlight, search, tokens, type Source } from "../core/search";
import { io } from "../io/io";
import { StatusIcon, useT } from "./ui";

const LIMIT = 200;

export function SearchPanel({
  data, today, onOpen, onClose,
}: {
  data: TodoData;
  today: PlainDate;
  onOpen: (id: string, anchorY: number) => void;
  onClose: () => void;
}) {
  const { lang, t } = useT();
  const [q, setQ] = useState("");
  const [withArchive, setWithArchive] = useState(false);
  const [archive, setArchive] = useState<Source[] | null>(null);

  // 처음 체크할 때 한 번 읽는다. 읽지 못한 해는 없는 것으로(fail-soft).
  useEffect(() => {
    if (!withArchive || archive) return;
    let live = true;
    void Promise.all(archiveYears(today).map((y) => io.read(archiveName(y)).catch(() => null))).then((texts) => {
      if (live) setArchive(texts.flatMap((text) => (text ? archiveSources(parseArchive(text)) : [])));
    });
    return () => { live = false; };
  }, [withArchive, archive, today]);

  const sources = useMemo<Source[]>(() => {
    const name = (id: string) => (id === INBOX_ID ? t("inbox.name") : data.projects.find((p) => p.id === id)?.name ?? "");
    const live = data.items.map((item) => ({ item, project: name(item.projectId), archived: false }));
    if (!withArchive || !archive) return live;
    // 보관 이동이 도중에 멈추면 같은 할 일이 양쪽에 있다 — todo.json 쪽을 쓴다.
    const have = new Set(data.items.map((i) => i.id));
    return [...live, ...archive.filter((s) => !have.has(s.item.id))];
  }, [data, withArchive, archive, t]);

  const { hits, total } = useMemo(() => search(sources, q, LIMIT), [sources, q]);
  const words = tokens(q);
  const marks = (text: string) => highlight(text, words).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>));

  return (
    <div className="search" role="search" data-testid="search">
      <div className="s-bar">
        <input
          type="search"
          className="field"
          autoFocus
          placeholder={t("find.ph")}
          aria-label={t("find.ph")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }}
        />
        <button type="button" className="iconbtn" aria-label={t("find.close")} title={t("find.close")} onClick={onClose}>×</button>
      </div>
      <label className="check s-arch">
        <input type="checkbox" checked={withArchive} onChange={(e) => setWithArchive(e.target.checked)} />
        {t("find.archive")}
      </label>
      <p className="s-count" aria-live="polite">
        {withArchive && !archive
          ? t("find.loading")
          : <>{q.trim() ? t("find.count", { n: total }) : t("find.doneTitle", { n: total })}{total > LIMIT && " " + t("find.more", { n: LIMIT })}</>}
      </p>
      {hits.length === 0 && !(withArchive && !archive) && <p className="empty">{q.trim() ? t("find.none") : t("find.noneDone")}</p>}
      <ul className="s-list">
        {hits.map((h) => {
          const it = h.item;
          const status = it.status === "doing" || it.status === "done" ? it.status : "todo";
          const meta = [
            h.project,
            status === "done" && it.doneAt ? t("find.doneOn", { date: mdLabel(lang, dateOfStamp(it.doneAt)) }) : t(`status.${status}` as Key),
            h.archived ? t("find.archived") : "",
          ].filter(Boolean).join(" · ");
          const body = (
            <>
              <StatusIcon status={status} />
              <span className="s-text">
                <span className="s-title">{marks(it.title ?? "")}</span>
                <span className="s-meta">{meta}</span>
                {h.memo && (
                  <span className="s-memo">
                    <time dateTime={h.memo.at}>{mdLabel(lang, dateOfStamp(h.memo.at))}</time>
                    {marks(h.memo.text)}
                  </span>
                )}
              </span>
            </>
          );
          return (
            <li key={(h.archived ? "a:" : "") + it.id} className={`s-hit ${status}`}>
              {h.archived ? (
                // 보관 파일의 할 일은 todo.json 에 없어 상세를 열 수 없다 — 읽기만.
                <div className="s-row">{body}</div>
              ) : (
                <button type="button" className="s-row" onClick={(e) => onOpen(it.id, e.currentTarget.getBoundingClientRect().top)}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
