import { cn } from "@costura-pro/ui/lib/utils";
import { ImageOffIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useState } from "react";

type PhotoProps = Omit<
	React.ComponentProps<"img">,
	"alt" | "height" | "onError" | "ref" | "width"
> & {
	alt: string;
	height: number;
	width: number;
};

function Photo({ alt, className, height, src, width, ...props }: PhotoProps) {
	const [failedSrc, setFailedSrc] = useState<string | null>(null);

	const watchErrors = useCallback((element: HTMLImageElement | null) => {
		if (!element) {
			return;
		}
		const fail = () => setFailedSrc(element.getAttribute("src"));
		element.addEventListener("error", fail);
		return () => element.removeEventListener("error", fail);
	}, []);

	if (src !== undefined && failedSrc === src) {
		return (
			<div
				aria-label={
					alt === "" ? "Foto indisponível" : `${alt}: foto indisponível`
				}
				className={cn(
					"flex flex-col items-center justify-center gap-1 bg-muted p-1 text-center text-2xs text-muted-foreground",
					className
				)}
				data-slot="photo-unavailable"
				role="img"
			>
				<ImageOffIcon aria-hidden="true" className="size-4" />
				Foto indisponível
			</div>
		);
	}
	return (
		<img
			alt={alt}
			className={cn("bg-muted object-cover", className)}
			data-slot="photo"
			decoding="async"
			height={height}
			loading="lazy"
			ref={watchErrors}
			src={src}
			width={width}
			{...props}
		/>
	);
}

export { Photo };
