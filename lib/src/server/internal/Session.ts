
import { AnyAction, Reducer } from "@reduxjs/toolkit";
import { compare } from "fast-json-patch";
import ws from "ws";
import SessionClient from "./SessionClient.js";
import { ClientInitializationMessage, ClientMessage } from "../../Messages.js";
import { clientConnected, clientDisconnected } from "../serverActions.js";
import { SessionOptions } from "../ServerOptions.js";
import ApplicationCloseCodes from "../../ApplicationCloseCodes.js";
import { ActionWithMetadata, messageMetadata } from "../metadata.js";

export default class Session<TInternalState, TVisibleState> {
    #state: TInternalState;
    #clients = new Map<string, SessionClient<TVisibleState>>();
    lastMessageTime = Date.now();

    constructor(
        public readonly sessionId: string,
        public readonly options: Required<SessionOptions<TInternalState, TVisibleState>>,
    ) {
        this.#state = options.reducer(undefined, { type: "@@SERVER_INIT" });
    }

    disconnectIdleClients() {
        const minReactionTimestamp = Date.now() - (this.options.clientTimeout);
        for (const [clientId, client] of this.#clients) {
            if (client.lastMessageTime < minReactionTimestamp) {
                console.log(`Disconnecting client ${clientId} since he does not seem to react.`)
                client.webSocket.close(ApplicationCloseCodes.TIMEOUT, "Client does not react.");
            }
        }
    }

    async addClient(webSocket: ws.WebSocket, clientId: string) {
        if (this.#clients.has(clientId)) {
            // TODO: check if client is dead?
            this.#clients.get(clientId)!.webSocket.close(ApplicationCloseCodes.CLIENT_CONNECTED_TWICE, "Another client with same ID connected.");
        }
        this.dispatch(clientConnected(clientId));

        const initialState = this.options.selector(this.#state, clientId);

        webSocket.send(JSON.stringify({
            clientId,
            sessionId: this.sessionId,
            initialState
        } as ClientInitializationMessage<TVisibleState>));


        webSocket.onmessage = message => {
            this.lastMessageTime = client.lastMessageTime = Date.now();

            if (typeof message.data !== "string") {
                webSocket.close(ApplicationCloseCodes.UNEXPECTED_MESSAGE_TYPE, "Invalid message type.");
                return;
            }
            const data = JSON.parse(message.data) as ClientMessage;
            if (data.type === "action") {
                const actionWithMetadata: ActionWithMetadata = {
                    ...data.action,
                    [messageMetadata]: {
                        receivedAt: Date.now(),
                        sender: clientId
                    }
                };
                // Synchronous dispatches are not possible, since ws.send is a 
                // synchronous operation that enqueues the message.
                this.dispatch(actionWithMetadata);
            }
            else if (data.type === "ping") {
                webSocket.send(JSON.stringify({ type: "pong" }));
            }
        };
        webSocket.onclose = message => {
            console.log(`Client ${clientId} disconnected: ${message.code} ${message.reason}`);
            this.#clients.delete(clientId);
            this.dispatch(clientDisconnected(clientId));
        }

        const client = new SessionClient(clientId, webSocket, initialState);
        this.#clients.set(clientId, client);
    }

    dispatch(action: AnyAction) {
        const oldState = this.#state;
        const newState = this.options.reducer(this.#state, action);
        if (oldState === newState) return;

        this.#state = newState;
        for (const [clientId, client] of this.#clients) {
            const oldVisibleState = client.lastVisibleState;
            const newVisibleState = this.options.selector(newState, clientId);
            const patches = compare(oldVisibleState, newVisibleState);
            if (patches.length === 0) continue;
            client.webSocket.send(JSON.stringify({
                type: "patches",
                patches
            }));
            client.lastVisibleState = newVisibleState;
        }
    }

    close() {
        for (const [, client] of this.#clients) {
            client.webSocket.close(ApplicationCloseCodes.SESSION_TERMINATED, "Session terminated by the server.");
        }
    }
}
