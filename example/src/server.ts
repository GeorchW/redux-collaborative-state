import { combineReducers } from "@reduxjs/toolkit";
import { todoReducer } from "./features/todo/todoSlice";
import { runServer } from "redux-collaborative-state/dist/server";
import { chatReducer } from "./features/chat/chatSlice";
import { verifyingReducer } from "./serverSideValidation";

const reducer = combineReducers({
    todo: todoReducer,
    chat: chatReducer,
});


runServer({ reducer: verifyingReducer(reducer) });
