import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit';

import ClientConnector from 'redux-collaborative-state/dist/client/ClientConnector';
import { connectionReducer, receivePing } from 'redux-collaborative-state/dist/client/connectionSlice';
import sliceSynchronizingReducer from 'redux-collaborative-state/dist/client/sliceSynchronizingReducer';
import { ChatState } from '../features/chat/chatSlice';
import { TodoState } from '../features/todo/todoSlice';

export const connector = new ClientConnector<any>();

export const store = configureStore({
  reducer: {
    todo: sliceSynchronizingReducer<TodoState>("todo"),
    chat: sliceSynchronizingReducer<ChatState>("chat"),
    connection: connectionReducer,
  },
  // TODO: document this
  devTools: {
    actionsBlacklist: [receivePing.type]
  },
  middleware: middleware => [...middleware(), connector.getMiddleware("todo", "chat")]
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
