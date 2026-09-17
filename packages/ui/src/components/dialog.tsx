import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

const dialogBackdropClass =
	"fixed inset-0 z-50 bg-foreground/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0";

const dialogPopupClass =
	"fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg outline-none transition-[scale,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0";

const dialogTitleClass =
	"font-semibold font-serif text-foreground text-xl leading-tight";

const dialogDescriptionClass = "text-md text-subtle-foreground leading-relaxed";

const dialogActionsClass =
	"flex flex-col-reverse gap-2 md:flex-row md:justify-end";

function Dialog(props: DialogPrimitive.Root.Props) {
	return <DialogPrimitive.Root {...props} />;
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogContent({ className, ...props }: DialogPrimitive.Popup.Props) {
	return (
		<DialogPrimitive.Portal>
			<DialogPrimitive.Backdrop
				className={dialogBackdropClass}
				data-slot="dialog-backdrop"
			/>
			<DialogPrimitive.Popup
				className={cn(dialogPopupClass, className)}
				data-slot="dialog-content"
				{...props}
			/>
		</DialogPrimitive.Portal>
	);
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
	return (
		<DialogPrimitive.Title
			className={cn(dialogTitleClass, className)}
			data-slot="dialog-title"
			{...props}
		/>
	);
}

function DialogDescription({
	className,
	...props
}: DialogPrimitive.Description.Props) {
	return (
		<DialogPrimitive.Description
			className={cn(dialogDescriptionClass, className)}
			data-slot="dialog-description"
			{...props}
		/>
	);
}

function DialogActions({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(dialogActionsClass, className)}
			data-slot="dialog-actions"
			{...props}
		/>
	);
}

function DialogClose(props: DialogPrimitive.Close.Props) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
	dialogActionsClass,
	dialogBackdropClass,
	dialogDescriptionClass,
	dialogPopupClass,
	dialogTitleClass,
};
