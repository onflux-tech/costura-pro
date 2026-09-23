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
import { toast } from "sonner";

import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import {
	emptyProductVariantValues,
	type ProductDetailView,
	type ProductVariantFields,
} from "@/lib/products";
import { useOpId } from "@/lib/use-op-id";
import { pricingSettingsQuery } from "@/pricing/pricing-queries";
import { SettingsPending } from "@/pricing/settings-failure";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import {
	failedProductCommand,
	productQuery,
	refreshProducts,
} from "./product-queries";
import { ProductVariantForm } from "./product-variant-form";

const noChanges: never[] = [];

export function NewProductVariantPage({ productId }: { productId: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const [variantId] = useState(() => crypto.randomUUID());
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const detail = useQuery(productQuery(productId));
	const settings = useQuery(pricingSettingsQuery());
	const [opened, setOpened] = useState<ProductDetailView | null>(null);
	useEffect(() => {
		if (!opened && detail.data) {
			setOpened(detail.data);
		}
	}, [opened, detail.data]);
	usePageHeader({
		backHref: `/catalogo-produtos/produtos/${productId}`,
		eyebrow: opened?.product.name ?? "Produto",
		heading: "Nova variante",
	});

	if (!(opened || detail.data) && detail.isPending) {
		return <Skeleton className="h-96 md:max-w-3xl" />;
	}
	if (!(opened || detail.data)) {
		const message = detail.isError
			? clientCommandFailure(detail.error, "produto").message
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
	if (!(opened && settings.data)) {
		return (
			<SettingsPending
				error={settings.error}
				onRetry={() => settings.refetch()}
			/>
		);
	}

	const submit = async (fields: ProductVariantFields) => {
		setFailure(null);
		try {
			await api.productVariants.create({
				...fields,
				opId: opIdFor(`${variantId}:${JSON.stringify(fields)}`),
				productId,
				variantId,
			});
		} catch (error) {
			const failed = await failedProductCommand(queryClient, error, "variante");
			if (failed.kind === "exists") {
				toast.info("Esta variante já tinha sido salva. Confira os dados.");
				await navigate({
					params: { produtoId: productId, varianteId: variantId },
					to: "/catalogo-produtos/produtos/$produtoId/variantes/$varianteId",
				});
				return;
			}
			setFailure(failed);
			return;
		}
		reset();
		await refreshProducts(queryClient);
		toast.success("Variante salva");
		await navigate({
			params: { produtoId: productId },
			to: "/catalogo-produtos/produtos/$produtoId",
		});
	};

	return (
		<>
			<Heading className="max-md:sr-only">{`Nova variante de ${opened.product.name}`}</Heading>
			<ProductVariantForm
				atelierTarget={settings.data.targetMarginBasisPoints}
				detail={opened}
				failure={failure}
				initialChanges={noChanges}
				initialValues={emptyProductVariantValues}
				onSubmit={submit}
				submitLabel="Salvar variante"
				variantId={variantId}
			/>
		</>
	);
}
