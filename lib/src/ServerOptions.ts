import { Reducer } from "@reduxjs/toolkit";
import { Express } from "express";
import { Selector } from "./Session";


export default interface ServerOptions<TInternalState, TVisibleState> extends SessionOptions<TInternalState, TVisibleState> {
    /**
     * The port on which the server should listen on. Defaults to 3001.
     */
    port?: number;
    /**
     * Whether to serve the `./build/` directory as static files. This allows using a create-react-app project with
     * minimal changes. Defaults to true.
     */
    serveBuild?: boolean;
    /** 
     * Allows specifying additional configuration for the Express server, e.g.
     * adding custom routes.
     */
    configureServer?: (app: Express) => void;
    /**
     * The path that the websockt server should listen on. Defaults to "/websocket".
     */
    websocketPath?: string;
}

export interface SessionOptions<TInternalState, TVisibleState> {
    /**
     * The reducer that should be used to handle actions on the server.
     */
    reducer: Reducer<TInternalState>;
    /**
     * The function that translates the internal server state to the state presented to each client.
     */
    selector: Selector<TInternalState, TVisibleState>;
    /**
     * The minimum time after which sessions without participants are terminated, in milliseconds.
     * Defaults to 60000 (one minute).
     */
    sessionTimeout?: number;
    /**
     * The minimum time after which a client that does not send pings can be disconnected.
     * Defaults to 5000 (five seconds).
     */
    clientTimeout?: number;
    /**
     * The regularity for which each session checks for timeouts.
     * Defaults to 2000 (two seconds).
     */
    watchdogFrequency?: number;
}
