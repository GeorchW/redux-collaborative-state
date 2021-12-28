import { combineReducers } from "@reduxjs/toolkit";
import { todoReducer, TodoState } from "./features/todo/todoSlice";
import { runServer } from "redux-collaborative-state";

runServer<{ todo: TodoState }, { todo: TodoState }>({
    reducer: combineReducers({
        todo: todoReducer
    }),
    selector: x => x,
});
