import { commandMessages } from "@costura-pro/api/command-messages";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import {
	failedTemplateCommand,
	measurementTemplatesQuery,
	refreshTemplates,
} from "@/lib/measurement-queries";
import { changedTemplate, type TemplateView } from "@/lib/measurements";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { TemplateEditor, type TemplateEditorValues } from "./template-editor";

export function EditTemplatePage({ templateId }: { templateId: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const templates = useQuery(measurementTemplatesQuery());
	const [opened, setOpened] = useState<TemplateView | null>(null);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [archiving, setArchiving] = useState(false);
	const [dirty, setDirty] = useState(false);
	const live = templates.data?.items.find((item) => item.id === templateId);
	useEffect(() => {
		if (!opened && live) {
			setOpened(live);
		}
	}, [opened, live]);
	const template = opened ?? live;
	usePageHeader({
		backHref: "/catalogo-produtos/modelos-de-medidas",
		eyebrow: "Catálogo",
		heading: template?.name ?? "Modelo de medidas",
	});

	if (!template && templates.isPending) {
		return <Skeleton className="h-96" />;
	}
	if (!template) {
		const message = templates.isError
			? clientCommandFailure(templates.error, "modelo").message
			: commandMessages.measurementTemplateNotFound;
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para abrir este modelo</AlertTitle>
				<AlertDescription>{message}</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={<Link to="/catalogo-produtos/modelos-de-medidas" />}
						variant="outline"
					>
						Voltar para modelos
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}

	const reloadCurrent = async () => {
		setFailure(null);
		const current = await templates.refetch();
		const fresh = current.data?.items.find((item) => item.id === templateId);
		if (fresh) {
			setOpened(fresh);
		}
	};
	const openList = () =>
		navigate({ to: "/catalogo-produtos/modelos-de-medidas" });

	const submit = async (values: TemplateEditorValues) => {
		setFailure(null);
		const patch = changedTemplate(template, values);
		if (Object.keys(patch).length === 0) {
			await openList();
			return;
		}
		try {
			await api.measurementTemplates.update({
				baseVersion: template.version,
				opId: opIdFor(`${template.version}:${JSON.stringify(patch)}`),
				patch,
				templateId,
			});
		} catch (error) {
			setFailure(await failedTemplateCommand(queryClient, error));
			return;
		}
		reset();
		await refreshTemplates(queryClient);
		await openList();
	};

	const toggleArchive = async () => {
		setArchiving(true);
		setFailure(null);
		const command = template.archivedAt
			? api.measurementTemplates.unarchive
			: api.measurementTemplates.archive;
		try {
			await command({
				baseVersion: template.version,
				opId: crypto.randomUUID(),
				templateId,
			});
		} catch (error) {
			setFailure(await failedTemplateCommand(queryClient, error));
			return;
		} finally {
			setArchiving(false);
		}
		await refreshTemplates(queryClient);
		await reloadCurrent();
	};
	const archiveLabel = template.archivedAt ? "Desarquivar" : "Arquivar";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<Heading className="max-md:sr-only">{template.name}</Heading>
					<div className="flex flex-wrap items-center gap-2">
						<Text size="xs" tone="muted">{`Versão ${template.version}`}</Text>
						{template.archivedAt ? (
							<Badge tone="warning">arquivado</Badge>
						) : null}
					</div>
				</div>
				<div className="flex flex-col items-end gap-1">
					<Button
						disabled={archiving || dirty}
						onClick={toggleArchive}
						variant="outline"
					>
						{archiveLabel}
					</Button>
					{dirty ? (
						<Text size="xs" tone="muted">
							Salve as mudanças antes de arquivar
						</Text>
					) : null}
				</div>
			</div>
			<TemplateEditor
				failure={failure}
				initialFields={template.fields}
				initialName={template.name}
				key={template.version}
				onChangedChange={setDirty}
				onReloadCurrent={reloadCurrent}
				onSubmit={submit}
				submitLabel="Salvar modelo"
			/>
		</div>
	);
}
