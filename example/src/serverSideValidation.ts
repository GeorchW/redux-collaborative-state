import { AnyAction, CaseReducer, CaseReducerWithPrepare, PayloadAction, Reducer, Slice, SliceCaseReducers } from "@reduxjs/toolkit";
import { todoSlice } from "./features/todo/todoSlice";
import { chatSlice } from "./features/chat/chatSlice";
import { string, number, object, ref, isSchema, ArraySchema, StrictSchemaMap, StringSchema, NumberSchema, BooleanSchema, AnySchema, Schema } from "joi";
import { getMetadata } from "redux-collaborative-state/dist/server/metadata";

type PayloadValidator<T> =
    T extends [] ? ArraySchema :
    T extends object ? StrictSchemaMap<T> :
    T extends string ? StringSchema :
    T extends number ? NumberSchema :
    T extends boolean ? BooleanSchema :
    AnySchema;

const sender = string().valid(ref("$sender"));
const recentTimestamp = (pastTimeout = 3000, futureTimeout = 500) =>
    number().custom(x => Date.now() - pastTimeout < x && Date.now() + futureTimeout > x)

type CaseVerifier<State, CaseReducers extends SliceCaseReducers<State>> = {
    [name in keyof CaseReducers]:
    CaseReducers[name] extends CaseReducer<State, PayloadAction<infer Payload>> | undefined ? PayloadValidator<Payload> :
    CaseReducers[name] extends CaseReducerWithPrepare<State, infer Payload> | undefined ? PayloadValidator<Payload> :
    never
};

function createSliceVerifiers<State, CaseReducers extends SliceCaseReducers<State>>(
    slice: Slice<State, CaseReducers>,
    verifiers: CaseVerifier<State, CaseReducers>
): { [key: string]: Schema } {
    const caseVerifiers = Object.entries(verifiers).map(([key, value]) => {
        if (typeof value !== "object")
            throw new Error(`Invalid value provided as verifier: ${value}`);

        const actionName = `${slice.name}/${key}`;
        const payloadVerifier = isSchema(value) ? value : object(value);

        const actionVerifier = object({
            type: actionName,
            payload: payloadVerifier,
        })

        return [actionName, actionVerifier];
    });
    return Object.fromEntries(caseVerifiers);
}

const chatVerifiers = createSliceVerifiers(chatSlice, {
    writeMessage: {
        author: sender,
        message: string(),
        timestamp: recentTimestamp(),
    }
});

const todoVerifiers = createSliceVerifiers(todoSlice, {
    add: string(),
    remove: {
        index: number(),
    },
});

const allVerifiers = {
    ...chatVerifiers,
    ...todoVerifiers,
}

const verify = (action: AnyAction): boolean => {
    const metadata = getMetadata(action);
    if (metadata === undefined) return true; // Internal messages are always valid.

    const validator = allVerifiers[action.type];
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
