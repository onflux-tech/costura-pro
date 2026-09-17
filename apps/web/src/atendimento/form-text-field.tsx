import {
	Field,
	FieldError,
	FieldHint,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Textarea } from "@costura-pro/ui/components/textarea";

type FormTextFieldProps = {
	autoComplete?: string;
	errors: readonly (string | undefined)[];
	hint?: string;
	inputMode?: "email" | "tel" | "text";
	label: string;
	maxLength: number;
	multiline?: boolean;
	name: string;
	onBlur: () => void;
	onChange: (value: string) => void;
	requirement?: "optional" | "required";
	value: string;
};

export function FormTextField({
	autoComplete,
	errors,
	hint,
	inputMode,
	label,
	maxLength,
	multiline = false,
	name,
	onBlur,
	onChange,
	requirement,
	value,
}: FormTextFieldProps) {
	const messages = [
		...new Set(errors.filter((error): error is string => Boolean(error))),
	];
	const invalid = messages.length > 0;
	return (
		<Field invalid={invalid} name={name}>
			<FieldLabel requirement={requirement}>{label}</FieldLabel>
			{multiline ? (
				<Textarea
					aria-invalid={invalid || undefined}
					maxLength={maxLength}
					onBlur={onBlur}
					onChange={(event) => onChange(event.target.value)}
					value={value}
				/>
			) : (
				<Input
					aria-invalid={invalid || undefined}
					autoComplete={autoComplete}
					inputMode={inputMode}
					maxLength={maxLength}
					onBlur={onBlur}
					onChange={(event) => onChange(event.target.value)}
					value={value}
				/>
			)}
			{hint ? <FieldHint>{hint}</FieldHint> : null}
			{messages.map((message) => (
				<FieldError key={message} match>
					{message}
				</FieldError>
			))}
		</Field>
	);
}
