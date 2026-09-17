import { expect, test } from "bun:test";

import { activeDestination } from "../src/lib/active-destination";
import { destinations } from "../src/lib/destinations";

const idOf = (pathname: string) =>
	activeDestination(pathname, destinations)?.id;

test("Hoje só casa o início exato", () => {
	expect(idOf("/")).toBe("hoje");
	expect(idOf("/agenda")).toBe("agenda");
});

test("destino casa o próprio caminho e subcaminhos com fronteira", () => {
	expect(idOf("/os")).toBe("os");
	expect(idOf("/os/123")).toBe("os");
	expect(idOf("/os-antigas")).toBeUndefined();
	expect(idOf("/configuracoes")).toBe("configuracoes");
});

test("rota fora da navegação não ativa destino", () => {
	expect(idOf("/configuracao-inicial")).toBeUndefined();
	expect(idOf("/login")).toBeUndefined();
});
