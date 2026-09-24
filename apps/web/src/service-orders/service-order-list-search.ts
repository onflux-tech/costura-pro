import z from "zod";

export const serviceOrderListSearch = z.object({
	busca: z.string().max(100).optional().catch(undefined),
});

export type ServiceOrderListSearch = z.output<typeof serviceOrderListSearch>;
