import { Badge } from "@costura-pro/ui/components/badge";
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
import { Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";

import { photoUrl } from "@/lib/media";
import type { PhotoView } from "@/lib/photos";

export function CoverDialog({
	coverPhotoHash,
	onChoose,
	onOpenChange,
	open,
	photos,
	productId,
}: {
	coverPhotoHash: string | null;
	onChoose: (photoHash: string | null) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	photos: readonly PhotoView[];
	productId: string;
}) {
	const choose = (photoHash: string | null) => {
		onChoose(photoHash);
		onOpenChange(false);
	};
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<div className="flex flex-col gap-4">
					<DialogTitle>Capa da variante</DialogTitle>
					<DialogDescription>
						A capa substitui só a imagem principal do produto nesta variante.
					</DialogDescription>
					{photos.length === 0 ? (
						<div className="flex flex-col items-start gap-1">
							<Text tone="subtle">
								Adicione fotos na galeria do produto para escolher uma capa.
							</Text>
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
								Editar a galeria
							</ButtonLink>
						</div>
					) : (
						<div className="flex flex-wrap gap-3">
							{photos.map((photo, index) => {
								const chosen = photo.photoHash === coverPhotoHash;
								return (
									<div
										className="flex w-24 flex-col items-center gap-1"
										key={photo.photoHash}
									>
										<Button
											aria-label={`Usar a foto ${index + 1} como capa`}
											aria-pressed={chosen}
											className="size-24 overflow-hidden p-0"
											onClick={() => choose(photo.photoHash)}
											type="button"
											variant="outline"
										>
											<Photo
												alt=""
												className="size-full"
												height={192}
												src={photoUrl(photo.thumbnailHash)}
												width={192}
											/>
										</Button>
										{chosen ? <Badge tone="success">capa</Badge> : null}
									</div>
								);
							})}
						</div>
					)}
					<DialogActions>
						<Button
							disabled={coverPhotoHash === null}
							onClick={() => choose(null)}
							type="button"
							variant="outline"
						>
							Sem capa (usa a imagem principal)
						</Button>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Fechar
						</DialogClose>
					</DialogActions>
				</div>
			</DialogContent>
		</Dialog>
	);
}
