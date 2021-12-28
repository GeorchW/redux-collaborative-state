import ws from "ws";

export default class SessionClient<TVisibleState> {
    public lastMessageTime: number = Date.now();
    constructor(
        public readonly clientId: string,
        public readonly webSocket: ws.WebSocket,
        public lastVisibleState: TVisibleState
    ) { }
}