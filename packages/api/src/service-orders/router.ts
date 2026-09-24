import z from "zod";

import { readyProcedure } from "../index";
import {
	getServiceOrder,
	listServiceOrders,
	serviceOrderListInput,
} from "./queries";

export const serviceOrdersRouter = {
	get: readyProcedure
		.input(z.object({ serviceOrderId: z.uuid() }))
		.handler(({ context, input }) =>
			getServiceOrder(context.db, input.serviceOrderId)
		),

	list: readyProcedure
		.input(serviceOrderListInput)
		.handler(({ context, input }) => listServiceOrders(context.db, input)),
};
