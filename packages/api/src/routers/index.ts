import type { RouterClient } from "@orpc/server";

import { clientsRouter, profilesRouter } from "../clients/router";
import { devicesRouter } from "../devices/router";
import {
	financialAccountsRouter,
	financialMovementsRouter,
} from "../finance/router";
import { searchRouter } from "../global-search/router";
import { publicProcedure, readyProcedure } from "../index";
import { installationRouter } from "../installation/router";
import { inventorySessionsRouter } from "../inventory/router";
import { materialsRouter, materialVariantsRouter } from "../materials/router";
import {
	measurementsRouter,
	measurementTemplatesRouter,
} from "../measurements/router";
import { productsRouter, productVariantsRouter } from "../products/router";
import {
	obligationsRouter,
	purchasesRouter,
	suppliersRouter,
} from "../purchases/router";
import { receivedItemsRouter } from "../received-items/router";
import { recoveryRouter } from "../recovery/router";
import { pricingRouter, servicesRouter } from "../services/router";
import {
	stockBalancesRouter,
	stockLocationsRouter,
	stockLotsRouter,
	stockMovementsRouter,
} from "../stock/router";
import { syncRouter } from "../sync/router";

export const appRouter = {
	clients: clientsRouter,
	devices: devicesRouter,
	financialAccounts: financialAccountsRouter,
	financialMovements: financialMovementsRouter,
	healthCheck: publicProcedure.handler(() => "OK"),
	installation: installationRouter,
	inventorySessions: inventorySessionsRouter,
	materials: materialsRouter,
	materialVariants: materialVariantsRouter,
	measurements: measurementsRouter,
	measurementTemplates: measurementTemplatesRouter,
	obligations: obligationsRouter,
	pricing: pricingRouter,
	privateData: readyProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
	products: productsRouter,
	productVariants: productVariantsRouter,
	profiles: profilesRouter,
	purchases: purchasesRouter,
	receivedItems: receivedItemsRouter,
	recovery: recoveryRouter,
	search: searchRouter,
	services: servicesRouter,
	stockBalances: stockBalancesRouter,
	stockLocations: stockLocationsRouter,
	stockLots: stockLotsRouter,
	stockMovements: stockMovementsRouter,
	suppliers: suppliersRouter,
	sync: syncRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
