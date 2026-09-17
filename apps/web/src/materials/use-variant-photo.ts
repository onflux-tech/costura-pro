import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { sessionEnded } from "@/lib/command-error";
import type { VariantPhotoView } from "@/lib/materials";
import { photoUrl } from "@/lib/media";
import {
	type PreparedPhoto,
	preparePhoto,
	uploadMedia,
} from "@/lib/photo-capture";
import { captureFailure } from "@/lib/photo-capture-error";
import { sessionQuery } from "@/lib/session";

export type VariantPhotoStatus = "empty" | "failed" | "ready" | "uploading";

export type VariantPhotoFailure = { message: string; retry: boolean };

export type VariantPhoto = {
	blocked: boolean;
	discard: () => void;
	failure: VariantPhotoFailure | null;
	photo: VariantPhotoView | null;
	pick: (files: readonly File[]) => Promise<void>;
	preview: string | null;
	remove: () => void;
	retry: () => Promise<void>;
	status: VariantPhotoStatus;
};

const previewOf = (photo: VariantPhotoView | null) =>
	photo ? photoUrl(photo.thumbnailHash) : null;

export function useVariantPhoto(
	initial: VariantPhotoView | null
): VariantPhoto {
	const queryClient = useQueryClient();
	const [photo, setPhoto] = useState<VariantPhotoView | null>(initial);
	const [preview, setPreview] = useState<string | null>(previewOf(initial));
	const [pending, setPending] = useState<PreparedPhoto | null>(null);
	const [status, setStatus] = useState<VariantPhotoStatus>(
		initial ? "ready" : "empty"
	);
	const [failure, setFailure] = useState<VariantPhotoFailure | null>(null);
	const objectUrls = useRef(new Set<string>());

	useEffect(() => {
		const urls = objectUrls.current;
		return () => {
			for (const url of urls) {
				URL.revokeObjectURL(url);
			}
		};
	}, []);

	const send = useCallback(
		async (ready: PreparedPhoto) => {
			setStatus("uploading");
			setFailure(null);
			try {
				await uploadMedia(ready.photo);
				await uploadMedia(ready.thumbnail);
			} catch (error) {
				if (sessionEnded(error)) {
					await queryClient.invalidateQueries({
						queryKey: sessionQuery.queryKey,
					});
				}
				setFailure(captureFailure(error));
				setStatus("failed");
				return;
			}
			setPhoto({
				photoHash: ready.photo.hash,
				thumbnailHash: ready.thumbnail.hash,
			});
			setPending(null);
			setStatus("ready");
		},
		[queryClient]
	);

	const pick = useCallback(
		async (files: readonly File[]) => {
			const [file] = files;
			if (!file) {
				return;
			}
			setStatus("uploading");
			setFailure(null);
			let ready: PreparedPhoto;
			try {
				ready = await preparePhoto(file);
			} catch (error) {
				setPending(null);
				setFailure(captureFailure(error));
				setStatus("failed");
				return;
			}
			const url = URL.createObjectURL(ready.thumbnail.blob);
			objectUrls.current.add(url);
			setPending(ready);
			setPreview(url);
			await send(ready);
		},
		[send]
	);

	const retry = useCallback(async () => {
		if (pending) {
			await send(pending);
		}
	}, [pending, send]);

	const discard = useCallback(() => {
		setPending(null);
		setPreview(previewOf(photo));
		setFailure(null);
		setStatus(photo ? "ready" : "empty");
	}, [photo]);

	const remove = useCallback(() => {
		setPending(null);
		setPreview(null);
		setPhoto(null);
		setFailure(null);
		setStatus("empty");
	}, []);

	return {
		blocked: status === "failed" || status === "uploading",
		discard,
		failure,
		photo,
		pick,
		preview,
		remove,
		retry,
		status,
	};
}
