import { configureStore, ThunkAction, Action, Reducer } from '@reduxjs/toolkit';
import { ClientConnector, receiveStateAction } from "redux-collaborative-state/dist/client/ClientConnector"
import { todoSlice } from '../features/todo/todoSlice';

let connector: ClientConnector<any> | undefined;

export function setConnector(_connector: ClientConnector<any> | undefined) {
  connector = _connector;
}

const dummyReducer: Reducer = (state, action) => {
  if (state === undefined) {
    state = "Not initialized :-/";
  }

  if (typeof action.type !== "string") return state;

  if (action.type.startsWith("todo/")) {
    // TODO: send to server
    connector?.send(action);
  }
  if (action.type === receiveStateAction.type) {
    return (action as any).payload.todo;
  }

  return state;
};

export const store = configureStore({
  reducer: {
    todo: dummyReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
