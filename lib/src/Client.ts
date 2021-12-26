import ws from "ws";

export class Client<TVisibleState> {
    public lastMessageTime: number = Date.now();
    constructor(
        public readonly clientId: string,
        public readonly webSocket: ws.WebSocket,
        public lastVisibleState: TVisibleState
    ) { }
}