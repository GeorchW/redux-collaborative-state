import { Reducer } from "@reduxjs/toolkit";
import ws from "ws";
import crypto from "crypto";
import { ClientIdentificationMessage } from "./Messages.js";
import Session, { Selector } from "./Session.js";

export default class SessionRegistry<TInternalState, TVisibleState> {
    #sessions = new Map<string, Session<TInternalState, TVisibleState>>();

    public constructor(
        public readonly reducer: Reducer<TInternalState>,
        public readonly selector: Selector<TInternalState, TVisibleState>
    ) { }

    async connect(client: ws.WebSocket) {
        // wait for initial message
        const initialMessage: ClientIdentificationMessage = await new Promise((resolve, reject) => {
            client.onmessage = msg => {
                if (typeof msg.data !== "string") {
                    client.close(4000, "unexpected message type");
                    reject();
                    return;
                }
                const data = JSON.parse(msg.data);
                client.onmessage = () => { };
                resolve(data);
            };
        });

        const { sessionId, clientId } = initialMessage;
        const session = this.getOrCreateSession(sessionId);
        session.addClient(client, clientId ?? crypto.randomBytes(6).toString("base64url"));
    }

    getOrCreateSession(sessionId: string | undefined): Session<TInternalState, TVisibleState> {
        if (sessionId === undefined) {
            // We add 20 bits of entropy to make guessing harder while
            // keeping a short identifier (usually 4 characters).
            const minLengthInBits = Math.log2(this.#sessions.size + 1) + 20;
            const lengthInBytes = Math.ceil(minLengthInBits / 8);
            const sessionId = crypto.randomBytes(lengthInBytes).toString("base64url");
            return this.createSession(sessionId);
        }
        const existingSession = this.#sessions.get(sessionId);
        if (existingSession !== undefined) return existingSession;
        return this.createSession(sessionId);
    }

    createSession(sessionId: string): Session<TInternalState, TVisibleState> {
        if (this.#sessions.has(sessionId))
            throw new Error("Session already exists");

        const newSession = new Session(
            sessionId,
            this.reducer,
            this.selector
        );
        this.#sessions.set(sessionId, newSession);
        return newSession;
    }
}
