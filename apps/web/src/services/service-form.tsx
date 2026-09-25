import { formatMoneyInput } from "@costura-pro/domain/money";
import { formatMarginPercent } from "@costura-pro/domain/pricing";
import {
	serviceCategorySuggestions,
	serviceLimits,
} from "@costura-pro/domain/service";
import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import {
	CheckboxChip,
	CheckboxChips,
} from "@costura-pro/ui/components/checkbox-chips";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
import {
	Field,
	FieldError,
	FieldHint,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { Input } from "@costura-pro/ui/components/input";
import { NumberField } from "@costura-pro/ui/components/number-field";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { SuggestionField } from "@costura-pro/ui/components/suggestion-field";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { Text } from "@costura-pro/ui/components/typography";
import {
	type ChangeEvent,
	type ReactNode,
	type RefObject,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import type { FlowStageView } from "@/lib/production";
import {
	formPricing,
	formPricingHint,
	type ServiceField,
	type ServiceFields,
	type ServiceFormValues,
	type ServiceKind,
	sameServiceValues,
	serviceFieldOrder,
	serviceFields,
	serviceFormErrors,
} from "@/lib/services";
import { PricingPanel } from "@/pricing/pricing-panel";

type TextKey = Exclude<keyof ServiceFormValues, "kind" | "suggestedStageIds">;

type FieldErrors = Partial<Record<ServiceField, string>>;

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
	name: ServiceField;
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

function kindTexts(kind: ServiceKind) {
	return kind === "outsourced"
		? {
				costHint:
					"Quanto o parceiro cobra. Quando a despesa real for lançada, ela substitui a estimativa na margem real.",
				costLabel: "Custo estimado",
			}
		: {
				costHint: "Mão de obra e custos fixos do serviço, sem os materiais.",
				costLabel: "Custo interno",
			};
}

export function ServiceForm({
	atelierTarget,
	categories,
	failure,
	initialValues,
	onDirtyChange,
	onReloadCurrent,
	onSubmit,
	stages,
	submitLabel,
}: {
	atelierTarget: number;
	categories: readonly string[];
	failure: ClientCommandFailure | null;
	initialValues: ServiceFormValues;
	onDirtyChange?: (dirty: boolean) => void;
	onReloadCurrent?: () => void;
	onSubmit: (fields: ServiceFields) => Promise<void>;
	stages: readonly FlowStageView[];
	submitLabel: string;
}) {
	const [values, setValues] = useState(initialValues);
	const [errors, setErrors] = useState<FieldErrors>({});
	const [submitting, setSubmitting] = useState(false);
	const alertRef = useRef<HTMLDivElement>(null);
	const stagesErrorId = useId();
	const targets = useRef(new Map<ServiceField, HTMLElement>());
	const dirty = !sameServiceValues(values, initialValues);

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

	const target = (key: ServiceField) => (element: HTMLElement | null) => {
		if (element) {
			targets.current.set(key, element);
		} else {
			targets.current.delete(key);
		}
	};

	const inputProps = (key: TextKey & ServiceField) => ({
		"aria-invalid": errors[key] ? true : undefined,
		onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
			set(key)(event.target.value),
		ref: target(key),
		value: values[key],
	});

	const suggestions = [
		...new Set([...categories, ...serviceCategorySuggestions]),
	];
	const preview = formPricing(values, atelierTarget);
	const suggestedInput = preview
		? formatMoneyInput(preview.suggestedCents)
		: null;
	const { costHint, costLabel } = kindTexts(values.kind);

	const submit = async () => {
		const found = serviceFormErrors(values);
		setErrors(found);
		const first = serviceFieldOrder.find((field) => found[field]);
		if (first) {
			targets.current.get(first)?.focus();
			return;
		}
		setSubmitting(true);
		try {
			await onSubmit(serviceFields(values));
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
						<Input maxLength={serviceLimits.name.max} {...inputProps("name")} />
					</FormField>
					<FormField
						error={errors.category}
						hint="Escolha uma sugestão ou escreva uma categoria nova."
						label="Categoria"
						name="category"
						requirement="optional"
					>
						<SuggestionField
							items={suggestions}
							maxLength={serviceLimits.category}
							onValueChange={set("category")}
							placeholder="Ajuste"
							value={values.category}
						/>
					</FormField>
					<Fieldset>
						<FieldsetLegend>Quem faz</FieldsetLegend>
						<ChoiceChips
							onValueChange={(next) =>
								setValues((current) => ({
									...current,
									kind: next as ServiceKind,
								}))
							}
							value={values.kind}
						>
							<ChoiceChip value="own">No ateliê</ChoiceChip>
							<ChoiceChip value="outsourced">Terceirizado</ChoiceChip>
						</ChoiceChips>
					</Fieldset>
				</PanelContent>
			</Panel>
			<Panel>
				<PanelHeader>
					<PanelTitle>Custo e preço</PanelTitle>
				</PanelHeader>
				<PanelContent className="flex flex-col gap-4">
					<FormField
						error={errors.cost}
						hint={costHint}
						label={costLabel}
						name="cost"
						requirement="required"
					>
						<NumberField
							maxLength={20}
							placeholder="60,00"
							suffix="R$"
							{...inputProps("cost")}
						/>
					</FormField>
					<FormField
						error={errors.price}
						hint="O preço cobrado. A sugestão nunca muda este valor sozinha."
						label="Preço praticado"
						name="price"
						requirement="required"
					>
						<NumberField
							maxLength={20}
							placeholder="100,00"
							suffix="R$"
							{...inputProps("price")}
						/>
					</FormField>
					<FormField
						error={errors.targetMargin}
						hint={`Vazio usa a meta do ateliê (${formatMarginPercent(atelierTarget)}).`}
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
				</PanelContent>
			</Panel>
			<PricingPanel
				hint={formPricingHint(values)}
				onUseSuggestion={() => {
					if (suggestedInput) {
						set("price")(suggestedInput);
					}
				}}
				preview={preview}
				suggestionApplied={suggestedInput === values.price.trim()}
			/>
			<Panel>
				<PanelContent className="flex flex-col gap-4">
					<FormField
						error={errors.estimatedMinutes}
						hint="Só para a agenda; não entra no custo."
						label="Duração estimada"
						name="estimatedMinutes"
						requirement="optional"
					>
						<NumberField
							inputMode="numeric"
							maxLength={4}
							suffix="min"
							{...inputProps("estimatedMinutes")}
						/>
					</FormField>
					<Fieldset
						aria-describedby={
							errors.suggestedStageIds ? stagesErrorId : undefined
						}
						ref={target("suggestedStageIds")}
						tabIndex={-1}
					>
						<FieldsetLegend>Etapas sugeridas</FieldsetLegend>
						<CheckboxChips
							onValueChange={(next) =>
								setValues((current) => ({
									...current,
									suggestedStageIds: next,
								}))
							}
							value={values.suggestedStageIds}
						>
							{stages.map((stage) => (
								<CheckboxChip key={stage.id} value={stage.id}>
									{stage.name}
								</CheckboxChip>
							))}
						</CheckboxChips>
						<Text size="xs" tone="muted">
							Vêm marcadas ao iniciar a produção; você ajusta no início.
						</Text>
						{errors.suggestedStageIds ? (
							<Text id={stagesErrorId} size="xs" tone="danger">
								{errors.suggestedStageIds}
							</Text>
						) : null}
					</Fieldset>
					<FormField
						error={errors.notes}
						hint="Como é feito, cuidados, parceiro que executa."
						label="Notas"
						name="notes"
						requirement="optional"
					>
						<Textarea
							maxLength={serviceLimits.notes}
							{...inputProps("notes")}
						/>
					</FormField>
				</PanelContent>
			</Panel>
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
	);
}
