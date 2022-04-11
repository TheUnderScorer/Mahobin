/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Resolver } from '../Resolver';
import type { Container } from '../Container';

export const declarationSymbol = Symbol('mahobinDeclaration');

export type ContainerKey = string | symbol | number;

// Creates new item in container. Receives "items" which contain all items in container.
export type Factory<
  T = any,
  R extends Record<ContainerKey, any> = Record<ContainerKey, any>
> = (items: R) => T;

export type ResolversMap = {
  [key: ContainerKey]: Resolver<any, any>;
};

export interface ContainerOptions {
  // Default lifetime that will be used for all resolvers
  defaultLifetime?: LifeTime;

  /**
   * When set to true, if resolver with return promise, it's resolved value will be stored in cache, otherwise the promise itself will be cached.
   * */
  cacheResolvedPromises?: boolean;
}

export enum LifeTime {
  // Singleton items are resolved only once
  Singleton = 'Singleton',
  // Scoped items are resolved only once per every scoped container
  Scoped = 'Scoped',
  // Transient items are resolved every time they are requested
  Transient = 'Transient',
}

export type ContainerContents<T> = T extends Container<infer R> ? R : never;

/**
 * Helper type for inferring container contents from function.
 *
 * @example ```ts
 * const createContainer = () => {
 *   return Container.create().register({
 *     key: 'now',
 *     factory: () => new Date()
 *   })
 * };
 *
 * // {now: Date}
 * export type ContainerContents = ContainerFactoryFnContents<typeof createContainer>
 *
 * ```
 * */
export type ContainerFactoryFnContents<T> = T extends () => Promise<
  Container<infer R>
>
  ? R
  : T extends () => Container<infer R>
  ? R
  : never;
