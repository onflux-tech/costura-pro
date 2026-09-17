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
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import {
	failedMaterialCommand,
	materialQuery,
	refreshMaterials,
} from "./material-queries";
import { VariantPanel } from "./variant-panel";

export function MaterialDetailPage({ materialId }: { materialId: string }) {
	const queryClient = useQueryClient();
	const material = useQuery(materialQuery(materialId));
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [archiving, setArchiving] = useState(false);
	const current = material.data?.material;
	usePageHeader({
		backHref: "/catalogo-produtos/materiais",
		eyebrow: "Catálogo",
		heading: current?.name ?? "Material",
	});

	if (!current && material.isPending) {
		return <Skeleton className="h-96" />;
	}
	if (!current) {
		const message = material.isError
			? clientCommandFailure(material.error, "material").message
			: commandMessages.materialNotFound;
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para abrir este material</AlertTitle>
				<AlertDescription>{message}</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={<Link to="/catalogo-produtos/materiais" />}
						variant="outline"
					>
						Voltar para materiais
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}

	const toggleArchive = async () => {
		setArchiving(true);
		setFailure(null);
		const command = current.archivedAt
			? api.materials.unarchive
			: api.materials.archive;
		try {
			await command({
				baseVersion: current.version,
				materialId,
				opId: crypto.randomUUID(),
			});
		} catch (error) {
			setFailure(await failedMaterialCommand(queryClient, error));
			return;
		} finally {
			setArchiving(false);
		}
		await refreshMaterials(queryClient);
	};
	const archiveLabel = current.archivedAt ? "Desarquivar" : "Arquivar";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<Heading className="max-md:sr-only">{current.name}</Heading>
					<div className="flex flex-wrap items-center gap-2">
						<Text size="xs" tone="muted">
							{current.category ?? "Sem categoria"}
						</Text>
						{current.archivedAt ? (
							<Badge tone="warning">arquivado</Badge>
						) : null}
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<ButtonLink
						render={
							<Link
								params={{ materialId }}
								to="/catalogo-produtos/materiais/$materialId/editar"
							/>
						}
						variant="outline"
					>
						Editar
					</ButtonLink>
					<Button
						disabled={archiving}
						onClick={toggleArchive}
						variant="outline"
					>
						{archiveLabel}
					</Button>
				</div>
			</div>
			{failure ? (
				<Alert tone={failure.kind === "stale" ? "warning" : "danger"}>
					<AlertTitle>Não foi possível salvar</AlertTitle>
					<AlertDescription>{failure.message}</AlertDescription>
				</Alert>
			) : null}
			{current.notes ? (
				<Panel>
					<PanelHeader>
						<PanelTitle>Notas</PanelTitle>
					</PanelHeader>
					<PanelContent>
						<Text>{current.notes}</Text>
					</PanelContent>
				</Panel>
			) : null}
			<VariantPanel
				materialId={materialId}
				variants={material.data?.variants ?? []}
			/>
		</div>
	);
}
