import { Heading } from "@costura-pro/ui/components/typography";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import {
	failedTemplateCommand,
	refreshTemplates,
} from "@/lib/measurement-queries";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { TemplateEditor, type TemplateEditorValues } from "./template-editor";

export function NewTemplatePage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [templateId, setTemplateId] = useState(() => crypto.randomUUID());
	const [initialFields] = useState(() => [
		{ active: true, id: crypto.randomUUID(), label: "" },
	]);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	usePageHeader({
		backHref: "/catalogo-produtos/modelos-de-medidas",
		eyebrow: "Catálogo",
		heading: "Novo modelo",
	});

	const submit = async (values: TemplateEditorValues) => {
		setFailure(null);
		try {
			await api.measurementTemplates.create({
				...values,
				opId: opIdFor(JSON.stringify(values)),
				templateId,
			});
		} catch (error) {
			const failed = await failedTemplateCommand(queryClient, error);
			if (failed.kind === "exists") {
				toast.info("Este modelo já tinha sido salvo. Confira os campos.");
				await navigate({
					params: { modeloId: templateId },
					to: "/catalogo-produtos/modelos-de-medidas/$modeloId",
				});
				return;
			}
			setFailure(failed);
			return;
		}
		reset();
		setTemplateId(crypto.randomUUID());
		await refreshTemplates(queryClient);
		await navigate({ to: "/catalogo-produtos/modelos-de-medidas" });
	};

	return (
		<>
			<Heading className="max-md:sr-only">Novo modelo de medidas</Heading>
			<TemplateEditor
				failure={failure}
				initialFields={initialFields}
				initialName=""
				onSubmit={submit}
				submitLabel="Salvar modelo"
			/>
		</>
	);
}
