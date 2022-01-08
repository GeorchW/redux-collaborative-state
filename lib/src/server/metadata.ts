import { AnyAction } from "@reduxjs/toolkit";

export const messageMetadata = Symbol("messageMetadata");

/** Provides meta-information about an action that was sent from a client. */
export interface MessageMetadata {
    /** The time that this action was received at, as reported by `Date.now()`. */
    receivedAt: number,
    /** The client ID of the client that sent this action. */
    sender: string,
}

export interface ActionWithMetadata extends AnyAction {
    [messageMetadata]: MessageMetadata
}

/** 
 * Gets the message metadata for received actions, or null if the action was not
 * sent from a client. 
 **/
export const getMetadata = (action: AnyAction): MessageMetadata | undefined =>
    (action as ActionWithMetadata)[messageMetadata];
