import z from "zod";

export const boardSearch = z.object({
	etapa: z.string().max(100).optional().catch(undefined),
});

export type BoardSearch = z.output<typeof boardSearch>;
