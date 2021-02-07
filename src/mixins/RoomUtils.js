import { API } from "@/common-http.js";

export default {
	data() {
		return {
			isLoadingCreateRoom: false,
			cancelledRoomCreation: false,
		};
	},
	created() {
		this.$events.on("onRoomCreated", this.onRoomCreated);
	},
	methods: {
		createTempRoom() {
			this.isLoadingCreateRoom = true;
			this.cancelledRoomCreation = false;
			return API.post("/room/generate").then(res => {
				if (!this.cancelledRoomCreation) {
					this.isLoadingCreateRoom = false;
					this.cancelledRoomCreation = false;
					this.$events.fire("onRoomCreated", res.data.room);
				}
			}).catch(err => {
				console.error(err);
				this.$events.emit("notify_onError", { message: `Failed to create a new temporary room` });
				throw err;
			});
		},
		createPermRoom(options) {
			this.isLoadingCreateRoom = true;
			this.cancelledRoomCreation = false;
			return API.post(`/room/create`, {
				...options,
				temporary: false,
			}).then(() => {
				if (!this.cancelledRoomCreation) {
					this.isLoadingCreateRoom = false;
					this.cancelledRoomCreation = false;
					this.$events.fire("onRoomCreated", options.name);
				}
			}).catch(err => {
				this.isLoadingCreateRoom = false;
				console.error(err);
				this.$events.emit("notify_onError", { message: `Failed to create a new room` });
				throw err;
			});
		},
		cancelRoom() {
			this.cancelledRoomCreation = true;
			this.isLoadingCreateRoom = false;
		},
		onRoomCreated(roomName) {
			this.$router.push(`/room/${roomName}`);
		},
	},
};
