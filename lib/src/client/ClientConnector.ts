import { AnyAction, Dispatch, Middleware } from "@reduxjs/toolkit";
import { applyPatch } from "fast-json-patch";
import produce from "immer"
import WebSocketCloseCode from "../WebSocketCloseCode";
import { ActionMessage, ClientIdentificationMessage, ClientInitializationMessage, PatchesMessage, PingMessage, PongMessage, ServerMessage } from "../Messages";
import { attemptConnection, connect, disconnect, receivePing, receiveState } from "./connectionSlice";

type ConnectionActualState = DisconnectedState | ConnectingState | SocketOpenState | ConnectedState;

interface DisconnectedState { type: "disconnected" }
interface ConnectingState {
    type: "connecting",
    attempts: number,
    sessionId?: string,
    clientId?: string,
    webSocket: WebSocket,
    connectionStarted: number,
}
interface SocketOpenState {
    type: "socketOpen",
    sessionId?: string,
    clientId?: string,
    webSocket: WebSocket,
    connectionStarted: number,
}
interface ConnectedState {
    type: "connected",
    sessionId: string,
    clientId: string,
    webSocket: WebSocket,
    sharedState: any,
    pingIntervalHandle: NodeJS.Timer,
    lastPingSent: number,
    serverTimeOffset: number,
}

/**
 * Manages the connection to a server.
 */
export default class ClientConnector<TState> {
    /** The URL of the server to connect to. */
    public readonly url: string;

    /**
     * Creates a new instance of the ClientConnector class.
     * 
     * @param url The URL to connect to. Defaults to `localhost:3001/websocket` 
     *    if the hostname is `localhost`, or `<current host>/websocket` in all 
     *    other cases.
     */
    constructor(url?: string) {
        this.url = url ?? (window.location.hostname === "localhost" ?
            "ws://localhost:3001/websocket" :
            `wss://${window.location.host}/websocket`);
    }
    #state: ConnectionActualState = { type: "disconnected" };
    /** 
     * The method used to dispatch any actions. 
     * Set this to your store's dispatch method to receive updates.
     **/
    public dispatch: Dispatch = x => x;

    //We will dispatch any actions after the state change has finished to ensure that we don't get weird cascades.
    #toBeDispatched: AnyAction[] = [];
    private dispatchNext(action: AnyAction) {
        this.#toBeDispatched.push(action)
    }

    /** Disconnects the client without attempting to reconnect. */
    public disconnect() {
        if (this.#state.type === "disconnected") return;
        this.dispatchNext(disconnect());
        this.setState({ type: "disconnected" });
    }
    /**
     * Instructs the client to attempt a connection to the server.
     * The client will attempt to reconnect automatically if the connection 
     * is interrupted or can't be established.
     * 
     * @param sessionId The ID of the session that the client should connect to.
     *  An empty session ID creates a new session.
     * @param clientId The ID of this client. An undefined ID will cause the
     *  server to assign a new ID to the client.
     */
    public connect(sessionId?: string, clientId?: string) {
        let requiresReconnection = false;
        if (this.#state.type === "disconnected") {
            requiresReconnection = true;
        }
        else {
            if (sessionId !== undefined && this.#state.sessionId !== sessionId) {
                requiresReconnection = true;
            }
            else if (clientId !== undefined && this.#state.clientId !== clientId) {
                requiresReconnection = true;
            }
        }

        if (requiresReconnection) {
            console.log("Reconnecting!", sessionId, clientId, this.#state);
            this.dispatchNext(attemptConnection({ sessionId, clientId, attempts: 0 }));
            this.setState({
                type: "connecting",
                attempts: 0,
                connectionStarted: Date.now(),
                webSocket: new WebSocket(this.url),
                sessionId, clientId
            });
        }
    }

    /** Sends a Redux action to the server. */
    public sendAction(action: AnyAction) {
        if (this.#state.type === "connected")
            _send(this.#state.webSocket, { type: "action", action, sentAt: Date.now() + this.#state.serverTimeOffset });
        else console.error("Not connected - can't send any actions");
    }

    /** 
     * Returns a middleware which reroutes actions of given slices to the 
     * server instead of applying them locally.
     * 
     * @param syncedSlices The slices whose actions should be routed to the 
     *  server.
     **/
    public getMiddleware(...syncedSlices: string[]): Middleware {
        return api => next => action => {

            if (typeof action.type !== "string") return next(action);

            const actionSlice = action.type.split("/")[0];

            if (syncedSlices.includes(actionSlice)) {
                this.sendAction(action);
            }
            else {
                next(action);
            }
        }
    }

    private async setState(nextState: ConnectionActualState | Promise<ConnectionActualState>) {
        const oldState = this.#state;
        const newState = await nextState;
        if (oldState !== this.#state) return;

        if (oldState.type !== "disconnected"
            && (newState.type === "disconnected"
                || oldState.webSocket !== newState.webSocket)) {
            oldState.webSocket.onopen = x => x;
            oldState.webSocket.onmessage = x => x;
            oldState.webSocket.onclose = x => x;
            oldState.webSocket.close(WebSocketCloseCode.NORMAL_CLOSURE, "Disconnected by user request.");
        }
        if (newState.type !== "disconnected") {
            newState.webSocket.onopen = () => this.setState(this.onopen());
            newState.webSocket.onmessage = e => this.setState(this.onmessage(e));
            newState.webSocket.onclose = e => this.setState(this.onclose(e));
        }
        this.#state = newState;

        for (const action of this.#toBeDispatched) {
            this.dispatch(action);

        }
        this.#toBeDispatched = [];
    }
    private onmessage(e: MessageEvent): ConnectionActualState {
        if (typeof e.data !== "string")
            throw new Error("Invalid message type");
        const parsed = JSON.parse(e.data);
        if (this.#state.type === "socketOpen") {
            return this.handleClientInitialization(this.#state, parsed);
        }
        else if (this.#state.type === "connected") {
            const message = parsed as ServerMessage;
            if (message.type === "patches")
                return this.handlePatchesMessage(this.#state, message);
            else
                return this.handlePongMessage(this.#state, message);
        }
        else {
            console.error("The socket is not connected - it should not be able to receive a message");
            return this.#state;
        }
    }
    private handleClientInitialization(state: SocketOpenState, msg: ClientInitializationMessage<TState>): ConnectedState {
        const { clientId, sessionId, initialState } = msg;
        const connectedAt = Date.now();
        this.dispatchNext(connect({
            initialState,
            clientId,
            sessionId,
            connectedAt,
            initializationTime: connectedAt - state.connectionStarted
        }));

        const pingIntervalHandle = setInterval(() => {
            if (this.#state.type !== "connected") {
                clearInterval(pingIntervalHandle);
                return;
            }
            _send(this.#state.webSocket, { type: "ping" })
            this.setState({ ...this.#state, lastPingSent: Date.now() })
        }, 1000);
        return {
            type: "connected",
            sessionId, clientId, pingIntervalHandle,
            sharedState: initialState,
            webSocket: state.webSocket,
            lastPingSent: Date.now(),
            serverTimeOffset: 0,
        }
    }
    private handlePatchesMessage(state: ConnectedState, msg: PatchesMessage): ConnectedState {
        // fast-json-patch mutates the document by default. When setting the 
        // flag to disallow mutations, it will simply clone the entire document
        // instead. That causes all components that use objects from the state
        // to re-render, which is highly undesireable.
        // We can simply use immer's `produce` to avoid this problem.
        const newDocument = produce(state.sharedState,
            (state: any) => applyPatch(state, msg.patches).newDocument);

        this.dispatchNext(receiveState({
            receivedAt: Date.now(),
            state: newDocument
        }));
        return {
            ...state,
            sharedState: newDocument
        }
    }
    private handlePongMessage(state: ConnectedState, msg: PongMessage): ConnectedState {
        const now = Date.now();
        const roundTripTime = now - state.lastPingSent;
        const serverTimeOffset = msg.currentServerTime - now + roundTripTime;
        this.dispatchNext(receivePing({
            receivedAt: now,
            pingTime: roundTripTime,
        }));
        return { ...state, serverTimeOffset }
    }
    private async onclose(e: CloseEvent): Promise<ConnectionActualState> {
        // In Firefox, refreshing a page with an open WebSocket connection will
        // cause the close event handlers to be handled. Our code here will try
        // to reconnect in this case, causing two connections in rapid succession
        // to the server. We can check if the exit was clean and decide not to
        // try reconnecting on cleanly exited connections.
        if (e.wasClean) {
            this.dispatchNext(disconnect());
            return { type: "disconnected" }
        }
        if (this.#state.type === "connected" || this.#state.type === "socketOpen") {
            this.dispatchNext(attemptConnection({
                sessionId: this.#state.sessionId,
                clientId: this.#state.clientId,
                attempts: 0
            }));
            return {
                type: "connecting",
                attempts: 0,
                connectionStarted: Date.now(),
                webSocket: new WebSocket(this.url),
                sessionId: this.#state.sessionId,
                clientId: this.#state.clientId
            }
        }
        else if (this.#state.type === "connecting") {
            const timeout = Math.round(300 * Math.pow(Math.pow(2, 1 / 4), this.#state.attempts));
            await new Promise(resolve => setTimeout(resolve, timeout));
            const attempts = this.#state.attempts + 1;
            this.dispatchNext(attemptConnection({
                sessionId: this.#state.sessionId,
                clientId: this.#state.clientId,
                attempts,
            }));
            return {
                ...this.#state,
                attempts,
                webSocket: new WebSocket(this.url),
            }
        }
        else {
            console.error("Invalid state: Already disconnected");
            return this.#state;
        }
    }
    private onopen(): ConnectionActualState {
        if (this.#state.type === "connecting") {
            _send(this.#state.webSocket, {
                sessionId: this.#state.sessionId,
                clientId: this.#state.clientId
            });
            return {
                ...this.#state,
                type: "socketOpen"
            }
        }
        else {
            console.error("Invalid state");
            return this.#state;
        }
    }
}

function _send(webSocket: WebSocket, message: ClientIdentificationMessage | ActionMessage | PingMessage) {
    webSocket.send(JSON.stringify(message));
}
