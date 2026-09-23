import { formatMarginPercent } from "@costura-pro/domain/pricing";
import {
	productCategorySuggestions,
	productLimits,
} from "@costura-pro/domain/product";
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
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { SuggestionField } from "@costura-pro/ui/components/suggestion-field";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { Text } from "@costura-pro/ui/components/typography";
import {
	type ChangeEvent,
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import type { PhotoView } from "@/lib/photos";
import {
	type ProductField,
	type ProductFields,
	type ProductFormValues,
	productFieldOrder,
	productFields,
	productFormErrors,
} from "@/lib/products";
import { PhotoField } from "@/photos/photo-field";
import type { PhotoDrafts } from "@/photos/use-photo-drafts";

type TextKey = keyof ProductFormValues;

type FieldErrors = Partial<Record<ProductField, string>>;

const formKeys = [
	"category",
	"name",
	"notes",
	"targetMargin",
] as const satisfies readonly TextKey[];

function sameValues(left: ProductFormValues, right: ProductFormValues) {
	return formKeys.every((key) => left[key] === right[key]);
}

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
	name: ProductField;
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
					<Button onClick={onReloadCurrent} type="button" variant="outline">
						Carregar versão atual
					</Button>
				</AlertActions>
			) : null}
		</Alert>
	);
}

function targetHint(atelierTarget: number | undefined): string {
	return atelierTarget === undefined
		? "Vazio usa a meta do ateliê."
		: `Vazio usa a meta do ateliê (${formatMarginPercent(atelierTarget)}).`;
}

export function ProductForm({
	atelierTarget,
	categories,
	failure,
	initialPhotos,
	initialValues,
	onDirtyChange,
	onReloadCurrent,
	onSubmit,
	photos,
	submitLabel,
}: {
	atelierTarget: number | undefined;
	categories: readonly string[];
	failure: ClientCommandFailure | null;
	initialPhotos: readonly PhotoView[];
	initialValues: ProductFormValues;
	onDirtyChange?: (dirty: boolean) => void;
	onReloadCurrent?: () => void;
	onSubmit: (fields: ProductFields) => Promise<void>;
	photos: PhotoDrafts;
	submitLabel: string;
}) {
	const [values, setValues] = useState(initialValues);
	const [errors, setErrors] = useState<FieldErrors>({});
	const [submitting, setSubmitting] = useState(false);
	const alertRef = useRef<HTMLDivElement>(null);
	const targets = useRef(new Map<ProductField, HTMLElement>());
	const photosChanged =
		JSON.stringify(photos.photos) !== JSON.stringify(initialPhotos);
	const dirty = photosChanged || !sameValues(values, initialValues);

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
		onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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

	const suggestions = [
		...new Set([...categories, ...productCategorySuggestions]),
	];

	const submit = async () => {
		const found = productFormErrors(values);
		setErrors(found);
		const first = productFieldOrder.find((field) => found[field]);
		if (first) {
			targets.current.get(first)?.focus();
			return;
		}
		if (photos.busy) {
			return;
		}
		setSubmitting(true);
		try {
			await onSubmit(productFields(values, photos.photos));
		} finally {
			setSubmitting(false);
		}
	};

	const label = submitting ? "Salvando..." : submitLabel;

	return (
		<form
			className="flex flex-col gap-4 md:max-w-2xl"
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
						label="Nome"
						name="name"
						requirement="required"
					>
						<Input maxLength={productLimits.name.max} {...inputProps("name")} />
					</FormField>
					<FormField
						error={errors.category}
						hint="Escolha uma sugestão ou escreva uma categoria nova. Kit também é produto."
						label="Categoria"
						name="category"
						requirement="optional"
					>
						<SuggestionField
							items={suggestions}
							maxLength={productLimits.category}
							onValueChange={set("category")}
							placeholder="Roupa"
							value={values.category}
						/>
					</FormField>
					<FormField
						error={errors.targetMargin}
						hint={targetHint(atelierTarget)}
						label="Meta própria"
						name="targetMargin"
						requirement="optional"
					>
						<NumberField
							maxLength={6}
							suffix="%"
							{...inputProps("targetMargin")}
						/>
					</FormField>
					<FormField
						error={errors.notes}
						hint="Tecidos que combinam, cuidados, como é feito."
						label="Notas"
						name="notes"
						requirement="optional"
					>
						<Textarea
							maxLength={productLimits.notes}
							{...inputProps("notes")}
						/>
					</FormField>
				</PanelContent>
			</Panel>
			<Panel>
				<PanelContent>
					<PhotoField
						captionLimit={productLimits.caption}
						disabled={submitting}
						hint={`Opcional · até ${productLimits.photos} · a primeira é a imagem principal`}
						legend="Galeria"
						limit={productLimits.photos}
						photos={photos}
					/>
				</PanelContent>
			</Panel>
			{failure ? (
				<SaveFailure
					alertRef={alertRef}
					failure={failure}
					onReloadCurrent={onReloadCurrent}
				/>
			) : null}
			{photos.busy ? (
				<Text role="status" size="xs" tone="muted">
					Aguarde as fotos terminarem de enviar, ou remova as que falharam.
				</Text>
			) : null}
			<Button
				className="md:w-auto md:self-start"
				disabled={submitting || photos.busy}
				size="touch"
				type="submit"
			>
				{label}
			</Button>
		</form>
	);
}
