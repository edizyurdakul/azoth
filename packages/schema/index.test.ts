import { describe, expect, test } from "bun:test";

describe("@azoth/schema", () => {
	test("module imports without error", async () => {
		const mod = await import("./index.ts");
		expect(mod).toBeDefined();
	});
});
