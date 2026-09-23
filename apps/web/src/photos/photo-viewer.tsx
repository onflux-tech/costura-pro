import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@costura-pro/ui/components/dialog";
import { Photo } from "@costura-pro/ui/components/photo";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { RefObject } from "react";
import { photoUrl } from "@/lib/media";

import { type PhotoView, photoAlt } from "@/lib/photos";

export type ViewerPhoto = PhotoView & {
	downloadable?: boolean;
	src?: string;
};

export function PhotoViewer({
	index,
	onIndexChange,
	onOpenChange,
	photos,
	returnFocus,
}: {
	index: number | null;
	onIndexChange: (index: number) => void;
	onOpenChange: (open: boolean) => void;
	photos: readonly ViewerPhoto[];
	returnFocus: RefObject<HTMLElement | null>;
}) {
	const total = photos.length;
	const current = index === null ? undefined : photos[index];
	const go = (step: number) => {
		if (index !== null && total > 0) {
			onIndexChange((index + step + total) % total);
		}
	};
	return (
		<Dialog onOpenChange={onOpenChange} open={current !== undefined}>
			<DialogContent
				className="max-w-3xl"
				finalFocus={returnFocus}
				onKeyDown={(event) => {
					if (event.key === "ArrowLeft") {
						go(-1);
					}
					if (event.key === "ArrowRight") {
						go(1);
					}
				}}
			>
				{current && index !== null ? (
					<>
						<DialogTitle aria-live="polite">{`Foto ${index + 1} de ${total}`}</DialogTitle>
						<Photo
							alt={photoAlt(index, total, current.caption)}
							className="aspect-4/3 w-full rounded-lg object-contain"
							height={1536}
							src={current.src ?? photoUrl(current.photoHash)}
							width={2048}
						/>
						{current.caption ? (
							<DialogDescription>{current.caption}</DialogDescription>
						) : null}
						<DialogActions>
							<Button
								aria-label="Foto anterior"
								disabled={total < 2}
								onClick={() => go(-1)}
								variant="outline"
							>
								<ChevronLeftIcon aria-hidden="true" />
							</Button>
							<Button
								aria-label="Próxima foto"
								disabled={total < 2}
								onClick={() => go(1)}
								variant="outline"
							>
								<ChevronRightIcon aria-hidden="true" />
							</Button>
							{current.downloadable === false ? null : (
								<ButtonLink
									download
									href={photoUrl(current.photoHash, true)}
									variant="outline"
								>
									Baixar
								</ButtonLink>
							)}
							<DialogClose render={<Button />}>Fechar</DialogClose>
						</DialogActions>
					</>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
