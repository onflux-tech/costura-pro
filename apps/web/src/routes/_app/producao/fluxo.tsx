import { createFileRoute } from "@tanstack/react-router";

import { FlowEditorPage } from "@/production/flow-editor-page";

export const Route = createFileRoute("/_app/producao/fluxo")({
	component: FlowEditorPage,
});
