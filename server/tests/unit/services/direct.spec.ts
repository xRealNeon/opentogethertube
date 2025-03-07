jest.mock("../../../ffprobe");

import DirectVideoAdapter from "../../../services/direct";
import ffprobe from "../../../ffprobe";

describe("Direct", () => {
	describe("canHandleURL", () => {
		const supportedExtensions = [
			"mp4",
			"mp4v",
			"mpg4",
			"webm",
			"flv",
			"mkv",
			"avi",
			"wmv",
			"qt",
			"mov",
			"ogv",
			"m4v",
			"h264",
			"m3u",
			"m3u8",
			"ogg",
			"mp3",
		];

		const adapter = new DirectVideoAdapter();

		it.each(supportedExtensions)("Accepts %s links", (extension) => {
			const url = `https://example.com/test.${extension}`;
			expect(adapter.canHandleURL(url)).toBe(true);
		});

		const unsupportedExtensions = [
			"jpg",
			"jpeg",
			"png",
			"gif",
			"bmp",
			"tiff",
			"tif",
			"psd",
			"pdf",
			"doc",
			"docx",
			"xls",
			"xlsx",
			"ppt",
			"pptx",
			"zip",
			"rar",
			"7z",
			"tar",
			"gz",
			"mp3v",
			"wav",
		];

		it.each(unsupportedExtensions)("Rejects %s links", (extension) => {
			const url = `https://example.com/test.${extension}`;
			expect(adapter.canHandleURL(url)).toBe(false);
		});
	});

	describe("isCollectionURL", () => {
		const adapter = new DirectVideoAdapter();

		it("Always returns false because collections aren't supported", () => {
			const url = "https://example.com/test.mp4";
			expect(adapter.isCollectionURL(url)).toBe(false);
		});
	});

	describe("getVideoId", () => {
		const adapter = new DirectVideoAdapter();

		it("Returns the link itself as the ID", () => {
			const url = "https://example.com/test.mp4";
			expect(adapter.getVideoId(url)).toBe(url);
		});
	});

	describe("fetchVideoInfo", () => {
		const adapter = new DirectVideoAdapter();

		beforeEach(() => {
			const getFileInfoMock = jest.fn().mockResolvedValue({
				streams: [
					{
						codec_type: "video",
						duration: 100,
					},
				],
			});
			ffprobe.getFileInfo = getFileInfoMock;
		});

		it("Returns a promise", async () => {
			const url = "https://example.com/test.mp4";
			expect(adapter.fetchVideoInfo(url)).toBeInstanceOf(Promise);
		});

		it("Returns a video", async () => {
			const url = "https://example.com/test.mp4";
			const video = await adapter.fetchVideoInfo(url);
			expect(video).toMatchObject({
				id: url,
				length: 100,
			});
		});
	});
});
