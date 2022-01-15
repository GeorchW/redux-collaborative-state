import { Reducer } from "@reduxjs/toolkit";
import { todoSlice } from "./features/todo/todoSlice";
import { chatSlice } from "./features/chat/chatSlice";
import { string, number, ref } from "joi";
import buildValidator from "redux-collaborative-state/dist/server/validation";


const sender = () => string().valid(ref("$sender"));
const recentTimestamp = (pastTimeout = 3000, futureTimeout = 500) =>
    number().custom(x => Date.now() - pastTimeout < x && Date.now() + futureTimeout > x)

export const validatingReducer = <T>(reducer: Reducer<T>): Reducer<T> => buildValidator()
    .addSlice(chatSlice, {
        writeMessage: {
            author: sender(),
            message: string(),
            timestamp: recentTimestamp(),
        }
    })
    .addSlice(todoSlice, {
        add: string(),
        remove: {
            index: number(),
        },
    })
    .getValidatingReducer(reducer);

