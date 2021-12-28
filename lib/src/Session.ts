
import { AnyAction, Reducer } from "@reduxjs/toolkit";
import { compare } from "fast-json-patch";
import ws from "ws";
import SessionClient from "./SessionClient.js";
import { ClientInitializationMessage, ClientMessage } from "./Messages.js";
import { clientConnected, clientDisconnected } from "./serverActions.js";

export type Selector<TInternalState, TVisibleState> = (state: TInternalState, client: string) => TVisibleState;

export default class Session<TInternalState, TVisibleState> {
    #state: TInternalState;
    #clients = new Map<string, SessionClient<TVisibleState>>();

    constructor(
        public readonly sessionId: string,
        public readonly reducer: Reducer<TInternalState>,
        public readonly selector: Selector<TInternalState, TVisibleState>
    ) {
        this.#state = reducer(undefined, { type: "@@SERVER_INIT" });
    }

    async addClient(webSocket: ws.WebSocket, clientId: string) {
        if (this.#clients.has(clientId)) {
            // TODO: check if client is dead?
            this.#clients.get(clientId)!.webSocket.close(4000, "other client with same ID connected");
        }
        this.dispatch(clientConnected(clientId));

        const initialState = this.selector(this.#state, clientId);

        webSocket.send(JSON.stringify({
            clientId,
            sessionId: this.sessionId,
            initialState
        } as ClientInitializationMessage<TVisibleState>));


        webSocket.onmessage = message => {
            client.lastMessageTime = Date.now();

            if (typeof message.data !== "string") {
                webSocket.close(4000, "invalid message type");
                return;
            }
            const data = JSON.parse(message.data) as ClientMessage;
            if (data.type === "action") {
                // Synchronous dispatches are not possible, since ws.send is a 
                // synchronous operation that enqueues the message.
                this.dispatch(data.action);
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
        const newState = this.reducer(this.#state, action);
        if (oldState === newState) return;

        this.#state = newState;
        for (const [clientId, client] of this.#clients) {
            const oldVisibleState = client.lastVisibleState;
            const newVisibleState = this.selector(newState, clientId);
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
            client.webSocket.close(4000, "Terminating session");
        }
    }
}