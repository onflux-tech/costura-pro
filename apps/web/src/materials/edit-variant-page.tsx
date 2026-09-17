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
import { Heading } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import {
	changedVariant,
	type VariantFields,
	type VariantView,
	variantFormValues,
} from "@/lib/materials";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import {
	failedMaterialCommand,
	materialQuery,
	refreshMaterials,
} from "./material-queries";
import { useVariantPhoto } from "./use-variant-photo";
import { VariantForm } from "./variant-form";

export function EditVariantPage({
	materialId,
	variantId,
}: {
	materialId: string;
	variantId: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const material = useQuery(materialQuery(materialId));
	const [opened, setOpened] = useState<VariantView | null>(null);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [archiving, setArchiving] = useState(false);
	const live = material.data?.variants.find((item) => item.id === variantId);
	useEffect(() => {
		if (!opened && live) {
			setOpened(live);
		}
	}, [opened, live]);
	const current = opened ?? live;
	const photo = useVariantPhoto(current?.photo ?? null);
	usePageHeader({
		backHref: "/catalogo-produtos/materiais",
		eyebrow: "Catálogo",
		heading: current?.name ?? "Variante",
	});

	if (!current && material.isPending) {
		return <Skeleton className="h-96" />;
	}
	if (!current) {
		const message = material.isError
			? clientCommandFailure(material.error, "variante").message
			: commandMessages.materialVariantNotFound;
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para abrir esta variante</AlertTitle>
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

	const openMaterial = () =>
		navigate({
			params: { materialId },
			to: "/catalogo-produtos/materiais/$materialId",
		});

	const reloadCurrent = async () => {
		setFailure(null);
		const fresh = await material.refetch();
		const found = fresh.data?.variants.find((item) => item.id === variantId);
		if (found) {
			setOpened(found);
		}
	};

	const submit = async (fields: VariantFields) => {
		setFailure(null);
		const patch = changedVariant(current, fields);
		if (!patch) {
			await openMaterial();
			return;
		}
		try {
			await api.materialVariants.update({
				baseVersion: current.version,
				opId: opIdFor(`${current.version}:${JSON.stringify(patch)}`),
				patch,
				variantId,
			});
		} catch (error) {
			setFailure(await failedMaterialCommand(queryClient, error, "variante"));
			return;
		}
		reset();
		await refreshMaterials(queryClient);
		await openMaterial();
	};

	const toggleArchive = async () => {
		setArchiving(true);
		setFailure(null);
		const command = current.archivedAt
			? api.materialVariants.unarchive
			: api.materialVariants.archive;
		try {
			await command({
				baseVersion: current.version,
				opId: crypto.randomUUID(),
				variantId,
			});
		} catch (error) {
			setFailure(await failedMaterialCommand(queryClient, error, "variante"));
			return;
		} finally {
			setArchiving(false);
		}
		await refreshMaterials(queryClient);
		await reloadCurrent();
	};
	const archiveLabel = current.archivedAt ? "Desarquivar" : "Arquivar";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<Heading className="max-md:sr-only">{current.name}</Heading>
					{current.archivedAt ? <Badge tone="warning">arquivada</Badge> : null}
				</div>
				<Button disabled={archiving} onClick={toggleArchive} variant="outline">
					{archiveLabel}
				</Button>
			</div>
			<VariantForm
				editingUnit={false}
				failure={failure}
				initialValues={variantFormValues(current)}
				key={current.version}
				onReloadCurrent={reloadCurrent}
				onSubmit={submit}
				photo={photo}
				submitLabel="Salvar variante"
			/>
		</div>
	);
}
