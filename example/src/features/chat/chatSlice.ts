import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { clientConnected, clientDisconnected } from "redux-collaborative-state/dist/server/serverActions";

export interface ChatState {
    messages: Message[],
    users: string[],
}

export interface Message {
    author: string,
    timestamp: number,
    message: string,
}

export const chatSlice = createSlice({
    name: "chat",
    initialState: { messages: [], users: [] } as ChatState,
    reducers: {
        writeMessage(state, action: PayloadAction<Message>) {
            state.messages.push(action.payload);
        },
        writeExpensiveMessage(state, action: PayloadAction<Message>) {
            // simulate some heavy computations
            const timeout = 200;
            const before = Date.now();
            while (Date.now() - before < timeout);

            state.messages.push(action.payload);
        }
    },
    extraReducers: builder => builder
        .addCase(clientConnected, (state, { payload }) => {
            state.users.push(payload);
        })
        .addCase(clientDisconnected, (state, { payload }) => {
            state.users = state.users.filter(x => x !== payload);
        })
})

export const { writeMessage, writeExpensiveMessage } = chatSlice.actions;
export const chatReducer = chatSlice.reducer;
