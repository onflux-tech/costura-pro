import { Button } from "@costura-pro/ui/components/button";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@costura-pro/ui/components/dialog";
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Select } from "@costura-pro/ui/components/select";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import type { ProductDetailView } from "@/lib/products";
import { copyFromProduct, type SheetCopy } from "@/lib/quote-drafts";
import { productQuery } from "@/products/product-queries";

import { productOptionsQuery } from "./quote-queries";

const baseSheet = "-";

function skippedText(skipped: number): string {
	return skipped === 1
		? "1 item da ficha não foi copiado porque o cadastro não foi encontrado."
		: `${skipped} itens da ficha não foram copiados porque o cadastro não foi encontrado.`;
}

function ProductChoices({ onPick }: { onPick: (productId: string) => void }) {
	const [query, setQuery] = useState("");
	const [search, setSearch] = useState("");
	useEffect(() => {
		const timer = setTimeout(() => setSearch(query.trim()), 300);
		return () => clearTimeout(timer);
	}, [query]);
	const options = useQuery(productOptionsQuery(search));
	const items = options.data?.items ?? [];
	return (
		<div className="flex flex-col gap-3">
			<Field>
				<FieldLabel>Buscar produto</FieldLabel>
				<Input
					maxLength={100}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Produto, variante ou código"
					type="search"
					value={query}
				/>
			</Field>
			{options.isPending ? <Skeleton className="h-10" /> : null}
			{options.isError ? (
				<Text tone="danger">
					{clientCommandFailure(options.error, "produto").message}
				</Text>
			) : null}
			{options.isSuccess && items.length === 0 ? (
				<Text tone="subtle">
					Nenhum produto encontrado. Cadastre o produto em Catálogo.
				</Text>
			) : null}
			<div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
				{items.map((product) => (
					<Button
						className="h-auto min-h-11 flex-col items-start justify-center gap-0.5 whitespace-normal py-2 text-left"
						key={product.id}
						onClick={() => onPick(product.id)}
						type="button"
						variant="ghost"
					>
						<Text inline weight="semibold">
							{product.name}
						</Text>
						<Text inline size="xs" tone="subtle">
							{[
								product.category,
								product.variantCount === 1
									? "1 variante"
									: `${product.variantCount} variantes`,
							]
								.filter(Boolean)
								.join(" · ")}
						</Text>
					</Button>
				))}
			</div>
		</div>
	);
}

function SheetChoice({
	detail,
	onBack,
	onCopy,
}: {
	detail: ProductDetailView;
	onBack: () => void;
	onCopy: (copy: SheetCopy) => void;
}) {
	const [choice, setChoice] = useState(baseSheet);
	const variantId = choice === baseSheet ? null : choice;
	const preview = copyFromProduct(detail, variantId, () => "");
	const items = [
		{ label: "Base do produto", value: baseSheet },
		...detail.variants
			.filter((variant) => variant.archivedAt === null)
			.map((variant) => ({ label: variant.name, value: variant.id })),
	];
	return (
		<div className="flex flex-col gap-3">
			<Text weight="semibold">{detail.product.name}</Text>
			<Field>
				<FieldLabel>Ficha</FieldLabel>
				<Select items={items} onValueChange={setChoice} value={choice} />
			</Field>
			<Text size="xs" tone="subtle">
				{preview.components.length === 1
					? "1 componente vai ser copiado."
					: `${preview.components.length} componentes vão ser copiados.`}
			</Text>
			{preview.skipped > 0 ? (
				<Text size="xs" tone="warning">
					{skippedText(preview.skipped)}
				</Text>
			) : null}
			<DialogActions>
				<Button onClick={onBack} type="button" variant="outline">
					Trocar produto
				</Button>
				<Button
					onClick={() =>
						onCopy(
							copyFromProduct(detail, variantId, () => crypto.randomUUID())
						)
					}
					type="button"
				>
					Copiar ficha
				</Button>
			</DialogActions>
		</div>
	);
}

function SourceStep({ onCopy }: { onCopy: (copy: SheetCopy) => void }) {
	const [productId, setProductId] = useState<string | null>(null);
	const detail = useQuery({
		...productQuery(productId ?? ""),
		enabled: productId !== null,
	});
	if (productId === null) {
		return <ProductChoices onPick={setProductId} />;
	}
	if (detail.isPending) {
		return <Skeleton className="h-24" />;
	}
	if (!detail.data) {
		return (
			<div className="flex flex-col gap-3">
				<Text tone="danger">
					{clientCommandFailure(detail.error, "produto").message}
				</Text>
				<Button
					className="self-start"
					onClick={() => setProductId(null)}
					variant="outline"
				>
					Trocar produto
				</Button>
			</div>
		);
	}
	return (
		<SheetChoice
			detail={detail.data}
			onBack={() => setProductId(null)}
			onCopy={onCopy}
		/>
	);
}

export function ProductSourceDialog({
	onCopy,
	onOpenChange,
	open,
}: {
	onCopy: (copy: SheetCopy) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<div className="flex flex-col gap-4">
					<DialogTitle>Partir da ficha de um produto</DialogTitle>
					<DialogDescription>
						Os materiais e serviços da ficha viram componentes da peça, com a
						quantidade planejada e o custo de referência de hoje. Dá para
						ajustar depois.
					</DialogDescription>
					{open ? <SourceStep onCopy={onCopy} /> : null}
					<DialogActions>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Cancelar
						</DialogClose>
					</DialogActions>
				</div>
			</DialogContent>
		</Dialog>
	);
}
