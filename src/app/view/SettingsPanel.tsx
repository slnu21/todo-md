/**
 * 설정 팝오버 — 위치(모니터 그림에서 가장자리 누르기) · 방식(도킹/떠 있기) · 폭 · 테마 · 언어 · 자동 실행 · × 버튼 · 데이터 폴더 · 종료.
 * 모니터 그림은 Windows 디스플레이 설정처럼 **실제 배치 비율**로 그린다.
 */
import { useEffect, useState } from "react";
import type { CloseAction, LangPref, Settings, ThemePref } from "../core/settings";
import { WIDTH_MAX, WIDTH_MIN } from "../core/settings";
import { io, type MonitorInfo } from "../io/io";
import { Seg, useT } from "./ui";

const BOX_W = 300;
const BOX_H = 96;

export function SettingsPanel({
  settings, dataDir, onChange, onOpenDataDir, onExport, onQuit,
}: {
  settings: Settings;
  dataDir: string;
  onChange: (fn: (s: Settings) => Settings) => void;
  onOpenDataDir: () => void;
  /** 내보낸 할 일 수, 취소하면 null. */
  onExport: () => Promise<number | null>;
  onQuit: () => void;
}) {
  const { t } = useT();
  const [exportMsg, setExportMsg] = useState("");
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const desktop = io.kind === "tauri";

  useEffect(() => {
    void io.listMonitors().then(setMonitors).catch(() => setMonitors([]));
    // 로그인 시 자동 실행은 포터블 전용(HKCU Run) — Store 설치판에선 레지스트리가 가상화돼 듣지 않으므로 숨긴다(null).
    if (desktop) {
      void io.isPackaged()
        .then((packaged) => (packaged ? null : io.getAutostart()))
        .then((v) => setAutostart(v))
        .catch(() => setAutostart(false));
    }
  }, [desktop]);

  const dock = settings.dock;
  const setDock = (patch: Partial<Settings["dock"]>) => onChange((s) => ({ ...s, dock: { ...s.dock, ...patch } }));

  // 모니터 그림: 전체 배치의 테두리 상자에 맞춰 줄인다.
  const minX = Math.min(...monitors.map((m) => m.x), 0);
  const minY = Math.min(...monitors.map((m) => m.y), 0);
  const maxX = Math.max(...monitors.map((m) => m.x + m.width), 1);
  const maxY = Math.max(...monitors.map((m) => m.y + m.height), 1);
  const k = Math.min(BOX_W / (maxX - minX), BOX_H / (maxY - minY));
  let n = 1;
  const label = (m: MonitorInfo) => (m.primary ? t("mon.primary") : t("mon.n", { n: ++n }));
  // 고른 모니터가 없어졌으면 주 모니터가 선택된 것으로 보인다(Rust 도 그렇게 놓는다).
  const selected = monitors.some((m) => m.name === dock.monitor) ? dock.monitor : monitors.find((m) => m.primary)?.name ?? "";

  return (
    <div className="pop" id="settings-pop" role="dialog" aria-label={t("bar.settings")}>
      {desktop && (
        <>
          <div>
            <h4>{t("set.position")}</h4>
            <div className="monitors" style={{ width: (maxX - minX) * k, height: (maxY - minY) * k }}>
              {monitors.map((m) => {
                const name = label(m);
                const on = (edge: "left" | "right") => m.name === selected && dock.edge === edge;
                const pick = (edge: "left" | "right") => setDock({ edge, monitor: m.primary ? "" : m.name });
                return (
                  <div
                    key={m.name || "primary"}
                    className={"mon" + (m.name === selected ? " sel" : "")}
                    style={{ left: (m.x - minX) * k, top: (m.y - minY) * k, width: m.width * k - 4, height: m.height * k - 4 }}
                  >
                    <button type="button" className="edge l" aria-pressed={on("left")} aria-label={t("mon.left", { m: name })} onClick={() => pick("left")} />
                    <span>{name}<small>{m.width}×{m.height}</small></span>
                    <button type="button" className="edge r" aria-pressed={on("right")} aria-label={t("mon.right", { m: name })} onClick={() => pick("right")} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pop-row">
            <div>
              <h4>{t("set.mode")}</h4>
              <Seg items={[{ v: "dock", label: t("mode.dock") }, { v: "float", label: t("mode.float") }]} value={dock.mode} onPick={(v) => setDock({ mode: v })} />
            </div>
            <div className="grow">
              <h4>{t("set.width")} <span className="val">{dock.width}px</span></h4>
              <input
                type="range"
                min={WIDTH_MIN}
                max={WIDTH_MAX}
                step={10}
                aria-label={t("set.width")}
                value={dock.width}
                onChange={(e) => setDock({ width: +e.target.value })}
              />
            </div>
          </div>
          <p className="note">{t("set.note")}</p>
        </>
      )}
      <div className="pop-row">
        <div>
          <h4>{t("set.theme")}</h4>
          <Seg<ThemePref>
            items={[{ v: "system", label: t("opt.system") }, { v: "light", label: t("theme.light") }, { v: "dark", label: t("theme.dark") }]}
            value={settings.theme}
            onPick={(v) => onChange((s) => ({ ...s, theme: v }))}
          />
        </div>
        <div>
          <h4>{t("set.lang")}</h4>
          <Seg<LangPref>
            items={[{ v: "system", label: t("opt.system") }, { v: "ko", label: "한국어" }, { v: "en", label: "English" }]}
            value={settings.lang}
            onPick={(v) => onChange((s) => ({ ...s, lang: v }))}
          />
        </div>
      </div>
      {desktop && autostart !== null && (
        <label className="check">
          <input
            type="checkbox"
            checked={autostart}
            onChange={(e) => {
              const on = e.target.checked;
              setAutostart(on);
              void io.setAutostart(on).catch(() => setAutostart(!on));
            }}
          />
          {t("set.autostart")}
        </label>
      )}
      {desktop && (
        <div>
          <h4>{t("set.close")}</h4>
          <Seg<CloseAction>
            label={t("set.close")}
            items={[{ v: "ask", label: t("closeOpt.ask") }, { v: "hide", label: t("close.hide") }, { v: "quit", label: t("close.quit") }]}
            value={settings.closeAction}
            onPick={(v) => onChange((s) => ({ ...s, closeAction: v }))}
          />
        </div>
      )}
      <div>
        <h4>{t("set.data")}</h4>
        <p className="path">{dataDir}</p>
        <div className="pop-row">
          <button type="button" className="btn ghost" onClick={onOpenDataDir}>{t("set.openData")}</button>
          <button
            type="button"
            className="btn ghost"
            title={t("set.exportTitle")}
            onClick={() => {
              setExportMsg("");
              onExport()
                .then((n) => { if (n !== null) setExportMsg(t("set.exported", { n })); })
                .catch((e) => setExportMsg(t("set.exportFail", { msg: String(e) })));
            }}
          >
            {t("set.export")}
          </button>
          {desktop && <button type="button" className="btn ghost danger-btn" onClick={onQuit}>{t("set.quit")}</button>}
        </div>
        {exportMsg && <p className="note export-msg" role="status">{exportMsg}</p>}
      </div>
    </div>
  );
}
