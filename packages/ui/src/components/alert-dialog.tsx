import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

import {
	dialogActionsClass,
	dialogBackdropClass,
	dialogDescriptionClass,
	dialogPopupClass,
	dialogTitleClass,
} from "./dialog";

function AlertDialog(props: AlertDialogPrimitive.Root.Props) {
	return <AlertDialogPrimitive.Root {...props} />;
}

function AlertDialogTrigger(props: AlertDialogPrimitive.Trigger.Props) {
	return (
		<AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
	);
}

function AlertDialogContent({
	className,
	...props
}: AlertDialogPrimitive.Popup.Props) {
	return (
		<AlertDialogPrimitive.Portal>
			<AlertDialogPrimitive.Backdrop
				className={dialogBackdropClass}
				data-slot="alert-dialog-backdrop"
			/>
			<AlertDialogPrimitive.Popup
				className={cn(dialogPopupClass, className)}
				data-slot="alert-dialog-content"
				{...props}
			/>
		</AlertDialogPrimitive.Portal>
	);
}

function AlertDialogTitle({
	className,
	...props
}: AlertDialogPrimitive.Title.Props) {
	return (
		<AlertDialogPrimitive.Title
			className={cn(dialogTitleClass, className)}
			data-slot="alert-dialog-title"
			{...props}
		/>
	);
}

function AlertDialogDescription({
	className,
	...props
}: AlertDialogPrimitive.Description.Props) {
	return (
		<AlertDialogPrimitive.Description
			className={cn(dialogDescriptionClass, className)}
			data-slot="alert-dialog-description"
			{...props}
		/>
	);
}

function AlertDialogActions({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(dialogActionsClass, className)}
			data-slot="alert-dialog-actions"
			{...props}
		/>
	);
}

function AlertDialogClose(props: AlertDialogPrimitive.Close.Props) {
	return (
		<AlertDialogPrimitive.Close data-slot="alert-dialog-close" {...props} />
	);
}

export {
	AlertDialog,
	AlertDialogActions,
	AlertDialogClose,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
	AlertDialogTrigger,
};
