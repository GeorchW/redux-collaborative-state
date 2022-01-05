import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ConnectionState = DisconnectedState | AttemptingConnectionState | ActiveSessionState;

/** Indicates that no connection to the server exists or is being attempted. */
export interface DisconnectedState {
    type: "disconnected";
}

/** 
 * Indicates that no connection to the server exists right now, but a connection
 * is currently being attempted to be established.
 **/
export interface AttemptingConnectionState {
    type: "attemptingConnection";
    /** 
     * The ID of the session to connect to. 
     * Will connect to a new session if undefined. 
     * */
    sessionId?: string;
    /**
     * The client ID to use. Will use a server-provided client ID if undefined.
     */
    clientId?: string;
    /** The number of times that a connection has been attempted before. */
    attempts: number;
}

/** Indicates that a connection has been established successfully. */
export interface ActiveSessionState {
    type: "active"
    /** The ID of the session that the client is connected to. */
    sessionId: string,
    /** The ID that the server is using to identify this client. */
    clientId: string,
    /** 
     * The time at which the last message was received, as returned by 
     * `Date.now()`. 
     **/
    lastMessageTime: number,
    /** The last round-trip time, in milliseconds. */
    ping: number,
    /** The time stamp at which the connection was established, as returned by
     * `Date.now()`.
     */
    connectedSince: number,
}

export interface ConnectActionPayload {
    /** The ID of the session that the client connected to. */
    sessionId: string,
    /** The ID used by the server to identify this client. */
    clientId: string,
    /** The initial state provided by the server. */
    initialState: any,
    /** 
     * The time that was needed to establish the connection and exchange the
     * neccessary data, in milliseconds.
     */
    initializationTime: number,
    /** 
     * The time stamp at which the connection was established, as returned by 
     * `Date.now()`.
     */
    connectedAt: number
}

export interface ReceiveStatePayload {
    /** The new state provided by the server. */
    state: any,
    /**
     * The time stamp that this state was received at, as returned by 
     * `Date.now()`. 
     **/
    receivedAt: number,
}
export interface ReceivePingPayload {
    /** The round-trip time of this ping in milliseconds. */
    pingTime: number,
    /**
     * The time stamp that this ping was received at, as returned by 
     * `Date.now()`. 
     **/
    receivedAt: number,
}

export const connectionSlice = createSlice({
    name: "connection",
    initialState: { type: "disconnected" } as ConnectionState,
    reducers: {
        attemptConnection(state, action: PayloadAction<{ sessionId?: string, clientId?: string, attempts: number }>) {
            return {
                type: "attemptingConnection",
                ...action.payload,
            }
        },
        connect(state, action: PayloadAction<ConnectActionPayload>) {
            const { initializationTime, initialState, sessionId, clientId, connectedAt } = action.payload;
            return {
                type: "active",
                sessionId,
                clientId,
                lastMessageTime: connectedAt,
                ping: initializationTime,
                connectedSince: connectedAt,
            };
        },
        receiveState(state, action: PayloadAction<ReceiveStatePayload>) {
            if (state.type !== "active")
                throw new Error("Received a ping without being connected!");

            state.lastMessageTime = action.payload.receivedAt;
        },
        receivePing(state, action: PayloadAction<ReceivePingPayload>) {
            if (state.type !== "active")
                throw new Error("Received a ping without being connected!");

            state.ping = action.payload.pingTime;
            state.lastMessageTime = action.payload.receivedAt;
        },
        disconnect() {
            return { type: "disconnected" };
        },
    }
});

/**
 * The reducer for the connection slice.
 * 
 * The connection slice allows clients to get details on their connection to the 
 * server, e.g. whether they are connected already, which session they are 
 * connected to or what the quality of the connection is.
 */
export const connectionReducer = connectionSlice.reducer;

export const {
    /**
     * An action that is fired when a connection is attempted. 
     * This includes an initial connection as well as a reconnection attempt. 
     **/
    attemptConnection,
    /**
     * An action that is fired when a connection has been established 
     * successfully.
     */
    connect,
    /**
     * An action that is fired when a connection was lost.
     */
    disconnect,
    /**
     * An action that is fired when a new state has been received from the 
     * server.
     */
    receiveState,
    /**
     * An action that is fired when a ping is received from the server.
     */
    receivePing
} = connectionSlice.actions;
