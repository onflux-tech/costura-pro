import { Button } from "@costura-pro/ui/components/button";
import { Input } from "@costura-pro/ui/components/input";
import { Photo } from "@costura-pro/ui/components/photo";
import { cn } from "@costura-pro/ui/lib/utils";
import { XIcon } from "lucide-react";
import type * as React from "react";

type PhotoTileProps = {
	alt: string;
	caption?: string | null;
	captionField?: {
		label: string;
		maxLength: number;
		onChange: (value: string) => void;
		value: string;
	};
	className?: string;
	failure?: { message: string; onRetry?: () => void } | null;
	onOpen?: () => void;
	onRemove?: () => void;
	openRef?: React.Ref<HTMLButtonElement>;
	removeLabel?: string;
	src: string;
	status?: "failed" | "ready" | "uploading";
};

function PhotoTile({
	alt,
	caption,
	captionField,
	className,
	failure,
	onOpen,
	onRemove,
	openRef,
	removeLabel,
	src,
	status = "ready",
}: PhotoTileProps) {
	return (
		<div
			className={cn("flex w-24 flex-col gap-1.5", className)}
			data-slot="photo-tile"
			data-status={status}
		>
			<div className="relative size-24 overflow-hidden rounded-lg border">
				{onOpen ? (
					<button
						aria-label={alt}
						className="size-full outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:-outline-offset-2"
						onClick={onOpen}
						ref={openRef}
						type="button"
					>
						<Photo
							alt=""
							className="size-full"
							height={512}
							src={src}
							width={512}
						/>
					</button>
				) : (
					<Photo
						alt={alt}
						className="size-full"
						height={512}
						src={src}
						width={512}
					/>
				)}
				{status === "uploading" ? (
					<div
						className="absolute inset-0 flex items-center justify-center bg-card/80 font-medium text-2xs"
						role="status"
					>
						Enviando...
					</div>
				) : null}
				{onRemove ? (
					<Button
						aria-label={removeLabel}
						className="absolute top-1 right-1"
						onClick={onRemove}
						size="icon"
						variant="outline"
					>
						<XIcon aria-hidden="true" />
					</Button>
				) : null}
			</div>
			{status === "failed" && failure ? (
				<div className="flex flex-col gap-1" role="alert">
					<p className="text-2xs text-danger-foreground">{failure.message}</p>
					{failure.onRetry ? (
						<Button onClick={failure.onRetry} size="sm" variant="outline">
							Tentar de novo
						</Button>
					) : null}
				</div>
			) : null}
			{captionField ? (
				<Input
					aria-label={captionField.label}
					maxLength={captionField.maxLength}
					onChange={(event) => captionField.onChange(event.target.value)}
					placeholder="Legenda"
					value={captionField.value}
				/>
			) : null}
			{!captionField && caption ? (
				<p className="truncate text-2xs text-muted-foreground">{caption}</p>
			) : null}
		</div>
	);
}

export { PhotoTile, type PhotoTileProps };
