/**
 * e2e. `browser` 는 `npm run dev` 를 띄우고 크로미움으로 화면을 돈다 — 스크린샷 확인도 여기.
 * 포트는 env 로 뺀다: 워크트리에서 다른 트리가 띄워 둔 서버를 재사용해 **옛 코드를 시험하고
 * 통과**하는 일을 막으려면 `TODOMD_E2E_PORT=1450 npm run e2e` (Cairn 에서 겪은 함정).
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.TODOMD_E2E_PORT ?? 1440);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"]],
  projects: [
    {
      name: "browser",
      testMatch: /browser\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: BASE_URL, viewport: { width: 360, height: 900 } },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
