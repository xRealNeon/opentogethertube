import dayjs from "dayjs";
import tokens from "../../../server/auth/tokens";
import { RoomRequestType } from "../../../common/models/messages";
import { QueueMode, Role } from "../../../common/models/types";
import { Room, RoomUser } from "../../../server/room";
import infoextractor from "../../../server/infoextractor";
import { Video } from "../../../common/models/video";
import permissions from "../../../common/permissions";

describe("Room", () => {
	beforeAll(() => {
		jest.spyOn(tokens, 'getSessionInfo').mockResolvedValue({
			username: "test",
			isLoggedIn: false,
		});
		jest.spyOn(tokens, 'validate').mockResolvedValue(true);
	});

	afterAll(() => {
		tokens.getSessionInfo.mockRestore();
		tokens.validate.mockRestore();
	});

	it("should control playback with play/pause", async () => {
		const room = new Room({ name: "test" });
		await room.play();
		expect(room.isPlaying).toEqual(true);
		await room.play();
		await room.pause();
		expect(room.isPlaying).toEqual(false);
		await room.pause();
	});

	describe("Room Requests", () => {
		let room: Room;
		let user: RoomUser;

		beforeEach(() => {
			user = new RoomUser("user");
			user.token = "asdf1234";
			room = new Room({ name: "test" });
			room.realusers = [user];
			// because we aren't testing the permission system, grant all the permissions
			room.grants.setRoleGrants(Role.UnregisteredUser, permissions.parseIntoGrantMask(["*"]));
		});

		describe("PlaybackRequest", () => {
			it("should play and pause", async () => {
				await room.processUnauthorizedRequest({
					type: RoomRequestType.PlaybackRequest,
					state: true,
				}, { token: user.token });
				expect(room.isPlaying).toEqual(true);
				await room.processUnauthorizedRequest({
					type: RoomRequestType.PlaybackRequest,
					state: false,
				}, { token: user.token });
				expect(room.isPlaying).toEqual(false);
			});

			it("should advance playback position", async () => {
				room.isPlaying = true;
				room._playbackStart = dayjs().subtract(5, "second");
				await room.processUnauthorizedRequest({
					type: RoomRequestType.PlaybackRequest,
					state: false,
				}, { token: user.token });
				expect(room.isPlaying).toEqual(false);
				expect(room.playbackPosition).toBeCloseTo(5, 1);
				expect(room.playbackPosition).toBeGreaterThanOrEqual(5);
			});
		});

		describe("SkipRequest", () => {
			beforeEach(() => {
				room.currentSource = {
					service: "test",
					id: "video",
				};
			});

			it("skip with empty queue", async () => {
				await room.processUnauthorizedRequest({
					type: RoomRequestType.SkipRequest,
				}, { token: user.token });
				expect(room.currentSource).toBeNull();
			});

			it("skip with non-empty queue", async () => {
				room.queue = [
					{
						service: "test",
						id: "video2",
					},
				];
				await room.processUnauthorizedRequest({
					type: RoomRequestType.SkipRequest,
				}, { token: user.token });
				expect(room.currentSource).toEqual({
					service: "test",
					id: "video2",
				});
			});
		});

		describe("SeekRequest", () => {
			it("should seek", async () => {
				room.playbackPosition = 10;
				await room.processUnauthorizedRequest({
					type: RoomRequestType.SeekRequest,
					value: 15,
				}, { token: user.token });
				expect(room.playbackPosition).toEqual(15);
			});

			it.each([undefined, null])("should not seek if value is %s", async (v) => {
				room.playbackPosition = 10;
				await room.processUnauthorizedRequest({
					type: RoomRequestType.SeekRequest,
					value: v as unknown as number,
				}, { token: user.token });
				expect(room.playbackPosition).toEqual(10);
			});
		});

		describe("PlayNowRequest", () => {
			const videoToPlay: Video = {
				service: "test",
				id: "video",
				title: "play me now",
				description: "test",
				thumbnail: "test",
				length: 10,
			};

			it("should place the requested video in currentSource", async () => {
				jest.spyOn(infoextractor, 'getVideoInfo').mockResolvedValue(videoToPlay);
				await room.processUnauthorizedRequest({
					type: RoomRequestType.PlayNowRequest,
					video: videoToPlay,
				}, { token: user.token });
				expect(room.currentSource).toEqual(videoToPlay);
			});

			it("should remove the video from the queue", async () => {
				jest.spyOn(infoextractor, 'getVideoInfo').mockResolvedValue(videoToPlay);
				room.currentSource = {
					service: "test",
					id: "asdf123",
				};
				room.queue = [videoToPlay];
				await room.processUnauthorizedRequest({
					type: RoomRequestType.PlayNowRequest,
					video: videoToPlay,
				}, { token: user.token });
				for (const video of room.queue) {
					expect(video).not.toEqual(videoToPlay);
				}
				expect(room.currentSource).toEqual(videoToPlay);
			});

			it("should push the currently playing video into the queue", async () => {
				jest.spyOn(infoextractor, 'getVideoInfo').mockResolvedValue(videoToPlay);
				room.currentSource = {
					service: "test",
					id: "asdf123",
				};
				room.queue = [videoToPlay];
				await room.processUnauthorizedRequest({
					type: RoomRequestType.PlayNowRequest,
					video: videoToPlay,
				}, { token: user.token });
				expect(room.queue[0]).toEqual({
					service: "test",
					id: "asdf123",
				});
				for (const video of room.queue) {
					expect(video).not.toEqual(videoToPlay);
				}
				expect(room.currentSource).toEqual(videoToPlay);
			});

			it("should reset playback position to 0", async () => {
				jest.spyOn(infoextractor, 'getVideoInfo').mockResolvedValue(videoToPlay);
				room.currentSource = {
					service: "test",
					id: "asdf123",
				};
				room.playbackPosition = 10;
				room.queue = [videoToPlay];
				await room.processUnauthorizedRequest({
					type: RoomRequestType.PlayNowRequest,
					video: videoToPlay,
				}, { token: user.token });
				expect(room.currentSource).toEqual(videoToPlay);
				expect(room.playbackPosition).toEqual(0);
			});
		});

		describe("VoteRequest", () => {
			it("should only cast one vote when a video is voted for the first time", async() => {
				await room.processRequest({
					type: RoomRequestType.VoteRequest,
					video: { service: "fakeservice", id: "abc123" },
					add: true,
				}, { username:"test", role: Role.Owner, clientId: "1234" });
				expect(Array.from(room.votes.get("fakeserviceabc123")!)).toEqual(["1234"]);
			});
		});

		describe("ShuffleRequest", () => {
			beforeEach(() => {
				room.queue = [
					{ service: "fakeservice", id: "video1" },
					{ service: "fakeservice", id: "video2" },
					{ service: "fakeservice", id: "video3" },
					{ service: "fakeservice", id: "video4" },
					{ service: "fakeservice", id: "video5" },
				];
			});
			it("should not leave videos in the same order", async() => {
				await room.processRequest({
					type: RoomRequestType.ShuffleRequest,
				}, { username:"test", role: Role.Owner, clientId: "1234" });
				expect(room.queue).not.toEqual([
					{ service: "fakeservice", id: "video1" },
					{ service: "fakeservice", id: "video2" },
					{ service: "fakeservice", id: "video3" },
					{ service: "fakeservice", id: "video4" },
					{ service: "fakeservice", id: "video5" },
				]);
				expect(room.queue).toHaveLength(5);
			});
		});

	});

	describe("auto dequeuing next video", () => {
		let room: Room;

		beforeEach(() => {
			room = new Room({ name: "test" });
			room.currentSource = {
				service: "test",
				id: "video",
			};
			room.queue = [
				{
					service: "test",
					id: "video2",
				},
			];
		});

		it.each([QueueMode.Manual, QueueMode.Vote])("should consume the current item when mode is %s", (mode) => {
			room.queueMode = mode;
			room.dequeueNext();
			expect(room.currentSource).toEqual({
				service: "test",
				id: "video2",
			});
			expect(room.queue).toHaveLength(0);
		});

		it.each([QueueMode.Loop])("should requeue the current item when mode is %s", (mode) => {
			room.queueMode = mode;
			room.dequeueNext();
			expect(room.currentSource).toEqual({
				service: "test",
				id: "video2",
			});
			expect(room.queue).toHaveLength(1);
			expect(room.queue[0]).toEqual({
				service: "test",
				id: "video",
			});
		});

		it.each([QueueMode.Dj])("should restart the current item when mode is %s", (mode) => {
			room.queueMode = mode;
			room.playbackPosition = 10;
			room.dequeueNext();
			expect(room.currentSource).toEqual({
				service: "test",
				id: "video",
			});
			expect(room.playbackPosition).toEqual(0);
			expect(room.queue).toHaveLength(1);
			expect(room.queue[0]).toEqual({
				service: "test",
				id: "video2",
			});
		});

		it.each([QueueMode.Loop])("should requeue the current item when mode is %s, with empty queue", (mode) => {
			room.queueMode = mode;
			room.queue = [];
			expect(room.queue).toHaveLength(0);
			room.dequeueNext();
			expect(room.currentSource).toEqual({
				service: "test",
				id: "video",
			});
			expect(room.queue).toHaveLength(0);
		});
	});

	it("should be able to get role in unowned room", async () => {
		jest.spyOn(tokens, 'getSessionInfo').mockResolvedValue({
			username: "test",
			isLoggedIn: false,
		});

		const room = new Room({ name: "test" });
		expect(await room.getRoleFromToken("fake")).toEqual(Role.UnregisteredUser);

		jest.spyOn(tokens, 'getSessionInfo').mockResolvedValue({
			user_id: -1,
			isLoggedIn: true,
		});

		expect(await room.getRoleFromToken("fake")).toEqual(Role.RegisteredUser);
	});
});
