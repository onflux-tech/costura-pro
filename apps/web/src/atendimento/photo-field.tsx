import { receivedItemLimits } from "@costura-pro/domain/received-item";
import { Alert, AlertDescription } from "@costura-pro/ui/components/alert";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { FilePickerButton } from "@costura-pro/ui/components/file-picker-button";
import { PhotoTile } from "@costura-pro/ui/components/photo-tile";
import { Text } from "@costura-pro/ui/components/typography";
import { CameraIcon, ImagesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { photoAccept, photoAlt } from "@/lib/received-items";

import { PhotoViewer } from "./photo-viewer";
import type { PhotoDrafts } from "./use-photo-drafts";

function usesTouch(): boolean {
	return window.matchMedia("(pointer: coarse)").matches;
}

export function PhotoField({
	disabled,
	focusPicker = false,
	photos,
}: {
	disabled: boolean;
	focusPicker?: boolean;
	photos: PhotoDrafts;
}) {
	const [touch] = useState(usesTouch);
	const [viewing, setViewing] = useState<number | null>(null);
	const addRef = useRef<HTMLButtonElement>(null);
	const openRefs = useRef(new Map<string, HTMLButtonElement>());
	const originRef = useRef<HTMLElement | null>(null);
	const total = photos.drafts.length;
	const pickerDisabled =
		disabled || photos.preparing || total >= receivedItemLimits.photos;

	useEffect(() => {
		if (focusPicker) {
			addRef.current?.focus();
		}
	}, [focusPicker]);

	const removeAt = (index: number) => {
		const current = photos.drafts[index];
		if (!current) {
			return;
		}
		const next = photos.drafts[index + 1]?.photoHash;
		photos.remove(current.photoHash);
		requestAnimationFrame(() => {
			const target = next ? openRefs.current.get(next) : addRef.current;
			target?.focus();
		});
	};

	const pickers = touch ? (
		<>
			<FilePickerButton
				accept={photoAccept}
				capture="environment"
				disabled={pickerDisabled}
				onFiles={photos.add}
				ref={addRef}
				variant="dashed"
			>
				<CameraIcon aria-hidden="true" />
				Câmera
			</FilePickerButton>
			<FilePickerButton
				accept={photoAccept}
				disabled={pickerDisabled}
				multiple
				onFiles={photos.add}
				variant="dashed"
			>
				<ImagesIcon aria-hidden="true" />
				Galeria
			</FilePickerButton>
		</>
	) : (
		<FilePickerButton
			accept={photoAccept}
			disabled={pickerDisabled}
			multiple
			onFiles={photos.add}
			ref={addRef}
			variant="dashed"
		>
			<ImagesIcon aria-hidden="true" />
			Escolher fotos
		</FilePickerButton>
	);

	return (
		<Fieldset className="flex flex-col gap-3">
			<FieldsetLegend>Fotos de condição</FieldsetLegend>
			<Text size="xs" tone="muted">
				{`Opcional · até ${receivedItemLimits.photos} · otimizadas no aparelho`}
			</Text>
			<div className="flex flex-wrap items-start gap-3">
				{photos.drafts.map((draft, index) => (
					<PhotoTile
						alt={photoAlt(index, total, draft.caption.trim() || null)}
						captionField={{
							label: `Legenda da foto ${index + 1}`,
							maxLength: receivedItemLimits.caption,
							onChange: (value) => photos.setCaption(draft.photoHash, value),
							value: draft.caption,
						}}
						failure={
							draft.failure
								? {
										message: draft.failure,
										onRetry: draft.retry
											? () => photos.retry(draft.photoHash)
											: undefined,
									}
								: null
						}
						key={draft.photoHash}
						onOpen={() => {
							originRef.current = openRefs.current.get(draft.photoHash) ?? null;
							setViewing(index);
						}}
						onRemove={disabled ? undefined : () => removeAt(index)}
						openRef={(element) => {
							if (element) {
								openRefs.current.set(draft.photoHash, element);
							} else {
								openRefs.current.delete(draft.photoHash);
							}
						}}
						removeLabel={`Remover foto ${index + 1}`}
						src={draft.preview}
						status={draft.status}
					/>
				))}
			</div>
			<div className="flex flex-wrap gap-2">{pickers}</div>
			{photos.preparing ? (
				<Text role="status" size="xs" tone="muted">
					Otimizando fotos...
				</Text>
			) : null}
			{photos.notices.length > 0 ? (
				<Alert role="status" tone="warning">
					<AlertDescription>{photos.notices.join(" ")}</AlertDescription>
				</Alert>
			) : null}
			<PhotoViewer
				index={viewing}
				onIndexChange={setViewing}
				onOpenChange={(open) => {
					if (!open) {
						setViewing(null);
					}
				}}
				photos={photos.viewerPhotos}
				returnFocus={originRef}
			/>
		</Fieldset>
	);
}
