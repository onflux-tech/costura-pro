import z from "zod";

export const quoteListSearch = z.object({
	arquivados: z.literal(1).optional().catch(undefined),
	busca: z.string().max(100).optional().catch(undefined),
});

export type QuoteListSearch = z.output<typeof quoteListSearch>;
