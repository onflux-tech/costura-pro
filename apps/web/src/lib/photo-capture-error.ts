import { uploadFailure } from "./photos";

export type PhotoCaptureKind = "decode" | "encode" | "tooLarge" | "upload";

export class PhotoCaptureError extends Error {
	readonly kind: PhotoCaptureKind;
	readonly status: number | null;

	constructor(kind: PhotoCaptureKind, status: number | null = null) {
		super(kind);
		this.name = "PhotoCaptureError";
		this.kind = kind;
		this.status = status;
	}
}

const localFailures: Record<Exclude<PhotoCaptureKind, "upload">, string> = {
	decode:
		"Não foi possível abrir esta foto neste navegador. Use JPEG, PNG ou WebP, ou tire pela câmera.",
	encode: "Não foi possível otimizar esta foto. Tente outra.",
	tooLarge: "A foto ficou maior que 4 MB mesmo otimizada.",
};

export function captureFailure(error: unknown): {
	message: string;
	retry: boolean;
} {
	if (!(error instanceof PhotoCaptureError)) {
		return { message: "Não foi possível preparar a foto.", retry: false };
	}
	return error.kind === "upload"
		? uploadFailure(error.status)
		: { message: localFailures[error.kind], retry: false };
}
