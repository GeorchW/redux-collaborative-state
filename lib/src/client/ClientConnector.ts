import { AnyAction, createAction, createAsyncThunk, Dispatch, ThunkAction } from "@reduxjs/toolkit";
import { applyPatch } from "fast-json-patch";
import { ActionMessage, ClientIdentificationMessage, ClientInitializationMessage, PatchesMessage, PingMessage, PongMessage, ServerMessage } from "../Messages";
import { attemptConnection, connect, disconnect, receivePing, receiveState } from "./connectionSlice";

export type ConnectionTargetState = "disconnected" | { sessionId?: string, clientId?: string };

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
}


export default class ClientConnector<TState> {
    public readonly url: string;
    constructor(url?: string) {
        this.url = url ?? (window.location.hostname === "localhost" ?
            "ws://localhost:3001/websocket" :
            `wss://${window.location.host}/websocket`);
    }
    #state: ConnectionActualState = { type: "disconnected" };
    dispatch: Dispatch = x => x;

    //We will dispatch any actions after the state change has finished to ensure that we don't get weird cascades.
    #toBeDispatched: AnyAction[] = [];
    private dispatchNext(action: AnyAction) {
        this.#toBeDispatched.push(action)
    }

    public setTargetState(targetState: ConnectionTargetState) {
        if (targetState === "disconnected") {
            if (this.#state.type !== "disconnected") {
                this.dispatchNext(disconnect());
                this.setState({ type: "disconnected" });
            }
            return;
        }

        const { sessionId, clientId } = targetState;

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
            this.dispatchNext(attemptConnection({ ...targetState, attempts: 0 }));
            this.setState({
                type: "connecting",
                attempts: 0,
                connectionStarted: Date.now(),
                webSocket: new WebSocket(this.url),
                ...targetState
            });
        }
    }

    public sendAction(action: AnyAction) {
        if (this.#state.type === "connected")
            _send(this.#state.webSocket, { type: "action", action });
        else console.error("Not connected - can't send any actions");
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
            oldState.webSocket.close(1000);
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
            throw new Error("Invalid message");
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

        let lastPingSent = Date.now();
        const pingIntervalHandle = setInterval(() => {
            if (this.#state.type !== "connected") {
                clearInterval(pingIntervalHandle);
                return;
            }
            this.setState({ ...this.#state, lastPingSent })
            _send(this.#state.webSocket, { type: "ping" })
        }, 1000);
        return {
            type: "connected",
            sessionId, clientId, pingIntervalHandle,
            sharedState: initialState,
            webSocket: state.webSocket,
            lastPingSent
        }
    }
    private handlePatchesMessage(state: ConnectedState, msg: PatchesMessage): ConnectedState {
        const { newDocument } = applyPatch(state.sharedState, msg.patches, false, false);

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
        const receivedAt = Date.now();
        const pingTime = receivedAt - state.lastPingSent;
        this.dispatchNext(receivePing({
            receivedAt,
            pingTime,
        }));
        return { ...state }
    }
    private async onclose(e: CloseEvent): Promise<ConnectionActualState> {
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
