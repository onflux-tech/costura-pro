import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { buttonVariants } from "@costura-pro/ui/components/button";
import { cn } from "@costura-pro/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";

function ButtonLink({
	className,
	render,
	size,
	variant,
	...props
}: useRender.ComponentProps<"a"> & VariantProps<typeof buttonVariants>) {
	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(
			{
				className: cn(buttonVariants({ size, variant }), className),
			},
			props
		),
		render,
		state: { slot: "button-link" },
	});
}

export { ButtonLink };
