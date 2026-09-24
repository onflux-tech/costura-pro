import { searchLimits } from "@costura-pro/domain/search";
import z from "zod";

import { groupParamValues } from "@/lib/search";

export const globalSearchParams = z.object({
	arquivados: z.literal(1).optional().catch(undefined),
	busca: z.string().max(searchLimits.query.max).optional().catch(undefined),
	grupo: z.enum(groupParamValues).optional().catch(undefined),
});
