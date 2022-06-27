/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ContainerKey,
  ContainerOptions,
  Factory,
  LifeTime,
  ResolveParams,
  ResolversMap,
} from '../types/container.types';
import { Container } from '../Container';
import { Disposable } from '../types/common.types';
import { isDisposable } from '../typeGuards';
import { ResolverDisposer, ResolverParams } from '../types/resolvers.types';
import { nilFactory } from '../utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Resolver<T, R extends ResolversMap> implements Disposable {
  protected disposeHandler?: ResolverDisposer<T>;

  lifeTime = LifeTime.Transient;

  cacheResolvedPromises = false;

  // Stored container used for building this registration
  container?: Container<R>;

  // Name of this registration
  protected name!: ContainerKey;

  protected disposed = false;

  /**
   * Indicates if current resolver was registered only as a declaration, meaning that it doesn't have an actual value yet.
   * */
  protected declaration = false;

  constructor(public readonly factory: Factory<T, R>) {}

  setName(name: ContainerKey) {
    this.name = name;

    return this;
  }

  setDeclaration(declaration: boolean) {
    this.declaration = declaration;

    return this;
  }

  setCacheResolvedPromises(cache: boolean) {
    this.cacheResolvedPromises = cache;

    return this;
  }

  /**
   * Resolves registration using given container instance.
   * */
  resolve(
    container: Container<R>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { omitCache = false, injectionParams }: ResolveParams<any, any> = {}
  ): T {
    if (this.declaration) {
      throw new Error(
        `Tried to resolve a resolver which was registered as a declaration: ${this.name.toString()}`
      );
    }

    if (this.disposed) {
      throw new Error('Resolver is disposed');
    }

    if (omitCache) {
      return this.resolveValue(container, { injectionParams });
    }

    switch (this.lifeTime) {
      case LifeTime.Scoped: {
        return this.resolveOrRetrieveFromCache(container);
      }

      case LifeTime.Singleton: {
        const rootContainer = container.containerRoot ?? container;

        return this.resolveOrRetrieveFromCache(rootContainer);
      }

      case LifeTime.Transient:
        if (container.cache.has(this.name)) {
          this.dispose(true).catch(console.error);

          this.disposed = false;
        }

        this.container = container;

        return this.resolveAndCache(container, { injectionParams });
    }
  }

  setLifetime(lifeTime: LifeTime) {
    this.lifeTime = lifeTime;

    return this;
  }

  disposer(disposer?: ResolverDisposer<T>) {
    this.disposeHandler = disposer;

    return this;
  }

  /**
   * Disposes this resolver
   *
   * @param [onlyDisposeValue=false] - If true, only the value will be disposed, but the binding will remain in the
   * container.
   */
  async dispose(onlyDisposeValue = false) {
    if (this.container?.cache.has(this.name)) {
      const value = this.container.cache.get(this.name);

      if (this.disposeHandler) {
        await this.disposeHandler(value);
      } else if (isDisposable(value)) {
        await value.dispose();
      }

      if (!onlyDisposeValue) {
        this.container?.cache.delete(this.name);
      }
    }

    if (!onlyDisposeValue) {
      this.container = undefined;

      this.disposed = true;
    }
  }

  /**
   * Clones this resolver
   * */
  clone() {
    const resolver = new Resolver<T, R>(this.factory);

    resolver.setName(this.name);
    resolver.setLifetime(this.lifeTime);
    resolver.disposer(this.disposeHandler);

    return resolver;
  }

  protected resolveOrRetrieveFromCache(
    container: Container<R>,
    params?: ResolveParams<any, any>
  ) {
    this.container = container;

    if (!container.cache.has(this.name)) {
      return this.resolveAndCache(container, params);
    }

    return container.cache.get(this.name);
  }

  protected getContainerItems(
    container: Container<R>,
    params?: Pick<ResolveParams<any, any>, 'injectionParams'>
  ) {
    return params?.injectionParams
      ? container.createProxy(params.injectionParams as R)
      : container.items;
  }

  protected resolveAndCache(
    container: Container<R>,
    params?: Pick<ResolveParams<any, any>, 'injectionParams'>
  ) {
    const value = this.resolveValue(container, params);

    container.cache.set(this.name, value);

    if (this.cacheResolvedPromises && value instanceof Promise) {
      void value.then(resolved => {
        container.cache.set(this.name, resolved);
      });
    }

    return value;
  }

  private resolveValue(
    container: Container<R>,
    params: Pick<ResolveParams<any, any>, 'injectionParams'> | undefined
  ) {
    return this.factory(this.getContainerItems(container, params));
  }

  static createDeclaration(key: ContainerKey, options?: ContainerOptions) {
    return this.create(
      {
        key,
        factory: nilFactory,
      },
      options
    ).setDeclaration(true);
  }

  static create<T, R extends ResolversMap>(
    params: ResolverParams<ContainerKey, T, R>,
    options?: ContainerOptions
  ) {
    return new this(params.factory)
      .setLifetime(
        params.lifeTime ?? options?.defaultLifetime ?? LifeTime.Transient
      )
      .setCacheResolvedPromises(options?.cacheResolvedPromises ?? false)
      .setName(params.key)
      .disposer(params.disposer);
  }
}
