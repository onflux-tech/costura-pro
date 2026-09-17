import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
	return (
		<Sonner
			className="toaster group"
			icons={{
				error: <OctagonXIcon className="size-4 text-danger" />,
				info: <InfoIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
				success: <CircleCheckIcon className="size-4 text-success" />,
				warning: <TriangleAlertIcon className="size-4 text-warning" />,
			}}
			style={
				{
					"--border-radius": "var(--radius)",
					"--normal-bg": "var(--popover)",
					"--normal-border": "var(--border)",
					"--normal-text": "var(--popover-foreground)",
				} as React.CSSProperties
			}
			theme="light"
			{...props}
		/>
	);
}

export { Toaster };
