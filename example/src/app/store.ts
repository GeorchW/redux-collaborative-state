import { configureStore, ThunkAction, Action, Reducer } from '@reduxjs/toolkit';

import ClientConnector from 'redux-collaborative-state/dist/client/ClientConnector';
import { connect, disconnect, receiveState, connectionReducer } from 'redux-collaborative-state/dist/client/connectionSlice';
import { TodoState } from '../features/todo/todoSlice';

export const connector = new ClientConnector<{ todo: TodoState }>();

const dummyReducer: Reducer = (state, action) => {
  if (state === undefined) {
    state = "Not initialized :-/";
  }

  if (typeof action.type !== "string") return state;

  if (action.type.startsWith("todo/")) {
    // TODO: send to server
    connector.sendAction(action);
  }
  if (action.type === connect.type) {
    return (action as ReturnType<typeof connect>).payload.initialState.todo;
  }
  if (action.type === receiveState.type) {
    return (action as ReturnType<typeof receiveState>).payload.state.todo;
  }

  return state;
};

export const store = configureStore({
  reducer: {
    todo: dummyReducer,
    connection: connectionReducer,
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
