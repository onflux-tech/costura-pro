import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import {
	Field,
	FieldError,
	FieldHint,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { type ReactNode, useCallback, useEffect, useRef } from "react";

import type { ClientCommandFailure } from "@/lib/client-command-error";

export function FailureAlert({
	failure,
	heading,
}: {
	failure: ClientCommandFailure | null;
	heading: string;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (failure) {
			ref.current?.focus();
		}
	}, [failure]);
	if (!failure) {
		return null;
	}
	const message =
		failure.kind === "stale"
			? `${failure.message} Salvar de novo aplica a mudança na versão atual.`
			: failure.message;
	return (
		<Alert
			ref={ref}
			role="alert"
			tabIndex={-1}
			tone={failure.kind === "stale" ? "warning" : "danger"}
		>
			<AlertTitle>{heading}</AlertTitle>
			<AlertDescription>{message}</AlertDescription>
		</Alert>
	);
}

export function QuoteField({
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
	name: string;
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

export type FieldRef<Name extends string> = (
	name: Name
) => (element: HTMLElement | null) => void;

export function useFieldTargets<Name extends string>() {
	const targets = useRef(new Map<Name, HTMLElement>());
	const fieldRef = useCallback<FieldRef<Name>>(
		(name) => (element) => {
			if (element) {
				targets.current.set(name, element);
			} else {
				targets.current.delete(name);
			}
		},
		[]
	);
	const focusFirst = useCallback(
		(order: readonly Name[], errors: Partial<Record<Name, string>>) => {
			const first = order.find((name) => errors[name]);
			if (first) {
				targets.current.get(first)?.focus();
			}
			return first !== undefined;
		},
		[]
	);
	return { fieldRef, focusFirst };
}
