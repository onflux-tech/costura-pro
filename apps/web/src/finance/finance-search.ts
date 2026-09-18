import z from "zod";

export const accountListSearch = z.object({
	arquivadas: z.literal(1).optional().catch(undefined),
});

export const obligationListSearch = z.object({
	estado: z.enum(["pagas", "canceladas"]).optional().catch(undefined),
});
