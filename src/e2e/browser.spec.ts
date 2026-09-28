/**
 * 기능 e2e(브라우저 모드). 설계(CLAUDE.md '확정 결정')대로 동작하는지 사용자처럼 눌러 본다.
 * 페이지 오류가 하나라도 나면 실패한다.
 */
import { expect, test, type Page } from "@playwright/test";

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
});
test.afterEach(() => expect(errors, errors.join("\n")).toEqual([]));

async function fresh(page: Page, url = "/") {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await expect(page.getByTestId("widget")).toBeVisible();
}

const titleInput = (page: Page) => page.getByLabel("할 일", { exact: true });
const row = (page: Page, title: string) => page.locator("li.item").filter({ hasText: title });

test("한 줄 입력 — Enter 뒤 입력칸은 비고 포커스와 프로젝트는 남는다", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  await page.getByLabel("프로젝트").selectOption({ label: "Cairn" });
  await titleInput(page).fill("첫째");
  await titleInput(page).press("Enter");
  await expect(titleInput(page)).toHaveValue("");
  await expect(titleInput(page)).toBeFocused();
  await titleInput(page).fill("둘째");
  await titleInput(page).press("Enter");
  const cairn = page.locator('section[data-project="p2"]');
  await expect(cairn.locator("li.item .t")).toContainText(["첫째", "둘째"]);
  await expect(page.getByLabel("프로젝트")).toHaveValue("p2");
});

test("상태 동그라미: 할 일 → 진행(형광펜) → 완료(접힘) → 할 일", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const r = row(page, "스크린샷 다시 찍기");
  await r.locator(".status").click();
  await expect(r).toHaveClass(/doing/);
  await row(page, "스크린샷 다시 찍기").locator(".status").click();
  await expect(row(page, "스크린샷 다시 찍기")).toHaveCount(0); // 완료는 접힌다
  await page.locator('section[data-project="p1"]').getByRole("button", { name: /완료 2개 보기/ }).click();
  await row(page, "스크린샷 다시 찍기").locator(".status").click();
  await expect(row(page, "스크린샷 다시 찍기")).toHaveClass(/todo/);
});

test("정렬: 진행 → 중요도 높음 → 마감 빠른 순", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const titles = await page.locator('section[data-project="p1"] li.item .t').allTextContents();
  expect(titles).toEqual(["Store 재제출 (시작 메뉴 항목 정리한 패키지)", "업데이트 확인 저장소 이름 slnu21로", "스크린샷 다시 찍기"]);
});

test("메모 기록: Enter 마다 한 줄, 시각이 붙고, 목록에 마지막 메모가 보인다", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  await row(page, "스크린샷 다시 찍기").getByRole("button", { name: "스크린샷 다시 찍기" }).click();
  const memo = page.getByLabel("메모", { exact: true });
  await expect(memo).toBeFocused();
  await memo.fill("캡처 도구 정했음");
  await memo.press("Enter");
  await memo.fill("다크 테마도 찍기");
  await memo.press("Enter");
  const log = page.getByTestId("memo-log");
  await expect(log.locator("li.m")).toHaveCount(2);
  await expect(log.locator("li.m time").first()).toHaveText(/^\d{2}:\d{2}$/);
  await expect(log.locator(".day-h")).toContainText("(오늘)");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("detail")).toHaveCount(0);
  await expect(row(page, "스크린샷 다시 찍기").locator(".lastmemo")).toContainText("다크 테마도 찍기");
});

test("하위 항목 한 단계 — 목록에서 펼쳐 추가·체크", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const r = row(page, "회의실 예약");
  await r.getByRole("button", { name: "하위 추가" }).click();
  const input = r.getByPlaceholder("하위 항목 추가 후 Enter");
  await input.fill("오전 10시");
  await input.press("Enter");
  await r.getByLabel("오전 10시").check();
  await expect(r.getByRole("button", { name: "하위 1/1" })).toBeVisible();
});

test("보관: 남은 일이 있으면 묻고, 되돌릴 수 있다", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const g = page.locator('section[data-project="p3"]');
  await g.getByRole("button", { name: "사내 교육 준비 보관" }).click();
  await expect(g.getByText("남은 할 일이 2건 있습니다")).toBeVisible();
  await g.getByRole("button", { name: "그대로 보관" }).click();
  await expect(page.locator('section[data-project="p3"]')).toHaveCount(0);
  await expect(page.getByLabel("프로젝트").locator("option", { hasText: "사내 교육 준비" })).toHaveCount(0);
  await page.getByRole("button", { name: "보기", exact: true }).click();
  await page.locator(".archive-box li", { hasText: "사내 교육 준비" }).getByRole("button", { name: "되돌리기" }).click();
  await expect(page.locator('section[data-project="p3"]')).toBeVisible();
});

test("미분류는 보관 버튼이 없다", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  await expect(page.locator('section[data-project="inbox"]').getByRole("button", { name: /보관/ })).toHaveCount(0);
});

test("달력: 날짜를 누르면 그날 마감만 + 새 입력 마감일이 그날", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  await page.locator(".day.today").click();
  await expect(page.locator("li.item")).toHaveCount(1);
  const due = await page.getByLabel("마감일").inputValue();
  expect(due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await titleInput(page).fill("오늘 마감 새 일");
  await titleInput(page).press("Enter");
  await expect(page.locator("li.item")).toHaveCount(2);
  await page.getByRole("button", { name: "전체 보기" }).click();
  await expect(page.locator("li.item").first()).toBeVisible();
});

test("새 프로젝트를 입력줄에서 만들면 바로 선택된다", async ({ page }) => {
  await fresh(page);
  await page.getByLabel("프로젝트").selectOption({ label: "＋ 새 프로젝트" });
  await page.getByLabel("새 프로젝트 이름").fill("분기 보고");
  await page.getByLabel("새 프로젝트 이름").press("Enter");
  await expect(page.getByLabel("프로젝트").locator("option:checked")).toHaveText("분기 보고");
  await titleInput(page).fill("초안");
  await titleInput(page).press("Enter");
  await expect(page.locator("section.group").first()).toContainText("분기 보고");
});

test("저장하고 다시 열어도 그대로 — 테마·언어 설정 포함", async ({ page }) => {
  await fresh(page);
  await titleInput(page).fill("남아 있어야 할 일");
  await titleInput(page).press("Enter");
  await page.getByRole("button", { name: /설정/ }).click();
  await page.getByRole("button", { name: "다크" }).click();
  await page.getByRole("button", { name: "English" }).click();
  await page.waitForTimeout(700); // 0.5초 모아 저장
  await page.reload();
  await expect(row(page, "남아 있어야 할 일")).toBeVisible();
  await expect(page.getByRole("button", { name: /Settings/ })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("깨진 파일은 덮어쓰지 않는다", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("todomd:todo.json", "{ broken"));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("저장을 멈췄습니다");
  await titleInput(page).fill("이건 저장되면 안 됨");
  await titleInput(page).press("Enter");
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => localStorage.getItem("todomd:todo.json"))).toBe("{ broken");
});
