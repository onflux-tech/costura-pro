import z from "zod";

export const balanceListSearch = z.object({
	busca: z.string().max(100).optional().catch(undefined),
	local: z.uuid().optional().catch(undefined),
});

export const locationListSearch = z.object({
	arquivados: z.literal(1).optional().catch(undefined),
});
