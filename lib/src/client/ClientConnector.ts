import { AnyAction, createAction, Dispatch, PayloadAction } from "@reduxjs/toolkit";
import { applyPatch } from "fast-json-patch";
import { ActionMessage, ClientIdentificationMessage, ClientInitializationMessage, PingMessage, ServerMessage } from "src/Messages";

export const receiveStateAction = createAction<any>("receiveState");
export class ClientConnector<TState> {
    #state: TState;
    private constructor(
        state: TState,
        public readonly clientId: string,
        public readonly sessionId: string,
        public readonly webSocket: WebSocket
    ) {
        this.#state = state;
    }

    get state() { return this.#state; }

    public static connect<TState>(
        clientIdentification: ClientIdentificationMessage,
        dispatch: Dispatch
    ): Promise<ClientConnector<TState>> {
        // TODO: make more configurable
        const remoteAddress = location.hostname === "localhost" ?
            "ws://localhost:3001/websocket" :
            `wss://${location.host}/websocket`;

        const socket = new WebSocket(remoteAddress);
        let clientState: ClientConnector<TState> | undefined;
        return new Promise((resolve, reject) => {

            socket.onmessage = e => {
                if (typeof e.data !== "string")
                    throw new Error("Invalid message");
                const parsed = JSON.parse(e.data);
                if (clientState === undefined) {
                    const message = parsed as ClientInitializationMessage<TState>;
                    clientState = new ClientConnector(
                        message.initialState,
                        message.clientId,
                        message.sessionId,
                        socket
                    );
                    dispatch(receiveStateAction(clientState.state));
                    resolve(clientState);
                }
                else {
                    const data = JSON.parse(e.data) as ServerMessage;
                    if (data.type === "pong") {
                        //TODO: record the ping response time
                        return;
                    }
                    else if (data.type === "patches") {
                        if (clientState === undefined)
                            throw new Error("Invalid message: Client is not initialized yet");

                        const patchResult = applyPatch(
                            clientState.state, data.patches, false, false
                        );
                        clientState.#state = patchResult.newDocument;

                        dispatch(receiveStateAction(clientState.state));
                    }
                }
            };

            socket.onopen = () => send(socket, clientIdentification);

            //TODO: send pings regularly
        });
    }

    send(action: AnyAction) {
        send(this.webSocket, {
            type: "action",
            action,
        })
    }

}

function send(webSocket: WebSocket, message: ClientIdentificationMessage | ActionMessage | PingMessage) {
    webSocket.send(JSON.stringify(message));
}
