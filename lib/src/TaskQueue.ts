// do not push - I think that this is unneccessary

export class TaskQueue<TIn, TOut = void> {
    #items: QueueItem<TIn, TOut>[] = [];
    constructor(
        public readonly work: (input: TIn) => Promise<TOut>
    ) {
    }

    enqueue(input: TIn): Promise<TOut> {
        let resolve: (result: TOut) => void | undefined;
        const promise = new Promise<TOut>(_resolve => { resolve = _resolve; });
        const queueItem: QueueItem<TIn, TOut> = {
            input,
            promise,
            resolvePromise: resolve!
        };
        this.#items.push(queueItem);

        if (this.#items.length === 1) {
            this.#doWork();
        }
        return promise;
    }

    async #doWork() {
        let item;
        while ((item = this.#items.shift()) !== undefined) {
            const result = await this.work(item.input);
            item.resolvePromise(result);
        }
    }
}
interface QueueItem<TIn, TOut> {
    input: TIn;
    promise: Promise<TOut>;
    resolvePromise: (result: TOut) => void;
}
