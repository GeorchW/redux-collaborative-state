import { AnyAction, createAction, Dispatch } from "@reduxjs/toolkit";
import { applyPatch } from "fast-json-patch";
import { ActionMessage, ClientIdentificationMessage, ClientInitializationMessage, PingMessage, ServerMessage } from "../Messages";
import { connect, disconnect, receivePing, receiveState } from "./connectionSlice";

export default class ClientConnector<TState> {
    #sessionId: string | undefined;
    #clientId: string | undefined;
    #webSocket: WebSocket | undefined;

    #state: TState | undefined;

    get sessionId() { return this.#sessionId }
    get clientId() { return this.#clientId }

    setConnection(sessionId: string | undefined, clientId: string | undefined, dispatch: Dispatch) {
        let requiresReconnection = false;
        if (this.#sessionId !== undefined && this.#sessionId !== sessionId) {
            requiresReconnection = true;
        }
        if (this.#clientId !== undefined && this.#clientId !== clientId) {
            requiresReconnection = true;
        }
        if (this.#webSocket === undefined) {
            requiresReconnection = true;
        }

        if (requiresReconnection) {
            this.connect({ sessionId, clientId }, dispatch);
        }
    }

    //TODO: merge ClientConnector with this class (?)
    // yeah, I think that makes sense

    connect(
        clientIdentification: ClientIdentificationMessage,
        dispatch: Dispatch
    ) {
        this.#webSocket?.close(1000);

        // TODO: make more configurable
        const remoteAddress = window.location.hostname === "localhost" ?
            "ws://localhost:3001/websocket" :
            `wss://${window.location.host}/websocket`;

        const connectionStarted = Date.now();
        let lastPingSent = Date.now();
        this.#webSocket = new WebSocket(remoteAddress);
        this.#webSocket.onmessage = e => {
            if (typeof e.data !== "string")
                throw new Error("Invalid message");
            const parsed = JSON.parse(e.data);
            if (this.#state === undefined) {
                const { clientId, sessionId, initialState } = parsed as ClientInitializationMessage<TState>;
                this.#clientId = clientId;
                this.#sessionId = sessionId;
                this.#state = initialState;
                const connectedAt = Date.now();
                dispatch(connect({
                    initialState,
                    clientId,
                    sessionId,
                    connectedAt,
                    initializationTime: connectedAt - connectionStarted
                }));
            }
            else {
                const data = JSON.parse(e.data) as ServerMessage;
                if (data.type === "pong") {
                    //TODO: record the ping response time
                    const receivedAt = Date.now();
                    const pingTime = receivedAt - lastPingSent;
                    dispatch(receivePing({
                        receivedAt,
                        pingTime,
                    }));
                    return;
                }
                else if (data.type === "patches") {
                    if (this.#state === undefined)
                        throw new Error("Invalid message: Client is not initialized yet");

                    const patchResult = applyPatch(this.#state, data.patches, false, false);
                    this.#state = patchResult.newDocument;

                    dispatch(receiveState({
                        receivedAt: Date.now(),
                        state: this.#state
                    }));
                }
            }
        };

        this.#webSocket.onopen = () => this.#send(clientIdentification);

        // TODO: make ping interval configurable
        const sendPingsHandle = setInterval(() => {
            lastPingSent = Date.now();
            this.#send({ type: "ping" })
        }, 1000);

        this.#webSocket.onclose = () => {
            // TODO: try reconnecting depending on configuration?
            clearInterval(sendPingsHandle);
            dispatch(disconnect());
        }

        //TODO: send pings regularly
    }

    #send(message: ClientIdentificationMessage | ActionMessage | PingMessage) {
        this.#webSocket?.send(JSON.stringify(message));
    }
    sendAction(action: AnyAction) {
        this.#send({ type: "action", action })
    }
}
