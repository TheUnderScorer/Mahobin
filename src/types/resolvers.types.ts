/* eslint-disable @typescript-eslint/no-explicit-any */
import { MaybePromise } from './common.types';
import {
  ContainerKey,
  declarationSymbol,
  Factory,
  LifeTime,
  ResolversMap,
} from './container.types';
import type { Resolver } from '../Resolver';

export type ResolverRecordEntry<Items extends ResolversMap = ResolversMap> =
  Omit<ResolverParams<any, any, Items>, 'key'>;

export interface ResolversRecord<Items extends ResolversMap = ResolversMap> {
  [key: ContainerKey]: ResolverRecordEntry<Items>;
}

export type ResolversFromResolversRecord<T extends ResolversRecord> = {
  [Key in keyof T]: T[Key] extends Omit<
    ResolverParams<any, infer V, infer R>,
    'key'
  >
    ? Resolver<V, R>
    : never;
};

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

export type ResolverFromParams<T> = T extends ResolverParams<
  any,
  infer V,
  infer R
>
  ? Resolver<V, R>
  : never;

export type ResolvedResolver<T> = T extends Pick<
  ResolverParams<any, infer S, any>,
  'factory'
>
  ? Awaited<S>
  : never;

export type ResolvedResolversRecord<T extends ResolversRecord<any>> = {
  [Key in keyof T]: ResolvedResolver<T[Key]>;
};

export type ResolverParamsValue<
  Key extends ContainerKey | keyof Items,
  Items extends Record<string, any> = Record<string, any>,
  T = any
> = Key extends keyof Items
  ? Items[Key] extends { [declarationSymbol]?: true }
    ? Omit<Items[Key], typeof declarationSymbol>
    : T
  : T;
