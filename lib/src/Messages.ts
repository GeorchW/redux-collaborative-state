import { AnyAction } from "@reduxjs/toolkit";
import { Operation } from "fast-json-patch";


export interface ClientIdentificationMessage {
    sessionId?: string,
    clientId?: string
}

export interface ClientInitializationMessage<TState> {
    sessionId: string,
    clientId: string,
    initialState: TState,
    // TODO: maybe allow for some kind of greeting
}

export interface PatchesMessage {
    type: "patches"
    patches: Operation[];
}

export interface ActionMessage {
    type: "action",
    action: AnyAction
}

export interface PingMessage {
    type: "ping",
}
export interface PongMessage {
    type: "pong",
}

export type ClientMessage = PingMessage | ActionMessage;
export type ServerMessage = PongMessage | PatchesMessage;
