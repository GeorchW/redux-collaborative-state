import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ConnectionState = "disconnected" | ActiveSessionState;

export interface ActiveSessionState {
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
    initialState: "disconnected" as ConnectionState,
    reducers: {
        connect(state, action: PayloadAction<ConnectActionPayload>) {
            const { initializationTime, initialState, sessionId, clientId, connectedAt } = action.payload;
            return {
                sessionId,
                clientId,
                lastMessageTime: connectedAt,
                ping: initializationTime,
                connectedSince: connectedAt,
            };
        },
        receiveState(state, action: PayloadAction<ReceiveStatePayload>) {
            if (state === "disconnected")
                throw new Error("Received a ping without being connected!");

            state.lastMessageTime = action.payload.receivedAt;
        },
        receivePing(state, action: PayloadAction<ReceivePingPayload>) {
            if (state === "disconnected")
                throw new Error("Received a ping without being connected!");

            state.ping = action.payload.pingTime;
            state.lastMessageTime = action.payload.receivedAt;
        },
        disconnect() {
            return "disconnected";
        },
    }
});

export const connectionReducer = connectionSlice.reducer;

export const { connect, disconnect, receiveState, receivePing } = connectionSlice.actions;
