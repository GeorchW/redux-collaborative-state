import express from "express";
import http from "http";
import ws from "ws";
import { resolve } from "path";
import SessionRegistry from "./internal/SessionRegistry.js";
import ServerOptions, { defaultOptions } from "./ServerOptions.js";

/** Starts a new collaborative state server. */
export default function runServer<TInternalState, TVisibleState>(
    options: ServerOptions<TInternalState, TVisibleState>
) {
    const _options = { ...defaultOptions, ...options }

    const app = express();
    const registry = new SessionRegistry(_options);

    if (process.env.NODE_ENV === "development") {
        // Configure CORS for local development
        app.use((req, res, next) => {
            res.header("Access-Control-Allow-Origin", "http://localhost:3000");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });
    }

    if (_options.serveBuild) {
        app.use("/", express.static("build"));
        app.get('*', (req, res) => {
            res.sendFile(resolve("build/index.html"));
        });
    }

    const server = http.createServer(app);

    const wsServer = new ws.Server({ server, path: _options.websocketPath }, () => {
        console.log("Websocket server started.");
    })

    wsServer.on("connection", async socket => {
        console.log("Socket connected.");
        registry.connect(socket);
    })

    server.listen(_options.port, () => {
        console.log("Server started.");
        console.log(`Port:     ${_options.port}`);
        console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    });
}
