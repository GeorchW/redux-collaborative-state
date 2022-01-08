import { AnyAction, PayloadActionCreator, Reducer } from "@reduxjs/toolkit";
import { add } from "./features/todo/todoSlice";
import { writeMessage } from "./features/chat/chatSlice";
import Joi from "joi";
import { getMetadata } from "redux-collaborative-state/dist/server/metadata";

const validatedAction = Symbol("validatedAction");

type PayloadValidator<T> = {
    [key in keyof T]: ReturnType<typeof Joi.any>
}

function joiPayloadAction<T>(action: PayloadActionCreator<T>, payloadValidator: PayloadValidator<T>) {
    const result = Joi.object({
        type: action.type,
        payload: Joi.object(payloadValidator)
    });
    (result as any)[validatedAction] = action;
    return result;
}

const joiSender = Joi.valid(Joi.ref("$sender"));
const joiRecentTimestamp = (pastTimeout = 3000, futureTimeout = 500) =>
    Joi.number().custom(x => Date.now() - pastTimeout < x && Date.now() + futureTimeout > x)

const actionValidators = [
    joiPayloadAction(writeMessage, {
        author: joiSender,
        message: Joi.string(),
        timestamp: joiRecentTimestamp()
    }),
    joiPayloadAction(add, {
        participant: joiSender,
        text: Joi.string(),
    })
]

const actionValidatorMap = Object.fromEntries(
    actionValidators.map(x => [(x as any)[validatedAction].type, x] as [string, ReturnType<typeof Joi.any>])
);

const verify = (action: AnyAction): boolean => {
    const metadata = getMetadata(action);
    if (metadata === undefined) return true; // Internal messages are always valid.

    const validator = actionValidatorMap[action.type];
    if (validator === undefined) {
        console.log("Received unverifiable action: ", action.type);
        return false;
    }
    const validationResult = validator.validate(action, { context: { ...metadata } });
    if (validationResult.error) {
        console.log(validationResult.error.annotate())
        return false;
    }
    return true;
};

export const verifyingReducer = <T>(reducer: Reducer<T>): Reducer<T> => (state, action) => {
    if (!verify(action)) {
        if (!state)
            throw new Error("Got an illegal message while not initialized!");
        return state;
    }
    return reducer(state, action);
}
