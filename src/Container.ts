/* eslint-disable @typescript-eslint/no-explicit-any */
import { Resolver } from './Resolver';
import {
  ContainerKey,
  ContainerOptions,
  declarationSymbol,
  LifeTime,
  ResolversMap,
} from './types/container.types';
import { Disposable } from './types/common.types';
import { nanoid } from 'nanoid';
import Emittery from 'emittery';
import { ContainerEvents, ContainerEventsPayload } from './types/events.types';
import { NoResolverFoundError } from './errors/NoResolverFound.error';
import {
  ResolvedResolversRecord,
  ResolverParams,
  ResolversRecord,
} from './types/resolvers.types';

export class Container<Items extends Record<string, any> = Record<string, any>>
  implements Disposable
{
  /**
   * Unique id for this container
   * */
  readonly id = nanoid();

  /**
   * Used to detect circular dependencies.
   * */
  protected resolutionStack: string[] = [];

  /*
   Stores proxy for resolved items
  */
  items: Items;

  /*
   Stores direct parent of this container
  */
  protected parent?: Container<Items>;

  /*
   Stores children of this container
  */
  protected children = new Set<Container<Items>>();

  protected rootParent?: Container<Items>;

  protected resolvers: ResolversMap = {};

  /*
   Cache for resolved items
  */
  readonly cache = new Map<keyof Items, any>();

  /**
   * Emits container related events.
   *
   * @example
   * ```ts
   * const container = Container.create();
   *
   * container.events.on(ContainerEvents.disposed, () => {
   *   console.log('Container was disposed');
   * });
   *
   * ```
   * */
  readonly events = new Emittery<ContainerEventsPayload>();

  constructor(public readonly options: Required<ContainerOptions>) {
    this.items = this.createProxy();
  }

  // Creates proxy for resolving container items
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

  get containerResolvers() {
    return this.resolvers as Readonly<ResolversMap>;
  }

  /**
   * Takes a record of resolvers, and returns a container with the resolvers registered.
   * Use to register many resolvers that don't depend on one another.
   *
   * @returns Container with extended type which contains registered resolvers.
   * @example ```ts
   *
   * const container = Container.create().registerMany({
   *   number: {
   *     factory: () => Math.random(),
   *   },
   *   now: {
   *     factory: () => Date.now(),
   *   }
   * });
   *
   * console.log(container.items.number); // number
   * console.log(container.items.now); // Date
   * ```
   */
  registerMany<T extends ResolversRecord>(record: T) {
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

  /**
   * Registers given resolver.
   *
   * @returns Container with extended type which contains registered resolver.
   * @example ```ts
   *
   * const container = Container.create().register({
   *   key: 'now',
   *   factory: () => new Date(),
   *   lifetime: LifeTime.Scoped
   * });
   *
   * console.log(container.items.now.toISOString()); // 2020-01-01T00:00:00.000Z
   * ```
   */
  register<Key extends ContainerKey | keyof Items, T>(
    registration: ResolverParams<
      Key,
      Key extends keyof Items
        ? Items[Key] extends { [declarationSymbol]: true }
          ? Omit<Items[Key], typeof declarationSymbol>
          : T
        : T,
      Items
    >
  ) {
    this.resolvers[registration.key] = Resolver.create(
      registration,
      this.options
    );

    if (
      this.rootParent &&
      (registration.lifeTime === LifeTime.Singleton ||
        this.options.defaultLifetime === LifeTime.Singleton)
    ) {
      console.warn(
        'Warning! Registered singleton in child container, it will be resolved using root container.'
      );
    }

    return this as Container<Items & Record<Key, T>>;
  }

  /**
   * Takes a key and a type, and returns a new container type with the key and type added to it.
   * Does not register anything, but only adds the type to the container that can be used and registered later.
   *
   * @returns The container itself, but with the new type added to the items.
   * @example ```ts
   * const container = Container
   *  .create()
   *  .declare<'now', Date>('now')
   *  .register({
   *    key: 'tomorrow',
   *    factory: store => new Date(store.now.getTime() + 86400000),
   *  })
   *  .register({
   *    key: 'now',
   *    // Whoops! TypeScript will fail here, because the expected type is "Date"!
   *    factory: () => 'now'
   *  });
   * ```
   */
  declare<Key extends ContainerKey, Type>(key: Key) {
    if (this.has(key)) {
      throw new Error(
        `Tried to create declaration for already existing key: ${key.toString()}`
      );
    }

    this.resolvers[key] = Resolver.createDeclaration(key);

    return this as Container<
      Items & Record<Key, Type & { [declarationSymbol]: true }>
    >;
  }

  /**
   * Checks if the resolver for the given key exists. Does not actually resolve it.
   */
  has<Key extends keyof Items | ContainerKey>(key: Key) {
    return Boolean(this.resolvers[key.toString()]);
  }

  /**
   * Resolved items stored inside container.
   *
   * @returns Resolved item from container.
   * @example ```ts
   * const container = Container.create().register({
   *   key: 'now',
   *   factory: () => new Date()
   * });
   *
   * console.log(container.resolve('now').toISOString()); // 2020-01-01T00:00:00.000Z
   * ```
   */
  resolve<Key extends keyof Items>(key: Key) {
    this.validateKey(key);

    return this.items[key];
  }

  /**
   * Builds given resolver, but doesn't cache it, meaning that configured lifetime won't take effect here
   * */
  build<Key extends keyof Items>(key: Key) {
    this.validateKey(key);

    return this.resolvers[key].resolve(this, false) as Items[Key];
  }

  // Throws if given key does not have associated resolver
  private validateKey(key: string | number | symbol) {
    if (!this.has(key)) {
      throw new NoResolverFoundError(key.toString());
    }
  }

  /**
   * Creates scoped instance of current container. All items that are registered with lifetime of `LifeTime.Scoped` will be resolved once for created scope.
   * Singleton items will be resolved from root container.
   *
   * @returns A new Container instance.
   */
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

  /**
   * Fully disposes container instance, clearing cache, removing children containers and clearing resolvers.
   * */
  async dispose() {
    const children = Array.from(this.children);

    await Promise.all(children.map(child => child.dispose()));

    await this.clearCache();

    await this.events.emit(ContainerEvents.Disposed, this);

    this.events.clearListeners();

    this.resolvers = {};
  }

  /**
   * It clears the cache of all resolvers that are not singletons
   */
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

  /**
   * It clears the container cache and resets the resolvers.
   */
  async clear() {
    await this.clearCache();

    this.resolvers = {};
  }

  /**
   * Creates new container instance.
   *
   * @param {ContainerOptions} [options] - ContainerOptions
   * @returns A new instance of the class.
   */
  static create(options?: ContainerOptions) {
    return new this({
      defaultLifetime: options?.defaultLifetime ?? LifeTime.Transient,
      cacheResolvedPromises: options?.cacheResolvedPromises ?? false,
    });
  }
}
