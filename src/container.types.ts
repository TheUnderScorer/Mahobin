/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Resolver } from './Resolver';
import type { Container } from './Container';
import type { MaybePromise } from './common.types';

export type ContainerKey = string | symbol | number;

export type Factory<
  T = any,
  R extends Record<ContainerKey, any> = Record<ContainerKey, any>
> = (items: R) => T;

export type ResolversMap = {
  [key: ContainerKey]: Resolver<any, any>;
};

export interface ContainerOptions {
  defaultLifetime?: LifeTime;
}

export enum LifeTime {
  Singleton = 'Singleton',
  Scoped = 'Scoped',
  Transient = 'Transient',
}

export interface ResolversRecord<Items extends ResolversMap = ResolversMap> {
  [key: ContainerKey]: Omit<ResolverParams<any, any, Items>, 'key'>;
}

export type ResolverDisposer<T> = (item: T) => MaybePromise<unknown>;

export interface ResolverParams<
  Key extends ContainerKey,
  T,
  R extends ResolversMap
> {
  factory: Factory<T, R>;
  lifeTime?: LifeTime;
  key: Key;
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

export type ContainerContents<T> = T extends Container<infer R> ? R : never;
export type AsyncContainerFactoryFnContents<T> = T extends () => Promise<
  Container<infer R>
>
  ? R
  : never;
