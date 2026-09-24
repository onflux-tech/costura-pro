import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Stat } from "@costura-pro/ui/components/stat";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
	type FinalizeField,
	finalizeErrors,
	type InventoryDraft,
	type InventoryPointView,
	type InventoryReview,
	invalidLabels,
	inventoryFields,
	inventoryOpKey,
	pointKey,
	reviewOf,
	withDetails,
	withSurplusValue,
	withZeroCount,
} from "@/lib/inventory";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { FinalizePanel } from "./finalize-panel";
import {
	failedInventoryCommand,
	refreshInventory,
	stockPointsQuery,
} from "./inventory-queries";
import { DivergentList, MatchedList, UncountedList } from "./review-lines";
import { useInventoryDraft } from "./use-inventory-draft";

type Errors = Partial<Record<FinalizeField, string>>;

type Update = (change: (current: InventoryDraft) => InventoryDraft) => void;

type Done = (sessionId: string, repeated: boolean) => Promise<void>;

function focusOrder(review: InventoryReview): FinalizeField[] {
	return [
		...review.divergent
			.filter((line) => line.outcome.kind === "surplus")
			.map((line): FinalizeField => `value:${line.key}`),
		"reason",
		"occurredOn",
		"notes",
		"lines",
	];
}

function useFieldTargets() {
	const targets = useRef(new Map<FinalizeField, HTMLElement>());
	const register = (field: FinalizeField) => (element: HTMLElement | null) => {
		if (element) {
			targets.current.set(field, element);
		} else {
			targets.current.delete(field);
		}
	};
	const focus = (field: FinalizeField) => {
		const element = targets.current.get(field);
		const control =
			element?.querySelector<HTMLElement>("input, textarea") ?? element;
		control?.focus();
	};
	return { focus, register };
}

function ReviewStats({ review }: { review: InventoryReview }) {
	return (
		<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
			<Stat
				label="Contados"
				value={review.divergent.length + review.matched.length}
			/>
			<Stat
				label="Divergências"
				tone={review.divergent.length > 0 ? "warning" : undefined}
				value={review.divergent.length}
			/>
			<Stat label="Bateram" value={review.matched.length} />
			<Stat label="Não contados" value={review.uncounted.length} />
		</div>
	);
}

function ReviewBody({
	draft,
	onDone,
	points,
	update,
}: {
	draft: InventoryDraft;
	onDone: Done;
	points: readonly InventoryPointView[];
	update: Update;
}) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const { focus, register } = useFieldTargets();
	const [errors, setErrors] = useState<Errors>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [pendingFocus, setPendingFocus] = useState<FinalizeField | null>(null);
	const failureRef = useRef<HTMLDivElement>(null);
	const review = reviewOf(draft, points);

	useEffect(() => {
		if (failure) {
			failureRef.current?.focus();
		}
	}, [failure]);

	useEffect(() => {
		if (pendingFocus) {
			focus(pendingFocus);
			setPendingFocus(null);
		}
	}, [focus, pendingFocus]);

	const zero = (point: InventoryPointView) =>
		update((current) =>
			withZeroCount(
				current,
				point,
				current.lines[pointKey(point)]?.movementId ?? crypto.randomUUID()
			)
		);

	const finalize = async () => {
		const found = finalizeErrors(draft, review);
		setErrors(found);
		const first = focusOrder(review).find((field) => found[field]);
		if (first) {
			setPendingFocus(first);
			return;
		}
		setFailure(null);
		setSubmitting(true);
		const fields = inventoryFields(draft, review);
		try {
			await api.inventorySessions.create({
				...fields,
				opId: opIdFor(inventoryOpKey(draft, fields)),
				sessionId: draft.sessionId,
			});
			await onDone(draft.sessionId, false);
		} catch (error) {
			const failed = await failedInventoryCommand(queryClient, error);
			if (failed.kind === "exists") {
				await onDone(draft.sessionId, true);
				return;
			}
			setFailure(failed.message);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<Heading className="max-md:sr-only">Revisão da contagem</Heading>
			<ReviewStats review={review} />
			<Panel>
				<PanelHeader>
					<PanelTitle>Divergências</PanelTitle>
				</PanelHeader>
				{review.divergent.length > 0 ? (
					<DivergentList
						errors={errors}
						lines={review.divergent}
						onValueChange={(key, text) =>
							update((current) => withSurplusValue(current, key, text))
						}
						register={register}
					/>
				) : (
					<PanelContent>
						<Text tone="subtle">
							Tudo o que foi contado bateu com o sistema.
						</Text>
					</PanelContent>
				)}
			</Panel>
			{review.uncounted.length > 0 ? (
				<Panel>
					<PanelHeader>
						<PanelTitle>Não contados</PanelTitle>
					</PanelHeader>
					<UncountedList onZero={zero} points={review.uncounted} />
				</Panel>
			) : null}
			<Panel>
				<PanelContent>
					<MatchedList lines={review.matched} />
				</PanelContent>
			</Panel>
			{failure ? (
				<Alert ref={failureRef} role="alert" tabIndex={-1} tone="danger">
					<AlertTitle>Não foi possível finalizar a contagem</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			<FinalizePanel
				draft={draft}
				errors={errors}
				invalidItems={invalidLabels(draft, review)}
				onDetails={(details) =>
					update((current) => withDetails(current, details))
				}
				onFinalize={finalize}
				register={register}
				submitting={submitting}
				uncounted={review.uncounted.length}
			/>
		</div>
	);
}

function ReviewLoader({
	draft,
	onDone,
	update,
}: {
	draft: InventoryDraft;
	onDone: Done;
	update: Update;
}) {
	const points = useQuery(stockPointsQuery(draft.locationIds));
	if (points.data) {
		return (
			<ReviewBody
				draft={draft}
				onDone={onDone}
				points={points.data.items}
				update={update}
			/>
		);
	}
	if (points.isError) {
		return (
			<Alert role="alert" tone="danger">
				<AlertTitle>
					Não foi possível carregar os saldos para a revisão
				</AlertTitle>
				<AlertDescription>
					A contagem continua guardada neste aparelho.
				</AlertDescription>
				<AlertActions>
					<Button onClick={() => points.refetch()} size="sm" variant="outline">
						Tentar de novo
					</Button>
				</AlertActions>
			</Alert>
		);
	}
	return (
		<div className="flex flex-col gap-2">
			<Skeleton className="h-24" />
			<Skeleton className="h-40" />
		</div>
	);
}

export function ReviewPage() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { draft, save, update } = useInventoryDraft();
	const [finished, setFinished] = useState(false);
	usePageHeader({
		backHref: "/estoque/inventario/contagem",
		eyebrow: "Inventário",
		heading: "Revisão da contagem",
	});

	const done: Done = async (sessionId, repeated) => {
		setFinished(true);
		save(null);
		await refreshInventory(queryClient);
		if (repeated) {
			toast.info("Esta contagem já tinha sido finalizada.");
		} else {
			toast.success("Contagem finalizada.");
		}
		await navigate({
			params: { contagemId: sessionId },
			to: "/estoque/inventario/$contagemId",
		});
	};

	if (!draft) {
		return finished ? null : <Navigate replace to="/estoque/inventario" />;
	}

	return <ReviewLoader draft={draft} onDone={done} update={update} />;
}
