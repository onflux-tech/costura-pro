import { expect, test } from "bun:test";

import { initials } from "../src/lib/initials";

test("iniciais do username", () => {
	expect(initials("dona.atelie")).toBe("DA");
	expect(initials("ana_paula.souza")).toBe("AP");
	expect(initials("rita")).toBe("RI");
	expect(initials("x9")).toBe("X9");
});
