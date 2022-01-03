import { createAction } from "@reduxjs/toolkit";

export const clientConnected = createAction<string>("clientConnected");
export const clientDisconnected = createAction<string>("clientDisconnected");
