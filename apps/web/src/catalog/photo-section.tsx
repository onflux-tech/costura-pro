import { FilePickerButton } from "@costura-pro/ui/components/file-picker-button";
import { Photo } from "@costura-pro/ui/components/photo";
import { PhotoTile } from "@costura-pro/ui/components/photo-tile";
import { CameraIcon, ImagesIcon } from "lucide-react";
import { useState } from "react";

import { CatalogSection } from "./catalog-section";

export function PhotoSection() {
	const [caption, setCaption] = useState("frente");
	const [chosen, setChosen] = useState(0);
	return (
		<CatalogSection heading="Fotos" id="fotos">
			<div className="flex flex-wrap items-start gap-3">
				<Photo
					alt="Logo"
					className="size-12 rounded-md"
					height={48}
					src="/logo.png"
					width={48}
				/>
				<Photo
					alt="Foto ausente"
					className="size-24 rounded-md"
					height={96}
					src="/sem-foto.webp"
					width={96}
				/>
				<PhotoTile
					alt="Foto 1 de 4: frente"
					captionField={{
						label: "Legenda da foto 1",
						maxLength: 40,
						onChange: setCaption,
						value: caption,
					}}
					onOpen={() => undefined}
					onRemove={() => undefined}
					removeLabel="Remover foto 1"
					src="/logo.png"
				/>
				<PhotoTile alt="Foto 2 de 4" src="/logo.png" status="uploading" />
				<PhotoTile
					alt="Foto 3 de 4"
					failure={{
						message: "Não foi possível enviar a foto.",
						onRetry: () => undefined,
					}}
					src="/logo.png"
					status="failed"
				/>
				<PhotoTile
					alt="Foto 4 de 4: barra"
					caption="barra"
					onOpen={() => undefined}
					src="/logo.png"
				/>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<FilePickerButton
					accept="image/jpeg,image/png,image/webp"
					capture="environment"
					onFiles={(files) => setChosen(files.length)}
					variant="dashed"
				>
					<CameraIcon aria-hidden="true" />
					Câmera
				</FilePickerButton>
				<FilePickerButton
					accept="image/jpeg,image/png,image/webp"
					multiple
					onFiles={(files) => setChosen(files.length)}
					variant="dashed"
				>
					<ImagesIcon aria-hidden="true" />
					{`Galeria (${chosen})`}
				</FilePickerButton>
				<FilePickerButton
					accept="image/jpeg"
					disabled
					onFiles={() => undefined}
					variant="dashed"
				>
					Escolher fotos
				</FilePickerButton>
			</div>
		</CatalogSection>
	);
}
