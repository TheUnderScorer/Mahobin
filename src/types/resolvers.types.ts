/* eslint-disable @typescript-eslint/no-explicit-any */
import { MaybePromise } from './common.types';
import {
  ContainerKey,
  Factory,
  LifeTime,
  ResolversMap,
} from './container.types';

export interface ResolversRecord<Items extends ResolversMap = ResolversMap> {
  [key: ContainerKey]: Omit<ResolverParams<any, any, Items>, 'key'>;
}

// Disposes given item in resolver
export type ResolverDisposer<T> = (item: T) => MaybePromise<unknown>;

export interface ResolverParams<
  Key extends ContainerKey,
  T,
  R extends ResolversMap
> {
  // Resolver factory that creates given item
  factory: Factory<T, R>;
  // Lifetime of the resolver
  lifeTime?: LifeTime;
  // Resolver key that will be used to access created item
  key: Key;
  /**
   * Optional disposer for the resolver.
   *
   * Note: If resolved item implements `Disposable` interface it will be disposed automatically.
   * */
  disposer?: ResolverDisposer<T>;
}

export type ResolvedResolver<T> = T extends Pick<
  ResolverParams<any, infer S, any>,
  'factory'
>
  ? Awaited<S>
  : never;

export type ResolvedResolversRecord<T extends ResolversRecord<any>> = {
  [Key in keyof T]: ResolvedResolver<T[Key]>;
};
