export type PhotoView = {
	caption: string | null;
	photoHash: string;
	thumbnailHash: string;
};

export const photoAccept = "image/jpeg,image/png,image/webp";

export function acceptedFiles<T>(
	files: readonly T[],
	count: number,
	limit: number
) {
	const room = Math.max(0, limit - count);
	return {
		accepted: files.slice(0, room),
		ignored: Math.max(0, files.length - room),
	};
}

export function withoutRepeatedPhotos<T extends { photoHash: string }>(
	current: readonly { photoHash: string }[],
	prepared: readonly T[]
): { added: T[]; repeated: number } {
	const seen = new Set(current.map((photo) => photo.photoHash));
	const added = prepared.filter((photo) => {
		if (seen.has(photo.photoHash)) {
			return false;
		}
		seen.add(photo.photoHash);
		return true;
	});
	return { added, repeated: prepared.length - added.length };
}

const refusedStatuses = new Set([413, 415, 422]);

export function uploadFailure(status: number | null): {
	message: string;
	retry: boolean;
} {
	return status !== null && refusedStatuses.has(status)
		? { message: "Esta foto não pôde ser aceita. Escolha outra.", retry: false }
		: { message: "Não foi possível enviar a foto.", retry: true };
}

export function photoAlt(
	index: number,
	total: number,
	caption: string | null
): string {
	const position = `Foto ${index + 1} de ${total}`;
	return caption ? `${position}: ${caption}` : position;
}

export function excessNotice(
	ignored: number,
	limit: number,
	owner: string
): string {
	const left = ignored === 1 ? "1 ficou" : `${ignored} ficaram`;
	return `Só cabem ${limit} fotos por ${owner}; ${left} de fora.`;
}

export function repeatedNotice(repeated: number): string {
	return repeated === 1
		? "1 foto repetida ficou de fora."
		: `${repeated} fotos repetidas ficaram de fora.`;
}
