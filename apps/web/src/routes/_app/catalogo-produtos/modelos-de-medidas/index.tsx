import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import { TemplateListPage } from "@/measurement-templates/template-list-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/modelos-de-medidas/"
)({
	component: TemplateListPage,
	validateSearch: z.object({
		arquivados: z.literal(1).optional().catch(undefined),
	}),
});
