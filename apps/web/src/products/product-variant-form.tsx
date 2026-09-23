import { formatMoneyInput, parseMoney } from "@costura-pro/domain/money";
import { productLimits } from "@costura-pro/domain/product";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import {
	Field,
	FieldError,
	FieldHint,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { NumberField } from "@costura-pro/ui/components/number-field";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Photo } from "@costura-pro/ui/components/photo";
import { Stat } from "@costura-pro/ui/components/stat";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import {
	type ChangeEvent,
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { moneyLabel } from "@/lib/finance";
import { photoUrl } from "@/lib/media";
import type { PhotoView } from "@/lib/photos";
import {
	coverOf,
	type ProductDetailView,
	type ProductVariantField,
	type ProductVariantFields,
	type ProductVariantFormValues,
	productVariantFieldOrder,
	productVariantFields,
	productVariantFormErrors,
	type SheetChangeView,
	variantPricing,
} from "@/lib/products";
import { PricingPanel } from "@/pricing/pricing-panel";

import { CoverDialog } from "./cover-dialog";
import { MissingCosts } from "./missing-costs";
import { productVariantsByCodeQuery } from "./product-queries";
import { SheetItemDialog } from "./sheet-item-dialog";
import { useVariantSheet } from "./use-variant-sheet";
import { VariantSheetSection } from "./variant-sheet-section";

type TextKey = "code" | "name" | "price";

type FieldErrors = Partial<Record<ProductVariantField, string>>;

const pendingCost = {
	empty: "Ficha vazia",
	incomplete: "Custo incompleto",
} as const;

function FormField({
	children,
	error,
	hint,
	label,
	name,
	requirement,
}: {
	children: ReactNode;
	error: string | undefined;
	hint?: string;
	label: string;
	name: ProductVariantField;
	requirement: "optional" | "required";
}) {
	return (
		<Field invalid={Boolean(error)} name={name}>
			<FieldLabel requirement={requirement}>{label}</FieldLabel>
			{children}
			{hint ? <FieldHint>{hint}</FieldHint> : null}
			{error ? <FieldError match>{error}</FieldError> : null}
		</Field>
	);
}

function SaveFailure({
	alertRef,
	failure,
	onReloadCurrent,
}: {
	alertRef: RefObject<HTMLDivElement | null>;
	failure: ClientCommandFailure;
	onReloadCurrent?: () => void;
}) {
	const stale = failure.kind === "stale";
	return (
		<Alert
			ref={alertRef}
			role="alert"
			tabIndex={-1}
			tone={stale ? "warning" : "danger"}
		>
			<AlertTitle>Não foi possível salvar</AlertTitle>
			<AlertDescription>{failure.message}</AlertDescription>
			{stale && onReloadCurrent ? (
				<AlertActions>
					<Button onClick={onReloadCurrent} variant="outline">
						Carregar versão atual
					</Button>
				</AlertActions>
			) : null}
		</Alert>
	);
}

function useRepeatedCode(code: string, variantId: string) {
	const [search, setSearch] = useState(code.trim());
	useEffect(() => {
		const timer = setTimeout(() => setSearch(code.trim()), 400);
		return () => clearTimeout(timer);
	}, [code]);
	const found = useQuery(productVariantsByCodeQuery(search));
	return (found.data?.items ?? []).filter((item) => item.id !== variantId);
}

function CoverField({
	coverPhotoHash,
	onOpen,
	photos,
}: {
	coverPhotoHash: string | null;
	onOpen: () => void;
	photos: readonly PhotoView[];
}) {
	const cover = coverOf(photos, coverPhotoHash);
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Capa</PanelTitle>
			</PanelHeader>
			<PanelContent className="flex flex-wrap items-center gap-3">
				{cover ? (
					<Photo
						alt="Capa desta variante"
						className="size-16 rounded-md"
						height={128}
						src={photoUrl(cover.thumbnailHash)}
						width={128}
					/>
				) : null}
				<Text tone="subtle">
					{cover
						? "Foto da galeria escolhida para esta variante."
						: "Usa a imagem principal do produto."}
				</Text>
				<Button onClick={onOpen} variant="outline">
					Escolher capa
				</Button>
			</PanelContent>
		</Panel>
	);
}

function sameValues(
	left: ProductVariantFormValues,
	right: ProductVariantFormValues
) {
	return (
		left.code === right.code &&
		left.coverPhotoHash === right.coverPhotoHash &&
		left.name === right.name &&
		left.price === right.price
	);
}

export function ProductVariantForm({
	atelierTarget,
	detail,
	failure,
	initialChanges,
	initialValues,
	onDirtyChange,
	onReloadCurrent,
	onSubmit,
	submitLabel,
	variantId,
}: {
	atelierTarget: number;
	detail: ProductDetailView;
	failure: ClientCommandFailure | null;
	initialChanges: readonly SheetChangeView[];
	initialValues: ProductVariantFormValues;
	onDirtyChange?: (dirty: boolean) => void;
	onReloadCurrent?: () => void;
	onSubmit: (fields: ProductVariantFields) => Promise<void>;
	submitLabel: string;
	variantId: string;
}) {
	const { product } = detail;
	const sheet = useVariantSheet(detail, initialChanges);
	const [values, setValues] = useState(initialValues);
	const [errors, setErrors] = useState<FieldErrors>({});
	const [submitting, setSubmitting] = useState(false);
	const [coverOpen, setCoverOpen] = useState(false);
	const alertRef = useRef<HTMLDivElement>(null);
	const targets = useRef(new Map<ProductVariantField, HTMLElement>());
	const repeated = useRepeatedCode(values.code, variantId);
	const dirty =
		!sameValues(values, initialValues) ||
		JSON.stringify(sheet.changes) !== JSON.stringify(initialChanges);

	useEffect(() => {
		onDirtyChange?.(dirty);
	}, [dirty, onDirtyChange]);

	useEffect(() => {
		if (failure) {
			alertRef.current?.focus();
		}
	}, [failure]);

	const set = (key: TextKey) => (next: string) =>
		setValues((current) => ({ ...current, [key]: next }));

	const inputProps = (key: TextKey) => ({
		"aria-invalid": errors[key] ? true : undefined,
		onChange: (event: ChangeEvent<HTMLInputElement>) =>
			set(key)(event.target.value),
		ref: (element: HTMLElement | null) => {
			if (element) {
				targets.current.set(key, element);
			} else {
				targets.current.delete(key);
			}
		},
		value: values[key],
	});

	const price = parseMoney(values.price);
	const preview = variantPricing(
		product,
		sheet.estimate,
		price === null ? null : price.toString(),
		atelierTarget
	);
	const suggestedInput = preview
		? formatMoneyInput(preview.suggestedCents)
		: null;
	const costValue =
		sheet.estimate.status === "complete"
			? moneyLabel(sheet.estimate.totalCents)
			: pendingCost[sheet.estimate.status];
	const pricingHint =
		sheet.estimate.status === "empty"
			? "Monte a ficha para ver o preço sugerido."
			: "Complete o custo dos materiais para ver o preço sugerido.";

	const submit = async () => {
		const found = productVariantFormErrors(values);
		setErrors(found);
		const first = productVariantFieldOrder.find((field) => found[field]);
		if (first) {
			targets.current.get(first)?.focus();
			return;
		}
		setSubmitting(true);
		try {
			await onSubmit(
				productVariantFields(values, sheet.changes, product.sheet)
			);
		} finally {
			setSubmitting(false);
		}
	};

	const label = submitting ? "Salvando..." : submitLabel;
	const repeatedText = repeated
		.map((item) => `${item.productName} · ${item.name}`)
		.join(", ");

	return (
		<>
			<form
				className="flex flex-col gap-4 md:max-w-3xl"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					submit();
				}}
			>
				<Panel>
					<PanelContent className="flex flex-col gap-4">
						<FormField
							error={errors.name}
							hint="Como P, M, G, Azul ou P Azul."
							label="Nome"
							name="name"
							requirement="required"
						>
							<Input
								maxLength={productLimits.variantName.max}
								{...inputProps("name")}
							/>
						</FormField>
						<FormField
							error={errors.code}
							label="Código"
							name="code"
							requirement="optional"
						>
							<Input maxLength={productLimits.code} {...inputProps("code")} />
						</FormField>
						{repeatedText ? (
							<Text role="status" size="sm" tone="warning">
								{`Este código já está em: ${repeatedText}.`}
							</Text>
						) : null}
					</PanelContent>
				</Panel>
				<CoverField
					coverPhotoHash={values.coverPhotoHash}
					onOpen={() => setCoverOpen(true)}
					photos={product.photos}
				/>
				<Panel>
					<PanelHeader>
						<PanelTitle>Custo e preço</PanelTitle>
					</PanelHeader>
					<PanelContent className="flex flex-col gap-4">
						<Stat
							hint="Pela ficha desta variante. Só você vê."
							label="Custo estimado"
							value={costValue}
						/>
						<FormField
							error={errors.price}
							hint="O preço cobrado. A sugestão nunca muda este valor sozinha."
							label="Preço praticado"
							name="price"
							requirement="required"
						>
							<NumberField
								maxLength={20}
								placeholder="170,00"
								suffix="R$"
								{...inputProps("price")}
							/>
						</FormField>
					</PanelContent>
				</Panel>
				<MissingCosts
					lines={sheet.estimate.missing}
					references={sheet.references}
				/>
				<PricingPanel
					hint={pricingHint}
					onUseSuggestion={() => {
						if (suggestedInput) {
							set("price")(suggestedInput);
						}
					}}
					preview={preview}
					suggestionApplied={suggestedInput === values.price.trim()}
				/>
				<VariantSheetSection
					base={product.sheet}
					changes={sheet.changes}
					estimate={sheet.estimate}
					full={sheet.full}
					onAction={sheet.onAction}
					references={sheet.references}
				/>
				{failure ? (
					<SaveFailure
						alertRef={alertRef}
						failure={failure}
						onReloadCurrent={onReloadCurrent}
					/>
				) : null}
				<Button
					className="md:w-auto md:self-start"
					disabled={submitting}
					size="touch"
					type="submit"
				>
					{label}
				</Button>
			</form>
			<CoverDialog
				coverPhotoHash={values.coverPhotoHash}
				onChoose={(coverPhotoHash) =>
					setValues((current) => ({ ...current, coverPhotoHash }))
				}
				onOpenChange={setCoverOpen}
				open={coverOpen}
				photos={product.photos}
				productId={product.id}
			/>
			<SheetItemDialog
				mode={sheet.dialogMode}
				onOpenChange={(open) => {
					if (!open) {
						sheet.closeDialog();
					}
				}}
				onSave={sheet.saveItem}
			/>
		</>
	);
}
