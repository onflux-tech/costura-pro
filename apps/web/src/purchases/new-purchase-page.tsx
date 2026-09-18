import { purchaseLimits } from "@costura-pro/domain/purchase";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { Input } from "@costura-pro/ui/components/input";
import { NumberField } from "@costura-pro/ui/components/number-field";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Select } from "@costura-pro/ui/components/select";
import { Stat } from "@costura-pro/ui/components/stat";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FieldMessage } from "@/components/field-message";
import { accountsQuery } from "@/finance/finance-queries";
import { moneyLabel } from "@/lib/finance";
import { localDay } from "@/lib/measurements";
import {
	type PaymentKind,
	type PurchaseFormField,
	type PurchaseFormValues,
	type PurchaseItemDraft,
	plusDays,
	purchaseFields,
	purchaseFormErrors,
	purchasePreview,
	supplierSelectItems,
} from "@/lib/purchases";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { stockLocationsQuery } from "@/stock/stock-queries";
import { client as api } from "@/utils/orpc";

import { PurchaseItemDialog } from "./purchase-item-dialog";
import { PurchaseItemRows } from "./purchase-item-rows";
import {
	failedPurchaseCommand,
	refreshPurchases,
	supplierOptionsQuery,
} from "./purchase-queries";
import { SupplierDialog } from "./supplier-dialog";

type Errors = Partial<Record<PurchaseFormField, string>>;

type Register = (
	field: PurchaseFormField
) => (element: HTMLElement | null) => void;

type Setter = <K extends keyof PurchaseFormValues>(
	field: K,
	next: PurchaseFormValues[K]
) => void;

type Option = { label: string; value: string };

const fieldOrder: readonly PurchaseFormField[] = [
	"supplierId",
	"occurredOn",
	"reference",
	"items",
	"freight",
	"discount",
	"accountId",
	"dueOn",
	"notes",
	"totals",
];

function focusControl(element: HTMLElement | undefined) {
	const control = element?.matches("button, input, textarea")
		? element
		: element?.querySelector<HTMLElement>("button, input, textarea");
	control?.focus();
}

function HeaderPanel({
	errors,
	onNewSupplier,
	register,
	set,
	suppliers,
	values,
}: {
	errors: Errors;
	onNewSupplier: () => void;
	register: Register;
	set: Setter;
	suppliers: readonly Option[];
	values: PurchaseFormValues;
}) {
	return (
		<Panel>
			<PanelContent className="flex flex-col gap-4">
				<Field invalid={Boolean(errors.supplierId)} name="supplierId">
					<FieldLabel requirement="required">Fornecedor</FieldLabel>
					<div className="flex flex-col gap-2 md:flex-row">
						<div className="min-w-0 flex-1" ref={register("supplierId")}>
							<Select
								items={suppliers}
								onValueChange={(next) => set("supplierId", next)}
								value={values.supplierId}
							/>
						</div>
						<Button onClick={onNewSupplier} type="button" variant="outline">
							Novo fornecedor
						</Button>
					</div>
					<FieldMessage message={errors.supplierId} />
				</Field>
				<div className="grid gap-4 md:grid-cols-2">
					<Field invalid={Boolean(errors.occurredOn)} name="occurredOn">
						<FieldLabel requirement="required">Data da compra</FieldLabel>
						<Input
							aria-invalid={Boolean(errors.occurredOn) || undefined}
							onChange={(event) => set("occurredOn", event.target.value)}
							ref={register("occurredOn")}
							type="date"
							value={values.occurredOn}
						/>
						<FieldMessage message={errors.occurredOn} />
					</Field>
					<Field invalid={Boolean(errors.reference)} name="reference">
						<FieldLabel requirement="optional">Nota ou recibo</FieldLabel>
						<Input
							aria-invalid={Boolean(errors.reference) || undefined}
							maxLength={purchaseLimits.reference}
							onChange={(event) => set("reference", event.target.value)}
							placeholder="NF 4521"
							ref={register("reference")}
							value={values.reference}
						/>
						<FieldMessage message={errors.reference} />
					</Field>
				</div>
			</PanelContent>
		</Panel>
	);
}

function ItemsPanel({
	error,
	items,
	onAdd,
	onEdit,
	onRemove,
	preview,
	register,
}: {
	error: string | undefined;
	items: PurchaseItemDraft[];
	onAdd: () => void;
	onEdit: (item: PurchaseItemDraft) => void;
	onRemove: (key: string) => void;
	preview: ReturnType<typeof purchasePreview>;
	register: Register;
}) {
	const empty =
		"Inclua cada material que chegou, com a embalagem e o preço do cupom.";
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Itens</PanelTitle>
				<Button onClick={onAdd} ref={register("items")} size="sm" type="button">
					Adicionar item
				</Button>
			</PanelHeader>
			{items.length > 0 ? (
				<PurchaseItemRows
					items={items}
					onEdit={onEdit}
					onRemove={onRemove}
					preview={preview}
				/>
			) : null}
			{items.length === 0 || error ? (
				<PanelContent>
					<Text tone={error ? "danger" : "subtle"}>{error ?? empty}</Text>
				</PanelContent>
			) : null}
		</Panel>
	);
}

function TotalsPanel({
	errors,
	preview,
	register,
	set,
	values,
}: {
	errors: Errors;
	preview: ReturnType<typeof purchasePreview>;
	register: Register;
	set: Setter;
	values: PurchaseFormValues;
}) {
	return (
		<Panel>
			<PanelContent className="flex flex-col gap-4">
				<div className="grid gap-4 md:grid-cols-2">
					<Field invalid={Boolean(errors.freight)} name="freight">
						<FieldLabel requirement="optional">Frete</FieldLabel>
						<NumberField
							aria-invalid={Boolean(errors.freight) || undefined}
							onChange={(event) => set("freight", event.target.value)}
							ref={register("freight")}
							suffix="R$"
							value={values.freight}
						/>
						<FieldMessage message={errors.freight} />
					</Field>
					<Field invalid={Boolean(errors.discount)} name="discount">
						<FieldLabel requirement="optional">Desconto</FieldLabel>
						<NumberField
							aria-invalid={Boolean(errors.discount) || undefined}
							onChange={(event) => set("discount", event.target.value)}
							ref={register("discount")}
							suffix="R$"
							value={values.discount}
						/>
						<FieldMessage message={errors.discount} />
					</Field>
				</div>
				<Text size="sm" tone="subtle">
					Frete e desconto se dividem entre os itens pelo valor de cada linha; o
					centavo que sobra vai para o último item.
				</Text>
				{preview?.ok ? (
					<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
						<Stat label="Itens" value={moneyLabel(preview.totals.grossCents)} />
						<Stat
							label="Frete"
							value={moneyLabel(preview.totals.freightCents)}
						/>
						<Stat
							label="Desconto"
							value={moneyLabel(preview.totals.discountCents)}
						/>
						<Stat label="Total" value={moneyLabel(preview.totals.totalCents)} />
					</div>
				) : null}
				{errors.totals ? <Text tone="danger">{errors.totals}</Text> : null}
			</PanelContent>
		</Panel>
	);
}

function PaymentPanel({
	accounts,
	errors,
	register,
	set,
	values,
}: {
	accounts: readonly Option[];
	errors: Errors;
	register: Register;
	set: Setter;
	values: PurchaseFormValues;
}) {
	return (
		<Panel>
			<PanelContent className="flex flex-col gap-4">
				<Fieldset>
					<FieldsetLegend>Pagamento</FieldsetLegend>
					<ChoiceChips
						onValueChange={(next) => set("paymentKind", next as PaymentKind)}
						value={values.paymentKind}
					>
						<ChoiceChip value="now">Pago agora</ChoiceChip>
						<ChoiceChip value="later">A pagar</ChoiceChip>
					</ChoiceChips>
				</Fieldset>
				{values.paymentKind === "now" ? (
					<Field invalid={Boolean(errors.accountId)} name="accountId">
						<FieldLabel requirement="required">Conta que pagou</FieldLabel>
						<div ref={register("accountId")}>
							<Select
								items={accounts}
								onValueChange={(next) => set("accountId", next)}
								value={values.accountId}
							/>
						</div>
						<FieldMessage message={errors.accountId} />
					</Field>
				) : (
					<Field invalid={Boolean(errors.dueOn)} name="dueOn">
						<FieldLabel requirement="required">Vencimento</FieldLabel>
						<Input
							aria-invalid={Boolean(errors.dueOn) || undefined}
							onChange={(event) => set("dueOn", event.target.value)}
							ref={register("dueOn")}
							type="date"
							value={values.dueOn}
						/>
						<FieldMessage message={errors.dueOn} />
					</Field>
				)}
				<Field invalid={Boolean(errors.notes)} name="notes">
					<FieldLabel requirement="optional">Notas</FieldLabel>
					<Textarea
						aria-invalid={Boolean(errors.notes) || undefined}
						maxLength={purchaseLimits.notes}
						onChange={(event) => set("notes", event.target.value)}
						ref={register("notes")}
						value={values.notes}
					/>
					<FieldMessage message={errors.notes} />
				</Field>
			</PanelContent>
		</Panel>
	);
}

function useFieldTargets() {
	const targets = useRef(new Map<PurchaseFormField, HTMLElement>());
	const register: Register = (field) => (element) => {
		if (element) {
			targets.current.set(field, element);
		} else {
			targets.current.delete(field);
		}
	};
	const focusFirst = (errors: Errors) => {
		const first = fieldOrder.find((field) => errors[field]);
		if (!first) {
			return false;
		}
		focusControl(targets.current.get(first === "totals" ? "freight" : first));
		return true;
	};
	return { focusFirst, register };
}

function emptyPurchase(today: string): PurchaseFormValues {
	return {
		accountId: "",
		discount: "",
		dueOn: plusDays(today, 30),
		freight: "",
		items: [],
		notes: "",
		occurredOn: today,
		paymentKind: "now",
		reference: "",
		supplierId: "",
	};
}

export function NewPurchasePage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const [ids] = useState(() => ({
		obligationId: crypto.randomUUID(),
		paymentMovementId: crypto.randomUUID(),
		purchaseId: crypto.randomUUID(),
	}));
	const today = localDay(new Date());
	const [values, setValues] = useState(() => emptyPurchase(today));
	const [errors, setErrors] = useState<Errors>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [editing, setEditing] = useState<PurchaseItemDraft | null>(null);
	const [itemOpen, setItemOpen] = useState(false);
	const [supplierOpen, setSupplierOpen] = useState(false);
	const suppliers = useQuery(supplierOptionsQuery());
	const accounts = useQuery(accountsQuery());
	const locations = useQuery(stockLocationsQuery());
	const alertRef = useRef<HTMLDivElement>(null);
	const { focusFirst, register } = useFieldTargets();
	usePageHeader({
		backHref: "/compras/recebidas",
		eyebrow: "Compras",
		heading: "Nova compra",
	});

	useEffect(() => {
		if (failure) {
			alertRef.current?.focus();
		}
	}, [failure]);

	const set: Setter = (field, next) =>
		setValues((current) => ({ ...current, [field]: next }));

	const preview = purchasePreview(values);
	const lastLocation =
		values.items.at(-1)?.locationId ?? locations.data?.items[0]?.id ?? "";

	const saveItem = (draft: PurchaseItemDraft) =>
		setValues((current) => ({
			...current,
			items: current.items.some((item) => item.key === draft.key)
				? current.items.map((item) => (item.key === draft.key ? draft : item))
				: [...current.items, draft],
		}));

	const openDetail = () =>
		navigate({
			params: { compraId: ids.purchaseId },
			to: "/compras/recebidas/$compraId",
		});

	const submit = async () => {
		const found = purchaseFormErrors(values, today);
		setErrors(found);
		if (focusFirst(found)) {
			return;
		}
		setFailure(null);
		setSubmitting(true);
		try {
			const fields = purchaseFields(values, ids);
			await api.purchases.create({
				...fields,
				opId: opIdFor(JSON.stringify(fields)),
				purchaseId: ids.purchaseId,
			});
		} catch (error) {
			const failed = await failedPurchaseCommand(queryClient, error);
			if (failed.kind === "exists") {
				toast.info("Esta compra já tinha sido salva.");
				await openDetail();
				return;
			}
			setFailure(failed.message);
			return;
		} finally {
			setSubmitting(false);
		}
		await refreshPurchases(queryClient);
		toast.success("Compra registrada.");
		await openDetail();
	};

	const supplierItems = supplierSelectItems(
		suppliers.data?.items ?? [],
		values.supplierId
	);
	const accountItems = (accounts.data?.items ?? []).map((account) => ({
		label: `${account.name} (${moneyLabel(account.balanceCents)})`,
		value: account.id,
	}));
	const label = submitting ? "Registrando..." : "Registrar compra";

	return (
		<>
			<form
				className="flex flex-col gap-4"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					submit();
				}}
			>
				<Heading className="max-md:sr-only">Nova compra</Heading>
				<HeaderPanel
					errors={errors}
					onNewSupplier={() => setSupplierOpen(true)}
					register={register}
					set={set}
					suppliers={supplierItems}
					values={values}
				/>
				<ItemsPanel
					error={errors.items}
					items={values.items}
					onAdd={() => {
						setEditing(null);
						setItemOpen(true);
					}}
					onEdit={(item) => {
						setEditing(item);
						setItemOpen(true);
					}}
					onRemove={(key) =>
						set(
							"items",
							values.items.filter((item) => item.key !== key)
						)
					}
					preview={preview}
					register={register}
				/>
				<TotalsPanel
					errors={errors}
					preview={preview}
					register={register}
					set={set}
					values={values}
				/>
				<PaymentPanel
					accounts={accountItems}
					errors={errors}
					register={register}
					set={set}
					values={values}
				/>
				{failure ? (
					<Alert ref={alertRef} role="alert" tabIndex={-1} tone="danger">
						<AlertTitle>Não foi possível registrar a compra</AlertTitle>
						<AlertDescription>{failure}</AlertDescription>
					</Alert>
				) : null}
				<div className="flex justify-end">
					<Button className="max-md:w-full" disabled={submitting} type="submit">
						{label}
					</Button>
				</div>
			</form>
			<PurchaseItemDialog
				defaultLocationId={lastLocation}
				draft={editing}
				onOpenChange={setItemOpen}
				onSave={saveItem}
				open={itemOpen}
			/>
			<SupplierDialog
				onCreated={(supplierId) => set("supplierId", supplierId)}
				onOpenChange={setSupplierOpen}
				open={supplierOpen}
				supplier={null}
			/>
		</>
	);
}
