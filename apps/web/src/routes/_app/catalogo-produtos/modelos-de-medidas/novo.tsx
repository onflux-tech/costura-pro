import { createFileRoute } from "@tanstack/react-router";

import { NewTemplatePage } from "@/measurement-templates/new-template-page";

export const Route = createFileRoute(
	"/_app/catalogo-produtos/modelos-de-medidas/novo"
)({ component: NewTemplatePage });
