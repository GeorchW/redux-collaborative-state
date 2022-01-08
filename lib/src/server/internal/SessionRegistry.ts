import { Reducer } from "@reduxjs/toolkit";
import ws from "ws";
import crypto from "crypto";
import { ClientIdentificationMessage } from "../../Messages.js";
import Session from "./Session.js";
import { SessionOptions } from "../ServerOptions.js";
import ApplicationCloseCodes from "src/ApplicationCloseCodes.js";

export default class SessionRegistry<TInternalState, TVisibleState> {
    #sessions = new Map<string, Session<TInternalState, TVisibleState>>();

    #watchdogHandle: NodeJS.Timer | null = null;

    public constructor(
        public readonly options: SessionOptions<TInternalState, TVisibleState>
    ) {
    }

    private activateWatchdog() {
        if (this.#watchdogHandle !== null)
            clearInterval(this.#watchdogHandle);

        this.#watchdogHandle = setInterval(() => {
            const now = Date.now();
            for (const [sessionId, session] of this.#sessions) {
                session.disconnectIdleClients();
                if (now - (this.options.sessionTimeout ?? 60_000) > session.lastMessageTime) {
                    console.log("Stopping session", sessionId);
                    session.close();
                    this.#sessions.delete(sessionId);
                }
            }
            if (this.#sessions.size === 0 && this.#watchdogHandle !== null) {
                clearInterval(this.#watchdogHandle);
                this.#watchdogHandle = null;
            }
        }, this.options.watchdogFrequency ?? 2000)
    }

    async connect(client: ws.WebSocket) {
        // wait for initial message
        const initialMessage: ClientIdentificationMessage = await new Promise((resolve, reject) => {
            client.onmessage = msg => {
                if (typeof msg.data !== "string") {
                    client.close(ApplicationCloseCodes.UNEXPECTED_MESSAGE_TYPE, "Unexpected message type.");
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

        if (this.#watchdogHandle === null) {
            this.activateWatchdog();
        }

        const newSession = new Session(
            sessionId,
            this.options
        );
        this.#sessions.set(sessionId, newSession);
        return newSession;
    }
}
