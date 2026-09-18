import { FieldError } from "@costura-pro/ui/components/field";

export function FieldMessage({ message }: { message: string | undefined }) {
	return message ? <FieldError match>{message}</FieldError> : null;
}
