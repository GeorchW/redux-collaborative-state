import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { getMetadata } from "redux-collaborative-state/dist/server/metadata";
import { clientConnected, clientDisconnected } from "redux-collaborative-state/dist/server/serverActions";

export type TodoState = {
    [participant: string]: string[]
};

export const todoSlice = createSlice({
    name: "todo",
    initialState: {} as TodoState,
    reducers: {
        add(state, action: PayloadAction<string>) {
            const participant = getMetadata(action)?.sender;
            if (participant === undefined) return;
            state[participant].push(action.payload);
        },
        remove(state, action: PayloadAction<{ index: number }>) {
            const participant = getMetadata(action)?.sender;
            if (participant === undefined) return;
            const { index } = action.payload;
            state[participant].splice(index, 1);
        },
    },
    extraReducers: builder => builder
        .addCase(clientConnected, (state, action) => {
            state[action.payload] = [];
        })
        .addCase(clientDisconnected, (state, action) => {
            delete state[action.payload];
        })
});

export const { add, remove } = todoSlice.actions;
export const todoReducer = todoSlice.reducer;
