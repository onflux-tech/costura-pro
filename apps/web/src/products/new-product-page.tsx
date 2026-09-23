import { Heading } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import {
	emptyProductValues,
	type ProductFields,
	productPhotoLimit,
} from "@/lib/products";
import { useOpId } from "@/lib/use-op-id";
import { usePhotoDrafts } from "@/photos/use-photo-drafts";
import { pricingSettingsQuery } from "@/pricing/pricing-queries";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { ProductForm } from "./product-form";
import {
	failedProductCommand,
	productCategoriesQuery,
	refreshProducts,
} from "./product-queries";

const noPhotos: never[] = [];

export function NewProductPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [productId] = useState(() => crypto.randomUUID());
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const categories = useQuery(productCategoriesQuery());
	const settings = useQuery(pricingSettingsQuery());
	const photos = usePhotoDrafts(noPhotos, productPhotoLimit);
	usePageHeader({
		backHref: "/catalogo-produtos/produtos",
		eyebrow: "Catálogo",
		heading: "Novo produto",
	});

	const openProduct = () =>
		navigate({
			params: { produtoId: productId },
			to: "/catalogo-produtos/produtos/$produtoId",
		});

	const submit = async (fields: ProductFields) => {
		setFailure(null);
		try {
			await api.products.create({
				...fields,
				opId: opIdFor(`${productId}:${JSON.stringify(fields)}`),
				productId,
			});
		} catch (error) {
			const failed = await failedProductCommand(queryClient, error);
			if (failed.kind === "exists") {
				toast.info("Este produto já tinha sido salvo. Confira os dados.");
				await openProduct();
				return;
			}
			setFailure(failed);
			return;
		}
		reset();
		await refreshProducts(queryClient);
		toast.success("Produto salvo");
		await openProduct();
	};

	return (
		<>
			<Heading className="max-md:sr-only">Novo produto</Heading>
			<ProductForm
				atelierTarget={settings.data?.targetMarginBasisPoints}
				categories={categories.data?.categories ?? []}
				failure={failure}
				initialPhotos={noPhotos}
				initialValues={emptyProductValues}
				onSubmit={submit}
				photos={photos}
				submitLabel="Salvar produto"
			/>
		</>
	);
}
