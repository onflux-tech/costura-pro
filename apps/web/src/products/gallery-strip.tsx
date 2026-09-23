import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { PhotoTile } from "@costura-pro/ui/components/photo-tile";
import { Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { photoUrl } from "@/lib/media";
import { type PhotoView, photoAlt } from "@/lib/photos";
import { PhotoViewer } from "@/photos/photo-viewer";

export function GalleryStrip({
	photos,
	productId,
}: {
	photos: readonly PhotoView[];
	productId: string;
}) {
	const [viewing, setViewing] = useState<number | null>(null);
	const openRefs = useRef(new Map<string, HTMLButtonElement>());
	const originRef = useRef<HTMLElement | null>(null);
	const total = photos.length;

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Galeria</PanelTitle>
				<PanelMeta>{String(total)}</PanelMeta>
			</PanelHeader>
			<PanelContent>
				{total === 0 ? (
					<div className="flex flex-wrap items-center gap-x-3">
						<Text tone="subtle">Sem fotos ainda.</Text>
						<ButtonLink
							className="h-auto min-h-11 px-0 md:min-h-0"
							render={
								<Link
									params={{ produtoId: productId }}
									to="/catalogo-produtos/produtos/$produtoId/editar"
								/>
							}
							variant="link"
						>
							Adicionar fotos
						</ButtonLink>
					</div>
				) : (
					<div className="flex flex-wrap items-start gap-3">
						{photos.map((photo, index) => (
							<PhotoTile
								alt={`Abrir ${photoAlt(index, total, photo.caption)}`}
								caption={photo.caption}
								key={photo.photoHash}
								onOpen={() => {
									originRef.current =
										openRefs.current.get(photo.photoHash) ?? null;
									setViewing(index);
								}}
								openRef={(element) => {
									if (element) {
										openRefs.current.set(photo.photoHash, element);
									} else {
										openRefs.current.delete(photo.photoHash);
									}
								}}
								src={photoUrl(photo.thumbnailHash)}
							/>
						))}
					</div>
				)}
			</PanelContent>
			<PhotoViewer
				index={viewing}
				onIndexChange={setViewing}
				onOpenChange={(open) => {
					if (!open) {
						setViewing(null);
					}
				}}
				photos={photos}
				returnFocus={originRef}
			/>
		</Panel>
	);
}
