import { Reducer } from "@reduxjs/toolkit";
import { Express } from "express";

export type Selector<TInternalState, TVisibleState> = (state: TInternalState, client: string) => TVisibleState;

export default interface ServerOptions<TInternalState, TVisibleState = TInternalState> extends SessionOptions<TInternalState, TVisibleState> {
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
    /**
     * The maximum accepted payload size to be sent by the client, in bytes.
     * Defaults to 8 MiByte (`8 * 2**20`).
     */
    maxPayload?: number,
}

export interface SessionOptions<TInternalState, TVisibleState = TInternalState> {
    /**
     * The reducer that should be used to handle actions on the server.
     */
    reducer: Reducer<TInternalState>;
    /**
     * The function that translates the internal server state to the state presented to each client.
     */
    selector?: Selector<TInternalState, TVisibleState>;
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

export const defaultOptions: Required<Omit<ServerOptions<any>, "reducer">> = {
    clientTimeout: 5000,
    configureServer: () => { },
    port: 3001,
    selector: x => x,
    serveBuild: true,
    sessionTimeout: 60_000,
    watchdogFrequency: 2000,
    websocketPath: "/websocket",
    maxPayload: 8 * 2 ** 20,
}
