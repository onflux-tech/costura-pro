import { readyProcedure } from "../index";
import {
	globalSearch,
	globalSearchInput,
	groupSearch,
	groupSearchInput,
} from "./queries";

export const searchRouter = {
	global: readyProcedure
		.input(globalSearchInput)
		.handler(({ context, input }) => globalSearch(context.db, input)),
	group: readyProcedure
		.input(groupSearchInput)
		.handler(({ context, input }) => groupSearch(context.db, input)),
};
