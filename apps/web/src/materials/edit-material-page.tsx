import { commandMessages } from "@costura-pro/api/command-messages";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
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
	changedMaterial,
	type MaterialFields,
	type MaterialView,
	materialFormValues,
} from "@/lib/materials";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { MaterialForm } from "./material-form";
import {
	failedMaterialCommand,
	materialCategoriesQuery,
	materialQuery,
	refreshMaterials,
} from "./material-queries";

export function EditMaterialPage({ materialId }: { materialId: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const material = useQuery(materialQuery(materialId));
	const categories = useQuery(materialCategoriesQuery());
	const [opened, setOpened] = useState<MaterialView | null>(null);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const live = material.data?.material;
	useEffect(() => {
		if (!opened && live) {
			setOpened(live);
		}
	}, [opened, live]);
	const current = opened ?? live;
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

	const openDetail = () =>
		navigate({
			params: { materialId },
			to: "/catalogo-produtos/materiais/$materialId",
		});

	const reloadCurrent = async () => {
		setFailure(null);
		const fresh = await material.refetch();
		if (fresh.data) {
			setOpened(fresh.data.material);
		}
	};

	const submit = async (fields: MaterialFields) => {
		setFailure(null);
		const patch = changedMaterial(current, fields);
		if (!patch) {
			await openDetail();
			return;
		}
		try {
			await api.materials.update({
				baseVersion: current.version,
				materialId,
				opId: opIdFor(`${current.version}:${JSON.stringify(patch)}`),
				patch,
			});
		} catch (error) {
			setFailure(await failedMaterialCommand(queryClient, error));
			return;
		}
		reset();
		await refreshMaterials(queryClient);
		await openDetail();
	};

	return (
		<div className="flex flex-col gap-4">
			<Heading className="max-md:sr-only">{current.name}</Heading>
			<MaterialForm
				categories={categories.data?.categories ?? []}
				failure={failure}
				initialValues={materialFormValues(current)}
				key={current.version}
				onReloadCurrent={reloadCurrent}
				onSubmit={submit}
				submitLabel="Salvar material"
			/>
		</div>
	);
}
