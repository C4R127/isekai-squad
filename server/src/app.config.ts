import { defineRoom, defineServer } from "colyseus";
import { ROOM_NAME } from "@isekai/shared";
import { LevelRoom } from "./rooms/LevelRoom";

export default defineServer({
  rooms: {
    [ROOM_NAME]: defineRoom(LevelRoom),
  },
  express: (app) => {
    // Sirve para comprobar que el servidor está despierto.
    app.get("/health", (_req, res) => {
      res.send("ok");
    });
  },
});
