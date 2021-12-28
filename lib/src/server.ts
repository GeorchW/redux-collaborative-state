import express from "express";
import http from "http";
import ws from "ws";
import { resolve } from "path";
import SessionRegistry from "./SessionRegistry.js";
import ServerOptions from "./ServerOptions.js";

export default function runServer<TInternalState, TVisibleState>(
    options: ServerOptions<TInternalState, TVisibleState>
) {
    const app = express();
    const registry = new SessionRegistry(options.reducer, options.selector);

    if (process.env.NODE_ENV === "development") {
        // Configure CORS for local development
        app.use((req, res, next) => {
            res.header("Access-Control-Allow-Origin", "http://localhost:3000");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });
    }

    if (options.serveBuild ?? true) {
        app.use("/", express.static("build"));
        app.get('*', (req, res) => {
            res.sendFile(resolve("build/index.html"));
        });
    }

    const server = http.createServer(app);

    const wsServer = new ws.Server({ server, path: options.websocketPath ?? "/websocket" }, () => {
        console.log("Websocket server started.");
    })

    wsServer.on("connection", async socket => {
        console.log("Socket connected.");
        registry.connect(socket);
    })

    const port = options.port ?? 3001;
    server.listen(port, () => {
        console.log("Server started.");
        console.log(`Port:     ${port}`);
        console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    });
}
