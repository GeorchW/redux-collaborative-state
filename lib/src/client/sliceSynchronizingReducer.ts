import { Reducer } from "@reduxjs/toolkit";
import { connect, receiveState } from "./connectionSlice";

const sliceSynchronizingReducer = <T>(sliceName: string): Reducer<T | null> => (state, action) => {
    if (state === undefined) {
        state = null;
    }

    if (action.type === connect.type) {
        return (action as ReturnType<typeof connect>).payload.initialState[sliceName];
    }
    if (action.type === receiveState.type) {
        return (action as ReturnType<typeof receiveState>).payload.state[sliceName];
    }

    return state;
}

export default sliceSynchronizingReducer;
