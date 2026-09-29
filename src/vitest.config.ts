import { defineConfig } from "vitest/config";

// vitest 는 app/core·app/io 의 순수 로직만 돈다(reducer·보고서·날짜·스키마). DOM 도 Tauri 도 모른다.
// scripts/ 의 순수 부분(라이선스 판정 등)도 여기서 — 파일·프로세스를 만지는 스크립트 본체는 테스트하지 않는다.
// 앱 빌드용 vite.config.ts 와 분리 — 테스트 설정이 앱 빌드로 흘러들지 않게.
export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
