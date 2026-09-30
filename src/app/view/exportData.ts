/**
 * 내보내기 실행 — 보관 파일을 읽어(평소엔 안 읽는다 — 이때만) core/export 로 묶고 저장 대화상자로.
 * 형식 규칙은 core/export.ts 에 있다. 읽지 못한 보관 파일은 없는 것으로(fail-soft).
 */
import { version } from "../../package.json";
import { archiveName, archiveYears, parseArchive } from "../core/archive";
import { plainOf, stampOf } from "../core/date";
import { buildExport, exportFileName, serializeExport } from "../core/export";
import type { TodoData } from "../core/model";
import { io } from "../io/io";

/** 내보낸 할 일 수. 대화상자에서 취소하면 null. */
export async function exportAll(data: TodoData, inboxName: string): Promise<number | null> {
  const now = new Date();
  const texts = await Promise.all(archiveYears(plainOf(now)).map((y) => io.read(archiveName(y)).catch(() => null)));
  const file = buildExport(data, texts.flatMap((t) => (t ? [parseArchive(t)] : [])), { now: stampOf(now), inboxName, appVersion: version });
  return (await io.saveText(exportFileName(plainOf(now)), serializeExport(file), "json")) ? file.items.length : null;
}
