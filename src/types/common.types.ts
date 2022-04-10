export type MaybePromise<T> = T | Promise<T>;

export interface Disposable {
  // Disposes the object
  dispose: () => MaybePromise<void>;
}
