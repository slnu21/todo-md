/**
 * 화면 캡처 — 픽셀 비교가 아니라 **사람이 보고 일그러짐을 잡기 위한** 스냅숏.
 * `test-results/shots/*.png` 에 떨어진다. 위젯 크기(360×900)와 좁은 폭(300), 다크·영어·긴 제목을 모두 찍는다.
 *   npx playwright test screens
 */
import { expect, test, type Page } from "@playwright/test";

const OUT = "test-results/shots";

async function fresh(page: Page, url = "/?seed=sample") {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await expect(page.getByTestId("widget")).toBeVisible();
  await page.waitForTimeout(150);
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(300); // 여는 애니메이션(0.14초)이 끝난 모습을 찍는다
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test.describe("screens", () => {
  test("기본 — 라이트 한국어", async ({ page }) => {
    await fresh(page);
    await shot(page, "01-light-ko");
  });

  test("다크", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await fresh(page);
    await shot(page, "02-dark-ko");
  });

  test("영어", async ({ page }) => {
    await fresh(page);
    await page.getByRole("button", { name: /설정/ }).click();
    await page.getByRole("button", { name: "English" }).click();
    await page.keyboard.press("Escape");
    await shot(page, "03-light-en");
  });

  test("설정 팝오버", async ({ page }) => {
    await fresh(page);
    await page.getByRole("button", { name: /설정/ }).click();
    await shot(page, "04-settings");
  });

  test("상세 + 메모 기록", async ({ page }) => {
    await fresh(page);
    await page.getByRole("button", { name: /Store 재제출/ }).click();
    await expect(page.getByTestId("detail")).toBeVisible();
    await shot(page, "05-detail");
  });

  test("보관 확인 + 보관 목록 + 하위 펼침", async ({ page }) => {
    await fresh(page);
    const g = page.locator('section[data-project="p3"]');
    await g.hover();
    await g.getByRole("button", { name: /보관/ }).click();
    await page.locator('li[data-id] .subtoggle').first().click();
    await page.getByRole("button", { name: "보기", exact: true }).click();
    await shot(page, "06-archive-confirm");
    await page.getByTestId("list").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await shot(page, "07-archive-list");
  });

  test("달력 날짜 필터 + 주 보기", async ({ page }) => {
    await fresh(page);
    await page.locator(".day.today").click();
    await page.getByRole("button", { name: "주", exact: true }).click();
    await shot(page, "08-date-filter-week");
  });

  test("빈 상태(첫 실행)", async ({ page }) => {
    await fresh(page, "/");
    await shot(page, "09-empty");
  });

  test("좁은 폭 300 + 긴 제목", async ({ page }) => {
    await page.setViewportSize({ width: 300, height: 700 });
    await fresh(page);
    const long = "아주 긴 제목이 들어가면 줄바꿈이 어떻게 되는지 확인하기 위한 할 일입니다 — Partner Center 제출 체크리스트 전체 검토";
    await page.getByLabel("할 일", { exact: true }).fill(long);
    await page.getByLabel("담당", { exact: true }).fill("아주길고긴담당자이름표시테스트");
    await page.getByLabel("할 일", { exact: true }).press("Enter");
    await expect(page.getByLabel("할 일", { exact: true })).toHaveValue(""); // 추가 뒤 입력칸은 비고 포커스는 남는다
    await expect(page.getByLabel("할 일", { exact: true })).toBeFocused();
    await shot(page, "10-narrow-long");
  });
});

test.describe("screens — 주간보고", () => {
  test("보고 창 크기(940×760)", async ({ page }) => {
    await page.setViewportSize({ width: 940, height: 760 });
    await fresh(page);
    await page.getByRole("button", { name: "보고", exact: true }).click();
    await shot(page, "11-report-wide");
    await page.getByRole("button", { name: "메일 붙여넣기용" }).click();
    await shot(page, "12-report-mail-custom");
  });
  test("좁은 폭(360) — 한 칸으로", async ({ page }) => {
    await fresh(page);
    await page.getByRole("button", { name: "보고", exact: true }).click();
    await shot(page, "13-report-narrow");
  });
  test("다크 + 영어", async ({ page }) => {
    await page.setViewportSize({ width: 940, height: 760 });
    await page.emulateMedia({ colorScheme: "dark" });
    await fresh(page);
    await page.getByRole("button", { name: /설정/ }).click();
    await page.getByRole("button", { name: "English" }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Report", exact: true }).click();
    await shot(page, "14-report-dark-en");
  });
});
