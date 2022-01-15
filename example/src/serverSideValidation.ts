import { Reducer } from "@reduxjs/toolkit";
import { todoSlice } from "./features/todo/todoSlice";
import { chatSlice } from "./features/chat/chatSlice";
import Joi from "joi";
import buildValidator from "redux-collaborative-state/dist/server/validation";


const sender = () => Joi.string().valid(Joi.ref("$sender"));
const recentTimestamp = (pastTimeout = 3000, futureTimeout = 500) =>
    Joi.number().custom(x => Date.now() - pastTimeout < x && Date.now() + futureTimeout > x)

export const validatingReducer = <T>(reducer: Reducer<T>): Reducer<T> => buildValidator()
    .addSlice(chatSlice, {
        writeMessage: {
            author: sender(),
            message: Joi.string(),
            timestamp: recentTimestamp(),
        },
        writeExpensiveMessage: {
            author: sender(),
            message: Joi.string(),
            timestamp: recentTimestamp(),
        }
    })
    .addSlice(todoSlice, {
        add: Joi.string(),
        remove: {
            index: Joi.number(),
        },
    })
    .getValidatingReducer(reducer);

