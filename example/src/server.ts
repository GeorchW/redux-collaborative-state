import { combineReducers } from "@reduxjs/toolkit";
import { todoReducer } from "./features/todo/todoSlice";
import { runServer } from "redux-collaborative-state/dist/server";
import { chatReducer } from "./features/chat/chatSlice";

const reducer = combineReducers({
    todo: todoReducer,
    chat: chatReducer,
});

runServer({ reducer, selector: x => x });
