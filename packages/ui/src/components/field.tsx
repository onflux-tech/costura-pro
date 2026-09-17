import { Field as FieldPrimitive } from "@base-ui/react/field";
import { cn } from "@costura-pro/ui/lib/utils";

function Field({ className, ...props }: FieldPrimitive.Root.Props) {
	return (
		<FieldPrimitive.Root
			className={cn("flex flex-col gap-1.5", className)}
			data-slot="field"
			{...props}
		/>
	);
}

function FieldLabel({
	children,
	className,
	requirement,
	...props
}: FieldPrimitive.Label.Props & { requirement?: "optional" | "required" }) {
	return (
		<FieldPrimitive.Label
			className={cn("font-medium text-md text-subtle-foreground", className)}
			data-slot="field-label"
			{...props}
		>
			{children}
			{requirement ? " " : null}
			{requirement === "required" && (
				<span className="ml-1 font-normal text-danger-foreground">
					obrigatório
				</span>
			)}
			{requirement === "optional" && (
				<span className="ml-1 font-normal text-muted-foreground">opcional</span>
			)}
		</FieldPrimitive.Label>
	);
}

function FieldHint({ className, ...props }: FieldPrimitive.Description.Props) {
	return (
		<FieldPrimitive.Description
			className={cn("text-muted-foreground text-xs", className)}
			data-slot="field-hint"
			{...props}
		/>
	);
}

function FieldError({ className, ...props }: FieldPrimitive.Error.Props) {
	return (
		<FieldPrimitive.Error
			className={cn("font-medium text-danger-foreground text-xs", className)}
			data-slot="field-error"
			{...props}
		/>
	);
}

export { Field, FieldError, FieldHint, FieldLabel };
