import z from "zod";

export const materialListSearch = z.object({
	arquivados: z.literal(1).optional().catch(undefined),
	busca: z.string().max(100).optional().catch(undefined),
	categoria: z.string().max(40).optional().catch(undefined),
	semCategoria: z.literal(1).optional().catch(undefined),
});
