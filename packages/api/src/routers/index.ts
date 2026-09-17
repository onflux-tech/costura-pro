import type { RouterClient } from "@orpc/server";

import { clientsRouter, profilesRouter } from "../clients/router";
import { devicesRouter } from "../devices/router";
import { publicProcedure, readyProcedure } from "../index";
import { installationRouter } from "../installation/router";
import { materialsRouter, materialVariantsRouter } from "../materials/router";
import {
	measurementsRouter,
	measurementTemplatesRouter,
} from "../measurements/router";
import { receivedItemsRouter } from "../received-items/router";
import { recoveryRouter } from "../recovery/router";
import { syncRouter } from "../sync/router";

export const appRouter = {
	clients: clientsRouter,
	devices: devicesRouter,
	healthCheck: publicProcedure.handler(() => "OK"),
	installation: installationRouter,
	materials: materialsRouter,
	materialVariants: materialVariantsRouter,
	measurements: measurementsRouter,
	measurementTemplates: measurementTemplatesRouter,
	privateData: readyProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
	profiles: profilesRouter,
	receivedItems: receivedItemsRouter,
	recovery: recoveryRouter,
	sync: syncRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
