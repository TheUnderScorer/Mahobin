/* eslint-disable @typescript-eslint/no-explicit-any */
import { Resolver } from './Resolver';
import {
  ContainerKey,
  ContainerOptions,
  LifeTime,
  ResolvedResolversRecord,
  ResolverParams,
  ResolversMap,
  ResolversRecord,
} from './container.types';
import { Disposable } from './common.types';
import { nanoid } from 'nanoid';
import Emittery from 'emittery';
import { ContainerEvents, ContainerEventsPayload } from './events.types';
import { NoResolverFoundError } from './errors/NoResolverFound.error';

export class Container<Items extends Record<string, any> = Record<string, any>>
  implements Disposable
{
  readonly id = nanoid();

  // Used to detect circular dependencies.
  protected resolutionStack: string[] = [];

  resolvers: ResolversMap = {};

  // Stores proxy for resolved items
  items: Items;

  // Stores direct parent of this container
  protected parent?: Container<Items>;

  // Stores children of this container
  protected children = new Set<Container<Items>>();

  protected rootParent?: Container<Items>;

  // Cache for resolved items
  readonly cache = new Map<keyof Items, any>();

  readonly events = new Emittery<ContainerEventsPayload>();

  constructor(public readonly options: Required<ContainerOptions>) {
    this.items = this.createProxy();
  }

  private createProxy() {
    return new Proxy(this.resolvers, {
      get: (target: any, p: string | symbol) => {
        const pStr = p.toString();

        if (this.resolutionStack.includes(pStr)) {
          throw new Error(
            `Circular dependency detected: ${this.resolutionStack.join(
              ' -> '
            )} -> ${pStr}`
          );
        }

        this.resolutionStack.push(pStr);

        this.validateKey(pStr);

        const resolver = this.resolvers[p];

        const result = resolver.resolve(this) as unknown;

        this.resolutionStack.pop();

        return result;
      },
      // Return own keys excluding current resolution stack, in order to avoid circular dependencies
      ownKeys: () => {
        return Object.keys(this.resolvers).filter(
          p => !this.resolutionStack.includes(p)
        );
      },
      getOwnPropertyDescriptor: (target: any, key: string) => {
        return Object.getOwnPropertyDescriptor(this.resolvers, key)
          ? {
              enumerable: true,
              configurable: true,
            }
          : undefined;
      },
    }) as Items;
  }

  get containerParent() {
    return this.parent;
  }

  get containerRoot() {
    return this.rootParent;
  }

  get containerChildren() {
    return Array.from(this.children);
  }

  registerMany<T extends ResolversRecord>(
    record: T
  ): Container<Items & ResolvedResolversRecord<T>> {
    const entries = Object.entries(record);
    const resolvers = entries.reduce<ResolversMap>(
      (acc, [key, resolverParams]) => {
        acc[key] = Resolver.create(
          {
            ...resolverParams,
            key,
          },
          this.options
        );

        return acc;
      },
      {} as ResolversMap
    );

    Object.assign(this.resolvers, resolvers);

    return this as Container<Items & ResolvedResolversRecord<T>>;
  }

  register<Key extends string, T>(registration: ResolverParams<Key, T, Items>) {
    this.resolvers[registration.key] = Resolver.create(
      registration,
      this.options
    );

    return this as Container<Items & Record<Key, T>>;
  }

  has<Key extends keyof Items>(key: Key): boolean;
  has(key: ContainerKey): boolean;
  has(key: ContainerKey | keyof Items) {
    return Boolean(this.resolvers[key.toString()]);
  }

  // Resolves and caches given registration
  resolve<Key extends keyof Items>(key: Key) {
    this.validateKey(key);

    return this.items[key];
  }

  // Builds given registration, but doesn't cache it, meaning that configured lifetime won't take effect here
  build<Key extends keyof Items>(key: Key) {
    this.validateKey(key);

    return this.resolvers[key].resolve(this, false) as Items[Key];
  }

  private validateKey(key: string | number | symbol) {
    if (!this.has(key)) {
      throw new NoResolverFoundError(key.toString());
    }
  }

  createScope() {
    const child = new Container<Items>(this.options);
    const resolversEntries = Object.entries(this.resolvers);

    child.resolvers = Object.fromEntries(
      resolversEntries.map(([key, resolver]) => [key, resolver.clone()])
    );
    child.parent = this;
    child.rootParent = this.rootParent ?? this;

    child.events.on(ContainerEvents.Disposed, () => {
      this.children.delete(child);
    });

    this.children.add(child);

    return child;
  }

  async dispose() {
    const children = Array.from(this.children);

    await Promise.all(children.map(child => child.dispose()));

    await this.clearCache();

    await this.events.emit(ContainerEvents.Disposed, this);

    this.events.clearListeners();

    this.resolvers = {};
  }

  async clearCache() {
    let resolvers = Object.values(this.resolvers);

    if (this.parent) {
      resolvers = resolvers.filter(
        resolver => resolver.lifeTime !== LifeTime.Singleton
      );
    }

    await Promise.all(resolvers.map(resolver => resolver.dispose()));

    this.cache.clear();
  }

  async clear() {
    await this.clearCache();

    this.resolvers = {};
  }

  static create(options?: ContainerOptions) {
    return new this({
      defaultLifetime: options?.defaultLifetime ?? LifeTime.Transient,
    });
  }
}
