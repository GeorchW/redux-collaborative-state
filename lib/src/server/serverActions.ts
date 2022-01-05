import { createAction } from "@reduxjs/toolkit";

/** An action that is fired when a client connects to the session. */
export const clientConnected = createAction<string>("clientConnected");
/** An action that is fired when a client disconnects from the session. */
export const clientDisconnected = createAction<string>("clientDisconnected");
