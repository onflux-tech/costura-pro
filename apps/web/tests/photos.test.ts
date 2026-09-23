import { describe, expect, test } from "bun:test";

import {
	captureFailure,
	PhotoCaptureError,
} from "../src/lib/photo-capture-error";
import {
	acceptedFiles,
	excessNotice,
	photoAlt,
	repeatedNotice,
	uploadFailure,
	withoutRepeatedPhotos,
} from "../src/lib/photos";

describe("fotos", () => {
	test("aceita só o espaço que sobra no limite e tira hashes repetidos, inclusive no mesmo lote", () => {
		expect(acceptedFiles([1, 2, 3, 4, 5], 10, 12)).toEqual({
			accepted: [1, 2],
			ignored: 3,
		});
		expect(acceptedFiles([1, 2, 3, 4, 5], 0, 12)).toEqual({
			accepted: [1, 2, 3, 4, 5],
			ignored: 0,
		});
		expect(acceptedFiles([1, 2, 3], 1, 3)).toEqual({
			accepted: [1, 2],
			ignored: 1,
		});
		expect(
			withoutRepeatedPhotos(
				[{ photoHash: "a" }],
				[{ photoHash: "a" }, { photoHash: "b" }, { photoHash: "b" }]
			)
		).toEqual({ added: [{ photoHash: "b" }], repeated: 2 });
	});

	test("oferece nova tentativa só quando ela pode dar certo", () => {
		expect(uploadFailure(null)).toEqual({
			message: "Não foi possível enviar a foto.",
			retry: true,
		});
		expect(uploadFailure(503).retry).toBe(true);
		expect(uploadFailure(415)).toEqual({
			message: "Esta foto não pôde ser aceita. Escolha outra.",
			retry: false,
		});
		expect(captureFailure(new PhotoCaptureError("decode")).message).toBe(
			"Não foi possível abrir esta foto neste navegador. Use JPEG, PNG ou WebP, ou tire pela câmera."
		);
		expect(captureFailure(new PhotoCaptureError("upload", 422)).retry).toBe(
			false
		);
	});

	test("os avisos contam as fotos de fora e dizem de quem é o limite", () => {
		expect(excessNotice(1, 12, "peça")).toBe(
			"Só cabem 12 fotos por peça; 1 ficou de fora."
		);
		expect(excessNotice(3, 12, "produto")).toBe(
			"Só cabem 12 fotos por produto; 3 ficaram de fora."
		);
		expect(repeatedNotice(1)).toBe("1 foto repetida ficou de fora.");
		expect(repeatedNotice(2)).toBe("2 fotos repetidas ficaram de fora.");
	});

	test("descreve a foto para o leitor de tela", () => {
		expect(photoAlt(1, 5, "barra")).toBe("Foto 2 de 5: barra");
		expect(photoAlt(0, 1, null)).toBe("Foto 1 de 1");
	});
});
