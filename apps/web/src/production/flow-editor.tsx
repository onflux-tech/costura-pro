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
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Text } from "@costura-pro/ui/components/typography";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import { moveFocusTarget } from "@/lib/measurements";
import {
	addStage,
	type FlowDraft,
	type FlowStageView,
	flowChanged,
	flowDraftOf,
	flowErrors,
	hasFlowErrors,
	hideStage,
	moveStage,
	renameStage,
	showStage,
} from "@/lib/production";

type Register = (key: string) => (element: HTMLElement | null) => void;

type StageRowProps = {
	count: number;
	error: string | null;
	index: number;
	onHide: () => void;
	onMove: (direction: -1 | 1) => void;
	onRename: (name: string) => void;
	register: Register;
	stage: { id: string; name: string };
};

function StageRow({
	count,
	error,
	index,
	onHide,
	onMove,
	onRename,
	register,
	stage,
}: StageRowProps) {
	const spoken = stage.name.trim() || `etapa ${index + 1}`;
	return (
		<div className="flex flex-wrap items-end gap-2 border-divider border-b pb-3">
			<Field
				className="min-w-0 flex-1 basis-48"
				invalid={error !== null}
				name={`etapa-${stage.id}`}
			>
				<FieldLabel>{`Nome da etapa ${index + 1}`}</FieldLabel>
				<Input
					onChange={(event) => onRename(event.target.value)}
					ref={register(`${stage.id}:name`)}
					value={stage.name}
				/>
				{error ? <FieldError match>{error}</FieldError> : null}
			</Field>
			<div className="flex gap-1">
				<Button
					aria-label={`Subir ${spoken}`}
					disabled={index === 0}
					onClick={() => onMove(-1)}
					ref={register(`${stage.id}:up`)}
					size="icon"
					type="button"
					variant="outline"
				>
					<ArrowUpIcon aria-hidden="true" />
				</Button>
				<Button
					aria-label={`Descer ${spoken}`}
					disabled={index === count - 1}
					onClick={() => onMove(1)}
					ref={register(`${stage.id}:down`)}
					size="icon"
					type="button"
					variant="outline"
				>
					<ArrowDownIcon aria-hidden="true" />
				</Button>
				<Button
					aria-label={`Ocultar ${spoken}`}
					onClick={onHide}
					size="sm"
					type="button"
					variant="ghost"
				>
					Ocultar
				</Button>
			</div>
		</div>
	);
}

function FixedEnd({ children }: { children: string }) {
	return (
		<div className="flex min-h-11 items-center rounded-md border border-border border-dashed px-3 md:min-h-9">
			<Text tone="subtle">{children}</Text>
		</div>
	);
}

function HiddenStages({
	hidden,
	onShow,
}: {
	hidden: readonly { id: string; name: string }[];
	onShow: (id: string) => void;
}) {
	if (hidden.length === 0) {
		return null;
	}
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Ocultas</PanelTitle>
			</PanelHeader>
			<PanelContent className="flex flex-col gap-2">
				{hidden.map((stage) => (
					<div
						className="flex items-center justify-between gap-3"
						key={stage.id}
					>
						<Text tone="subtle">{stage.name}</Text>
						<Button
							aria-label={`Mostrar ${stage.name}`}
							onClick={() => onShow(stage.id)}
							size="sm"
							type="button"
							variant="ghost"
						>
							Mostrar
						</Button>
					</div>
				))}
			</PanelContent>
		</Panel>
	);
}

function SaveFailure({
	alertRef,
	failure,
	onReloadCurrent,
}: {
	alertRef: RefObject<HTMLDivElement | null>;
	failure: ClientCommandFailure;
	onReloadCurrent: () => void;
}) {
	const stale = failure.kind === "stale";
	return (
		<Alert
			ref={alertRef}
			role="alert"
			tabIndex={-1}
			tone={stale ? "warning" : "danger"}
		>
			<AlertTitle>Não foi possível salvar o fluxo</AlertTitle>
			<AlertDescription>{failure.message}</AlertDescription>
			{stale ? (
				<AlertActions>
					<Button onClick={onReloadCurrent} type="button" variant="outline">
						Carregar versão atual
					</Button>
				</AlertActions>
			) : null}
		</Alert>
	);
}

type FlowEditorProps = {
	failure: ClientCommandFailure | null;
	onReloadCurrent: () => void;
	onSubmit: (draft: FlowDraft) => Promise<void>;
	stages: readonly FlowStageView[];
	version: number;
};

export function FlowEditor({
	failure,
	onReloadCurrent,
	onSubmit,
	stages,
	version,
}: FlowEditorProps) {
	const [draft, setDraft] = useState(() => flowDraftOf(stages));
	const [checked, setChecked] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [focusKey, setFocusKey] = useState<string | null>(null);
	const focusables = useRef(new Map<string, HTMLElement>());
	const failureRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (focusKey) {
			focusables.current.get(focusKey)?.focus();
			setFocusKey(null);
		}
	}, [focusKey]);
	useEffect(() => {
		if (failure) {
			failureRef.current?.focus();
		}
	}, [failure]);

	const register: Register = (key) => (element) => {
		if (element) {
			focusables.current.set(key, element);
		} else {
			focusables.current.delete(key);
		}
	};
	const errors = flowErrors(draft);
	const changed = flowChanged(stages, draft);

	const move = (index: number, direction: -1 | 1) => {
		const stage = draft.active[index];
		if (!stage) {
			return;
		}
		setDraft(moveStage(draft, index, direction));
		setFocusKey(
			`${stage.id}:${moveFocusTarget(index + direction, draft.active.length, direction)}`
		);
	};
	const hide = (index: number) => {
		const next = draft.active[index + 1] ?? draft.active[index - 1];
		setDraft(hideStage(draft, index, stages));
		setFocusKey(next ? `${next.id}:name` : "add");
	};
	const show = (id: string) => {
		setDraft(showStage(draft, id));
		setFocusKey(`${id}:name`);
	};
	const add = () => {
		const id = crypto.randomUUID();
		setDraft(addStage(draft, id));
		setFocusKey(`${id}:name`);
	};
	const discard = () => {
		setDraft(flowDraftOf(stages));
		setChecked(false);
	};

	const submit = async () => {
		setChecked(true);
		if (hasFlowErrors(errors)) {
			const invalid = draft.active.find(
				(_, index) => errors.names[index] !== null
			);
			setFocusKey(invalid ? `${invalid.id}:name` : "add");
			return;
		}
		setSubmitting(true);
		try {
			await onSubmit(draft);
		} finally {
			setSubmitting(false);
		}
	};
	const submitText = submitting
		? "Salvando..."
		: `Salvar versão ${version + 1}`;

	return (
		<form
			className="flex flex-col gap-4 md:max-w-3xl"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<Text tone="subtle">{`versão ${version}`}</Text>
			<Panel>
				<PanelHeader>
					<PanelTitle>Etapas</PanelTitle>
					<PanelMeta>{`${draft.active.length} ativas`}</PanelMeta>
				</PanelHeader>
				<PanelContent className="flex flex-col gap-3">
					<FixedEnd>A iniciar</FixedEnd>
					{draft.active.map((stage, index) => (
						<StageRow
							count={draft.active.length}
							error={checked ? (errors.names[index] ?? null) : null}
							index={index}
							key={stage.id}
							onHide={() => hide(index)}
							onMove={(direction) => move(index, direction)}
							onRename={(name) => setDraft(renameStage(draft, index, name))}
							register={register}
							stage={stage}
						/>
					))}
					{errors.list ? (
						<Text role="alert" tone="danger">
							{errors.list}
						</Text>
					) : null}
					<Button
						onClick={add}
						ref={register("add")}
						type="button"
						variant="dashed"
					>
						Adicionar etapa
					</Button>
					<FixedEnd>Pronto</FixedEnd>
					<Text size="xs" tone="muted">
						Ficam fixos nas pontas do fluxo.
					</Text>
				</PanelContent>
			</Panel>
			<HiddenStages hidden={draft.hidden} onShow={show} />
			{failure ? (
				<SaveFailure
					alertRef={failureRef}
					failure={failure}
					onReloadCurrent={onReloadCurrent}
				/>
			) : null}
			<Text size="xs" tone="muted">
				As OS mantêm a versão com que nasceram; a página de cada OS oferece a
				versão nova.
			</Text>
			<div className="flex flex-col gap-2 md:flex-row">
				<Button
					className="md:w-auto"
					disabled={!changed || submitting}
					size="touch"
					type="submit"
				>
					{submitText}
				</Button>
				<Button
					className="md:w-auto"
					disabled={!changed || submitting}
					onClick={discard}
					size="touch"
					type="button"
					variant="outline"
				>
					Descartar alterações
				</Button>
			</div>
		</form>
	);
}
