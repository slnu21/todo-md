import { describe, expect, it } from "vitest";
import { APP_NAME } from "./meta";

describe("meta", () => {
  it("제품 표시명은 TODO.md", () => expect(APP_NAME).toBe("TODO.md"));
});
