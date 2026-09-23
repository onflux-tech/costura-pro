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
import { toast } from "sonner";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import {
	type ProductFields,
	type ProductView,
	productFormValues,
	productPatch,
	productPhotoLimit,
} from "@/lib/products";
import { useOpId } from "@/lib/use-op-id";
import { type PhotoDrafts, usePhotoDrafts } from "@/photos/use-photo-drafts";
import { pricingSettingsQuery } from "@/pricing/pricing-queries";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { ProductForm } from "./product-form";
import {
	failedProductCommand,
	productCategoriesQuery,
	productQuery,
	refreshProducts,
} from "./product-queries";

function ProductEditor({
	atelierTarget,
	categories,
	onReloadCurrent,
	photos,
	product,
}: {
	atelierTarget: number | undefined;
	categories: readonly string[];
	onReloadCurrent: () => Promise<void>;
	photos: PhotoDrafts;
	product: ProductView;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [archiving, setArchiving] = useState(false);
	const [dirty, setDirty] = useState(false);

	const openProduct = () =>
		navigate({
			params: { produtoId: product.id },
			to: "/catalogo-produtos/produtos/$produtoId",
		});

	const reloadCurrent = async () => {
		setFailure(null);
		await onReloadCurrent();
	};

	const submit = async (fields: ProductFields) => {
		setFailure(null);
		const patch = productPatch(product, fields);
		if (!patch) {
			await openProduct();
			return;
		}
		try {
			await api.products.update({
				baseVersion: product.version,
				opId: opIdFor(
					`${product.id}:${product.version}:${JSON.stringify(patch)}`
				),
				patch,
				productId: product.id,
			});
		} catch (error) {
			setFailure(await failedProductCommand(queryClient, error));
			return;
		}
		reset();
		await refreshProducts(queryClient);
		toast.success("Produto salvo");
		await openProduct();
	};

	const toggleArchive = async () => {
		setArchiving(true);
		setFailure(null);
		const command = product.archivedAt
			? api.products.unarchive
			: api.products.archive;
		try {
			await command({
				baseVersion: product.version,
				opId: crypto.randomUUID(),
				productId: product.id,
			});
		} catch (error) {
			setFailure(await failedProductCommand(queryClient, error));
			return;
		} finally {
			setArchiving(false);
		}
		await refreshProducts(queryClient);
		await reloadCurrent();
	};
	const archiveLabel = product.archivedAt ? "Desarquivar" : "Arquivar";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<Heading className="max-md:sr-only">{product.name}</Heading>
					<div className="flex flex-wrap items-center gap-2">
						<Text size="sm" tone="muted">
							{`Versão ${product.version}`}
						</Text>
						{product.archivedAt ? (
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
			<ProductForm
				atelierTarget={atelierTarget}
				categories={categories}
				failure={failure}
				initialPhotos={product.photos}
				initialValues={productFormValues(product)}
				onDirtyChange={setDirty}
				onReloadCurrent={reloadCurrent}
				onSubmit={submit}
				photos={photos}
				submitLabel="Salvar produto"
			/>
		</div>
	);
}

export function EditProductPage({ productId }: { productId: string }) {
	const product = useQuery(productQuery(productId));
	const settings = useQuery(pricingSettingsQuery());
	const categories = useQuery(productCategoriesQuery());
	const photos = usePhotoDrafts([], productPhotoLimit);
	const [opened, setOpened] = useState<ProductView | null>(null);
	const live = product.data?.product;
	useEffect(() => {
		if (!opened && live) {
			setOpened(live);
			photos.reset(live.photos);
		}
	}, [opened, live, photos.reset]);
	const current = opened ?? live;
	usePageHeader({
		backHref: `/catalogo-produtos/produtos/${productId}`,
		eyebrow: "Catálogo",
		heading: current?.name ?? "Produto",
	});

	if (!current && product.isPending) {
		return <Skeleton className="h-96 md:max-w-2xl" />;
	}
	if (!current) {
		const message = product.isError
			? clientCommandFailure(product.error, "produto").message
			: commandMessages.productNotFound;
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para abrir este produto</AlertTitle>
				<AlertDescription>{message}</AlertDescription>
				<AlertActions>
					<ButtonLink
						render={<Link to="/catalogo-produtos/produtos" />}
						variant="outline"
					>
						Voltar para produtos
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}

	if (!opened) {
		return <Skeleton className="h-96 md:max-w-2xl" />;
	}

	const reloadCurrent = async () => {
		const fresh = await product.refetch();
		if (fresh.data) {
			setOpened(fresh.data.product);
			photos.reset(fresh.data.product.photos);
		}
	};

	return (
		<ProductEditor
			atelierTarget={settings.data?.targetMarginBasisPoints}
			categories={categories.data?.categories ?? []}
			key={opened.version}
			onReloadCurrent={reloadCurrent}
			photos={photos}
			product={opened}
		/>
	);
}
