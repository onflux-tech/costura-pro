import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { sessionEnded } from "@/lib/command-error";
import {
	type PreparedPhoto,
	preparePhoto,
	uploadMedia,
} from "@/lib/photo-capture";
import { captureFailure } from "@/lib/photo-capture-error";
import {
	acceptedFiles,
	excessNotice,
	photoUrl,
	type ReceivedItemPhotoView,
	repeatedNotice,
	withoutRepeatedPhotos,
} from "@/lib/received-items";
import { sessionQuery } from "@/lib/session";

import type { ViewerPhoto } from "./photo-viewer";

export type PhotoDraftStatus = "failed" | "ready" | "uploading";

export type PhotoDraft = {
	caption: string;
	failure: string | null;
	photoHash: string;
	photoPreview: string | null;
	prepared: PreparedPhoto | null;
	preview: string;
	retry: boolean;
	status: PhotoDraftStatus;
	thumbnailHash: string;
};

type Preparation = { failures: string[]; prepared: PreparedPhoto[] };

function savedDraft(photo: ReceivedItemPhotoView): PhotoDraft {
	return {
		caption: photo.caption ?? "",
		failure: null,
		photoHash: photo.photoHash,
		photoPreview: null,
		prepared: null,
		preview: photoUrl(photo.thumbnailHash),
		retry: false,
		status: "ready",
		thumbnailHash: photo.thumbnailHash,
	};
}

function prepareAll(files: readonly File[]): Promise<Preparation> {
	return files.reduce<Promise<Preparation>>(
		async (previous, file) => {
			const done = await previous;
			try {
				return {
					...done,
					prepared: [...done.prepared, await preparePhoto(file)],
				};
			} catch (error) {
				return {
					...done,
					failures: [...done.failures, captureFailure(error).message],
				};
			}
		},
		Promise.resolve({ failures: [], prepared: [] })
	);
}

export function usePhotoDrafts(initial: readonly ReceivedItemPhotoView[]) {
	const queryClient = useQueryClient();
	const [drafts, setDrafts] = useState<PhotoDraft[]>(() =>
		initial.map(savedDraft)
	);
	const [notices, setNotices] = useState<string[]>([]);
	const [preparing, setPreparing] = useState(false);
	const latest = useRef(drafts);
	latest.current = drafts;
	const previews = useRef(new Set<string>());

	useEffect(() => {
		const urls = previews.current;
		return () => {
			for (const url of urls) {
				URL.revokeObjectURL(url);
			}
		};
	}, []);

	const update = useCallback(
		(photoHash: string, change: Partial<PhotoDraft>) =>
			setDrafts((current) =>
				current.map((draft) =>
					draft.photoHash === photoHash ? { ...draft, ...change } : draft
				)
			),
		[]
	);

	const upload = useCallback(
		async (draft: PhotoDraft) => {
			if (!draft.prepared) {
				return;
			}
			update(draft.photoHash, { failure: null, status: "uploading" });
			try {
				await uploadMedia(draft.prepared.photo);
				await uploadMedia(draft.prepared.thumbnail);
				update(draft.photoHash, { status: "ready" });
			} catch (error) {
				if (sessionEnded(error)) {
					await queryClient.invalidateQueries({
						queryKey: sessionQuery.queryKey,
					});
				}
				const failure = captureFailure(error);
				update(draft.photoHash, {
					failure: failure.message,
					retry: failure.retry,
					status: "failed",
				});
			}
		},
		[queryClient, update]
	);

	const add = useCallback(
		async (files: readonly File[]) => {
			const { accepted, ignored } = acceptedFiles(files, latest.current.length);
			setPreparing(true);
			const result = await prepareAll(accepted).finally(() =>
				setPreparing(false)
			);
			const { added, repeated } = withoutRepeatedPhotos(
				latest.current,
				result.prepared.map((prepared) => ({
					photoHash: prepared.photo.hash,
					prepared,
				}))
			);
			const fresh = added.map(({ prepared }): PhotoDraft => {
				const preview = URL.createObjectURL(prepared.thumbnail.blob);
				const photoPreview = URL.createObjectURL(prepared.photo.blob);
				previews.current.add(preview);
				previews.current.add(photoPreview);
				return {
					caption: "",
					failure: null,
					photoHash: prepared.photo.hash,
					photoPreview,
					prepared,
					preview,
					retry: false,
					status: "uploading",
					thumbnailHash: prepared.thumbnail.hash,
				};
			});
			setDrafts((current) => [...current, ...fresh]);
			setNotices([
				...(ignored > 0 ? [excessNotice(ignored)] : []),
				...(repeated > 0 ? [repeatedNotice(repeated)] : []),
				...new Set(result.failures),
			]);
			await fresh.reduce<Promise<void>>(async (previous, draft) => {
				await previous;
				await upload(draft);
			}, Promise.resolve());
		},
		[upload]
	);

	const remove = useCallback((photoHash: string) => {
		setDrafts((current) =>
			current.filter((draft) => draft.photoHash !== photoHash)
		);
	}, []);

	const retry = useCallback(
		(photoHash: string) => {
			const draft = latest.current.find((item) => item.photoHash === photoHash);
			if (draft) {
				upload(draft);
			}
		},
		[upload]
	);

	const setCaption = useCallback(
		(photoHash: string, caption: string) => update(photoHash, { caption }),
		[update]
	);

	const reset = useCallback((photos: readonly ReceivedItemPhotoView[]) => {
		setDrafts(photos.map(savedDraft));
		setNotices([]);
	}, []);

	return {
		add,
		busy: preparing || drafts.some((draft) => draft.status !== "ready"),
		drafts,
		notices,
		photos: drafts.map(
			(draft): ReceivedItemPhotoView => ({
				caption: draft.caption.trim() === "" ? null : draft.caption.trim(),
				photoHash: draft.photoHash,
				thumbnailHash: draft.thumbnailHash,
			})
		),
		preparing,
		remove,
		reset,
		retry,
		setCaption,
		viewerPhotos: drafts.map(
			(draft): ViewerPhoto => ({
				caption: draft.caption.trim() === "" ? null : draft.caption.trim(),
				downloadable: draft.status === "ready",
				photoHash: draft.photoHash,
				src: draft.photoPreview ?? undefined,
				thumbnailHash: draft.thumbnailHash,
			})
		),
	};
}

export type PhotoDrafts = ReturnType<typeof usePhotoDrafts>;
