import { baseUnitByCode } from "@costura-pro/domain/unit";
import { Heading } from "@costura-pro/ui/components/typography";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { emptyVariantValues, type VariantFields } from "@/lib/materials";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { failedMaterialCommand, refreshMaterials } from "./material-queries";
import { useVariantPhoto } from "./use-variant-photo";
import { VariantForm } from "./variant-form";

const firstUnit = "m";

export function NewVariantPage({ materialId }: { materialId: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [variantId, setVariantId] = useState(() => crypto.randomUUID());
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [initialValues] = useState(() =>
		emptyVariantValues(
			firstUnit,
			baseUnitByCode(firstUnit)?.defaultPrecision ?? 2
		)
	);
	const photo = useVariantPhoto(null);
	usePageHeader({
		backHref: "/catalogo-produtos/materiais",
		eyebrow: "Catálogo",
		heading: "Nova variante",
	});

	const openMaterial = () =>
		navigate({
			params: { materialId },
			to: "/catalogo-produtos/materiais/$materialId",
		});

	const submit = async (fields: VariantFields) => {
		setFailure(null);
		const payload = { ...fields, materialId, variantId };
		try {
			await api.materialVariants.create({
				...payload,
				opId: opIdFor(JSON.stringify(payload)),
			});
		} catch (error) {
			const failed = await failedMaterialCommand(
				queryClient,
				error,
				"variante"
			);
			if (failed.kind === "exists") {
				toast.info("Esta variante já tinha sido salva.");
				await openMaterial();
				return;
			}
			setFailure(failed);
			return;
		}
		reset();
		setVariantId(crypto.randomUUID());
		await refreshMaterials(queryClient);
		await openMaterial();
	};

	return (
		<>
			<Heading className="max-md:sr-only">Nova variante</Heading>
			<VariantForm
				editingUnit
				failure={failure}
				initialValues={initialValues}
				onSubmit={submit}
				photo={photo}
				submitLabel="Salvar variante"
			/>
		</>
	);
}
