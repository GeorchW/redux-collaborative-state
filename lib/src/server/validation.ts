
import { ActionCreator, AnyAction, CaseReducer, CaseReducerWithPrepare, PayloadAction, PayloadActionCreator, Reducer, Slice, SliceCaseReducers } from "@reduxjs/toolkit";
import Joi, { ArraySchema, StrictSchemaMap, StringSchema, NumberSchema, BooleanSchema, AnySchema, Schema } from "joi";
import { getMetadata } from "./metadata";
export type PayloadValidator<T> =
    T extends [] ? ArraySchema :
    T extends object ? StrictSchemaMap<T> :
    T extends string ? StringSchema :
    T extends number ? NumberSchema :
    T extends boolean ? BooleanSchema :
    AnySchema;

export type CaseValidators<State, CaseReducers extends SliceCaseReducers<State>> = {
    [name in keyof CaseReducers]: CaseValidator<State, CaseReducers[name]>
};

export type CaseValidator<State, TCaseReducer extends SliceCaseReducers<State>[string]> =
    TCaseReducer extends CaseReducer<State, PayloadAction<infer Payload>> | undefined ? PayloadValidator<Payload> :
    TCaseReducer extends CaseReducerWithPrepare<State, infer Payload> | undefined ? PayloadValidator<Payload> :
    never;

export type ActionValidatorMap = { [actionName: string]: Schema };

export function createActionValidator<Payload>(action: PayloadActionCreator<Payload>, validator: PayloadValidator<Payload>): Schema {
    if (typeof validator !== "object")
        throw new Error(`Invalid value provided as validator: ${validator}`);

    const payloadValidator = Joi.isSchema(validator) ? validator : Joi.object(validator as any);

    return Joi.object({
        type: action.name,
        payload: payloadValidator,
    })
}

export function createSliceValidator<State, CaseReducers extends SliceCaseReducers<State>>(
    slice: Slice<State, CaseReducers>,
    validators: CaseValidators<State, CaseReducers>
): ActionValidatorMap {
    const caseValidators = Object.entries(validators).map(([key, value]) => {
        if (typeof value !== "object")
            throw new Error(`Invalid value provided as validator: ${value}`);

        const actionName = `${slice.name}/${key}`;
        const payloadValidator = Joi.isSchema(value) ? value : Joi.object(value);

        const actionValidator = Joi.object({
            type: actionName,
            payload: payloadValidator,
        })

        return [actionName, actionValidator];
    });
    return Object.fromEntries(caseValidators);
}

export const createValidator = (validators: ActionValidatorMap) => (action: AnyAction): boolean => {
    const metadata = getMetadata(action);
    if (metadata === undefined) return true; // Internal messages are always valid.

    const validator = validators[action.type];
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

export default function buildValidator() {
    return new ValidatorBuilder();
}

class ValidatorBuilder {
    #validators: ActionValidatorMap = {};

    addSlice<State, Reducers extends SliceCaseReducers<State>>(
        slice: Slice<State, Reducers>,
        validators: CaseValidators<State, Reducers>
    ): ValidatorBuilder {
        Object.assign(this.#validators, createSliceValidator(slice, validators));
        return this;
    }

    addAction<T>(action: PayloadActionCreator<T>, payloadValidator: PayloadValidator<T>): ValidatorBuilder;
    addAction(actionName: string, actionValidator: Schema): ValidatorBuilder;
    addAction(nameOrAction: string | PayloadActionCreator<any>, validator: Schema | PayloadValidator<any>) {
        if (typeof nameOrAction === "string")
            this.#validators[nameOrAction] = validator as Schema;
        else {
            this.#validators[nameOrAction.name] = createActionValidator(nameOrAction, validator);
        }
        return this;
    }

    getValidator() {
        return createValidator({ ...this.#validators });
    }

    getValidatingReducer<T>(reducer: Reducer<T>): Reducer<T> {
        const isValid = this.getValidator();

        return (state, action) => {
            if (!isValid(action)) {
                if (!state)
                    throw new Error("Got an illegal message while not initialized!");
                return state;
            }
            return reducer(state, action);
        }
    }

}

