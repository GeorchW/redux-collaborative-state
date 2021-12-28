import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { clientConnected, clientDisconnected } from "redux-collaborative-state/dist/serverActions";

export type TodoState = {
    [participant: string]: string[]
};

export const todoSlice = createSlice({
    name: "todo",
    initialState: {} as TodoState,
    reducers: {
        add(state, action: PayloadAction<{ participant: string, text: string }>) {
            const { participant, text } = action.payload;
            state[participant].push(text);
        },
        remove(state, action: PayloadAction<{ participant: string, index: number }>) {
            const { participant, index } = action.payload;
            state[participant].splice(index, 1);
        }
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
