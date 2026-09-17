import { afterEach, describe, expect, test } from "bun:test";

import { sessionEnded } from "../src/lib/command-error";
import { uploadMedia } from "../src/lib/photo-capture";
import { captureFailure } from "../src/lib/photo-capture-error";

const realFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = realFetch;
});

const file = {
	blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }),
	hash: "a".repeat(64),
	type: "image/jpeg" as const,
};

function answer(status: number) {
	const calls: { init: RequestInit | undefined; url: string }[] = [];
	globalThis.fetch = ((url: string, init?: RequestInit) => {
		calls.push({ init, url });
		return Promise.resolve(new Response(null, { status }));
	}) as typeof fetch;
	return calls;
}

describe("uploadMedia", () => {
	test("puts the bytes on the hash route and resolves on 200 and 201", async () => {
		const calls = answer(201);
		await uploadMedia(file);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(`/api/media/${file.hash}`);
		expect(calls[0]?.init).toMatchObject({
			body: file.blob,
			credentials: "same-origin",
			method: "PUT",
		});
		answer(200);
		await expect(uploadMedia(file)).resolves.toBeUndefined();
	});

	test("carries the status so the screen ends the session or refuses a retry", async () => {
		answer(401);
		const unauthorized = await uploadMedia(file).catch(
			(error: unknown) => error
		);
		expect(sessionEnded(unauthorized)).toBe(true);
		const outcomes = await Promise.all(
			[412, 413, 415, 422, 500].map(async (status) => {
				answer(status);
				const error = await uploadMedia(file).catch(
					(failure: unknown) => failure
				);
				return [status, captureFailure(error).retry, sessionEnded(error)];
			})
		);
		expect(outcomes).toEqual([
			[412, true, false],
			[413, false, false],
			[415, false, false],
			[422, false, false],
			[500, true, false],
		]);
	});

	test("a network failure offers a new try without a status", async () => {
		globalThis.fetch = (() =>
			Promise.reject(
				new TypeError("Failed to fetch")
			)) as unknown as typeof fetch;
		const error = await uploadMedia(file).catch((failure: unknown) => failure);
		expect(error).toMatchObject({ kind: "upload", status: null });
		expect(captureFailure(error)).toEqual({
			message: "Não foi possível enviar a foto.",
			retry: true,
		});
	});
});
