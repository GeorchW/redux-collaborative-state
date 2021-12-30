import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ConnectionState = DisconnectedState | AttemptingConnectionState | ActiveSessionState;

export interface DisconnectedState {
    type: "disconnected";
}

export interface AttemptingConnectionState {
    type: "attemptingConnection";
    sessionId?: string;
    clientId?: string;
    attempts: number;
}

export interface ActiveSessionState {
    type: "active"
    sessionId: string,
    clientId: string,
    lastMessageTime: number,
    ping: number,
    connectedSince: number,
}

export interface ConnectActionPayload {
    sessionId: string,
    clientId: string,
    initialState: any,
    initializationTime: number,
    connectedAt: number
}

export interface ReceiveStatePayload {
    state: any,
    receivedAt: number,
}
export interface ReceivePingPayload {
    pingTime: number,
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

export const connectionReducer = connectionSlice.reducer;

export const { attemptConnection, connect, disconnect, receiveState, receivePing } = connectionSlice.actions;
