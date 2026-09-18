import z from "zod";

import { optionalUuidSearch } from "@/lib/route-search";

export const purchaseListSearch = z.object({
	fornecedor: optionalUuidSearch,
});

export const supplierListSearch = z.object({
	arquivados: z.literal(1).optional().catch(undefined),
	busca: z.string().max(100).optional().catch(undefined),
});
