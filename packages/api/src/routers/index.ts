import type { RouterClient } from "@orpc/server";

import { devicesRouter } from "../devices/router";
import { publicProcedure, readyProcedure } from "../index";
import { installationRouter } from "../installation/router";
import { recoveryRouter } from "../recovery/router";
import { syncRouter } from "../sync/router";

export const appRouter = {
	devices: devicesRouter,
	healthCheck: publicProcedure.handler(() => "OK"),
	installation: installationRouter,
	privateData: readyProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
	recovery: recoveryRouter,
	sync: syncRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
