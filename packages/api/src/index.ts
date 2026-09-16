import { isAtLeast } from "@costura-pro/domain/installation-state";
import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";
import { authenticateDevice } from "./devices/store";
import { readInstallation } from "./installation/store";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return next({
		context: {
			session: context.session,
		},
	});
});

const requireLocal = o.middleware(({ context, next }) => {
	if (context.access !== "local") {
		throw new ORPCError("FORBIDDEN", {
			message: "Disponível só no acesso local",
		});
	}
	return next();
});

const requireReady = o.middleware(({ context, next }) => {
	const { state } = readInstallation(context.db);
	if (!isAtLeast(state, "ready")) {
		throw new ORPCError("PRECONDITION_FAILED", {
			data: { state },
			message: "Instalação ainda no wizard",
		});
	}
	return next();
});

export const protectedProcedure = publicProcedure.use(requireAuth);
export const localProcedure = publicProcedure.use(requireLocal);
export const ownerLocalProcedure = localProcedure.use(requireAuth);
export const readyProcedure = protectedProcedure.use(requireReady);
export const readyLocalProcedure = ownerLocalProcedure.use(requireReady);

export const deviceProcedure = readyProcedure.use(({ context, next }) =>
	next({
		context: {
			deviceRow: authenticateDevice(context.db, context.device, context.now()),
		},
	})
);

export const deviceOrLocalProcedure = readyProcedure.use(({ context, next }) =>
	next({
		context: {
			deviceRow:
				context.access === "local" && context.device === null
					? null
					: authenticateDevice(context.db, context.device, context.now()),
		},
	})
);
