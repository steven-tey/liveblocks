import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";
import { Presence, Storage, UserMeta } from "./types";

const client = createClient({
  authEndpoint: "/api/auth",
});

export const {
  suspense: {
    RoomProvider,
    useCanRedo,
    useCanUndo,
    useHistory,
    useOthers,
    useRoom,
    useSelf,
    useStorage,
  },
} = createRoomContext<Presence, Storage, UserMeta>(client);
