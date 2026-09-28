import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// `npm run dev`(브라우저 단독)와 `npm run tauri dev`(데스크톱)가 같은 앱을 띄운다.
// 브라우저에서 전 화면이 동작해야 한다 — e2e 와 스크린샷 확인이 여기서 돈다.
export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1440,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1441 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
