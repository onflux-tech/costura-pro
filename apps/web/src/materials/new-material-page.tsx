import { Heading } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import type { MaterialFields } from "@/lib/materials";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { MaterialForm } from "./material-form";
import {
	failedMaterialCommand,
	materialCategoriesQuery,
	refreshMaterials,
} from "./material-queries";

export function NewMaterialPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [materialId, setMaterialId] = useState(() => crypto.randomUUID());
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const categories = useQuery(materialCategoriesQuery());
	usePageHeader({
		backHref: "/catalogo-produtos/materiais",
		eyebrow: "Catálogo",
		heading: "Novo material",
	});

	const submit = async (fields: MaterialFields) => {
		setFailure(null);
		try {
			await api.materials.create({
				...fields,
				materialId,
				opId: opIdFor(JSON.stringify(fields)),
			});
		} catch (error) {
			const failed = await failedMaterialCommand(queryClient, error);
			if (failed.kind === "exists") {
				toast.info("Este material já tinha sido salvo. Confira as variantes.");
				await navigate({
					params: { materialId },
					to: "/catalogo-produtos/materiais/$materialId",
				});
				return;
			}
			setFailure(failed);
			return;
		}
		reset();
		const created = materialId;
		setMaterialId(crypto.randomUUID());
		await refreshMaterials(queryClient);
		await navigate({
			params: { materialId: created },
			to: "/catalogo-produtos/materiais/$materialId",
		});
	};

	return (
		<>
			<Heading className="max-md:sr-only">Novo material</Heading>
			<MaterialForm
				categories={categories.data?.categories ?? []}
				failure={failure}
				initialValues={{ category: "", name: "", notes: "" }}
				onSubmit={submit}
				submitLabel="Salvar material"
			/>
		</>
	);
}
