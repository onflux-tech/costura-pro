import { expect, test } from "bun:test";

import { initials, nameInitials } from "../src/lib/initials";

test("iniciais do username", () => {
	expect(initials("dona.atelie")).toBe("DA");
	expect(initials("ana_paula.souza")).toBe("AP");
	expect(initials("rita")).toBe("RI");
	expect(initials("x9")).toBe("X9");
});

test("iniciais do nome usam as duas primeiras palavras sem partícula", () => {
	expect(nameInitials("Maria Beatriz Alencar")).toBe("MB");
	expect(nameInitials("Maria da Silva")).toBe("MS");
	expect(nameInitials("Ateliê")).toBe("AT");
	expect(nameInitials("  ")).toBe("");
});
