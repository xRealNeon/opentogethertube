import { Room } from "./room";
import { AuthToken, RoomOptions, RoomState, RoomStatePersistable } from "../common/models/types";
import { ROOM_REQUEST_CHANNEL_PREFIX } from "../common/constants";
import _ from "lodash";
import NanoTimer from "nanotimer";
import { getLogger } from "./logger.js";
import { redisClientAsync, createSubscriber } from "./redisclient";
import storage from "./storage";
import { RoomAlreadyLoadedException, RoomNameTakenException, RoomNotFoundException } from "./exceptions";
import { RoomRequest, RoomRequestContext } from "common/models/messages";
// WARN: do NOT import clientmanager

export const log = getLogger("roommanager");
const redisSubscriber = createSubscriber();
export const rooms: Room[] = [];

function addRoom(room: Room) {
	rooms.push(room);
}

export async function start() {
	const keys = await redisClientAsync.keys("room:*");
	for (const roomKey of keys) {
		const text = await redisClientAsync.get(roomKey);
		if (!text) {
			continue;
		}
		const state = JSON.parse(text) as RoomState;
		const room = new Room(state);
		addRoom(room);
	}
	log.info(`Loaded ${keys.length} rooms from redis`);

	const nanotimer = new NanoTimer();
	nanotimer.setInterval(update, '', '1000m');
}

export async function update(): Promise<void> {
	for (const room of rooms) {
		await room.update();
		await room.sync();

		if (room.isStale) {
			await UnloadRoom(room.name);
		}
	}
}

export async function CreateRoom(options: Partial<RoomOptions> & { name: string }): Promise<void> {
	for (const room of rooms) {
		if (options.name.toLowerCase() === room.name.toLowerCase()) {
			log.warn("can't create room, already loaded");
			throw new RoomNameTakenException(options.name);
		}
	}
	if (await redisClientAsync.exists(`room:${options.name}`)) {
		log.warn("can't create room, already in redis");
		throw new RoomNameTakenException(options.name);
	}
	if (await storage.isRoomNameTaken(options.name)) {
		log.warn("can't create room, already exists in database");
		throw new RoomNameTakenException(options.name);
	}
	const room = new Room(options);
	if (!room.isTemporary) {
		await storage.saveRoom(room);
	}
	await room.update();
	await room.sync();
	addRoom(room);
	log.info(`Room created: ${room.name}`);
}

/**
 * Get a room by name, or load it from storage if it's not loaded.
 * @param roomName
 * @param options
 * @param options.mustAlreadyBeLoaded If true, will throw if the room is not already loaded in the current Node.
 * @returns
 */
export async function GetRoom(roomName: string, options: { mustAlreadyBeLoaded?: boolean }={}): Promise<Room> {
	_.defaults(options, {
		mustAlreadyBeLoaded: false
	});
	for (const room of rooms) {
		if (room.name.toLowerCase() === roomName.toLowerCase()) {
			log.debug("found room in room manager");
			return room;
		}
	}

	if (options.mustAlreadyBeLoaded) {
		throw new RoomNotFoundException(roomName);
	}

	const opts = await storage.getRoomByName(roomName) as RoomStatePersistable;
	if (opts) {
		if (await redisClientAsync.exists(`room:${opts.name}`)) {
			log.debug("found room in database, but room is already in redis");
			throw new RoomAlreadyLoadedException(opts.name);
		}
	}
	else {
		if (await redisClientAsync.exists(`room:${roomName}`)) {
			log.debug("found room in redis, not loading");
			throw new RoomAlreadyLoadedException(roomName);
		}
		log.debug("room not found in room manager, nor redis, nor database");
		throw new RoomNotFoundException(roomName);
	}
	const room = new Room(opts);
	addRoom(room);
	return room;
}

export async function UnloadRoom(roomName: string): Promise<void> {
	log.info(`Unloading stale room: ${roomName}`);
	let idx = -1;
	for (let i = 0; i < rooms.length; i++) {
		if (rooms[i].name.toLowerCase() === roomName.toLowerCase()) {
			idx = i;
			break;
		}
	}
	if (idx >= 0) {
		await rooms[idx].onBeforeUnload();
	}
	else {
		throw new RoomNotFoundException(roomName);
	}
	rooms.splice(idx, 1);
	await redisClientAsync.del(`room:${roomName}`);
	await redisClientAsync.del(`room-sync:${roomName}`);
}

/**
 * Clear all rooms off of this node.
 * Does not "unload" rooms. Intended to only be used in tests.
 */
export function clearRooms(): void {
	while (rooms.length > 0) {
		rooms.shift();
	}
}

/** Unload all rooms off of this node. Intended to only be used in tests. */
export async function unloadAllRooms(): Promise<void> {
	const names = rooms.map(r => r.name);
	await Promise.all(names.map(UnloadRoom));
}

export async function remoteRoomRequestHandler(channel: string, text: string) {
	if (!channel.startsWith(`${ROOM_REQUEST_CHANNEL_PREFIX}:`)) {
		return;
	}
	let roomName = channel.split(":")[1];
	try {
		// HACK: using roommanager.GetRoom() here instead of just GetRoom() so it can be mocked in tests
		let room = await roommanager.GetRoom(roomName, { mustAlreadyBeLoaded: true });
		let requestUnauthorized = JSON.parse(text) as { request: RoomRequest; token: AuthToken; };
		await room.processUnauthorizedRequest(requestUnauthorized.request, {
			token: requestUnauthorized.token,
		});
	}
	catch (e) {
		if (e instanceof RoomNotFoundException) {
			// Room not found on this Node, ignore
		}
		else {
			log.error(`Failed to process room request: ${e.name} ${e.message} ${e.stack}`);
		}
	}
}

redisSubscriber.on("message", remoteRoomRequestHandler);

const roommanager = {
	rooms,
	log,
	start,

	CreateRoom,
	GetRoom,
	UnloadRoom,
	clearRooms,
	unloadAllRooms,
	remoteRoomRequestHandler,
}

export default roommanager;
