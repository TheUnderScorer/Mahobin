export type MaybePromise<T> = T | Promise<T>;

export interface Disposable {
  dispose: () => MaybePromise<void>;
}
