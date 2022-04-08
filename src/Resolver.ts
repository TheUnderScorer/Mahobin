import {
  ContainerOptions,
  Factory,
  LifeTime,
  ResolverDisposer,
  ResolverParams,
  ResolversMap,
} from './container.types';
import { Container } from './Container';
import { Disposable } from './common.types';
import { isDisposable } from './typeGuards';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Resolver<T, R extends ResolversMap> implements Disposable {
  protected disposeHandler?: ResolverDisposer<T>;

  lifeTime = LifeTime.Transient;

  // Stored container used for building this registration
  container?: Container<R>;

  // Name of this registration
  protected name = '';

  protected disposed = false;

  constructor(public readonly factory: Factory<T, R>) {}

  setName(name: string) {
    this.name = name;

    return this;
  }

  resolve(container: Container<R>, useCache = true): T {
    if (this.disposed) {
      throw new Error('Registration is disposed');
    }

    if (!useCache) {
      return this.factory(container.items);
    }

    switch (this.lifeTime) {
      case LifeTime.Scoped: {
        return this.buildOrRetrieveFromCache(container);
      }

      case LifeTime.Singleton: {
        const rootContainer = container.containerRoot ?? container;

        return this.buildOrRetrieveFromCache(rootContainer);
      }

      case LifeTime.Transient:
        if (container.cache.has(this.name)) {
          this.dispose(true).catch(console.error);

          this.disposed = false;
        }

        this.container = container;

        return this.resolveAndCache(container);
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

  clone() {
    const resolver = new Resolver<T, R>(this.factory);

    resolver.setName(this.name);
    resolver.setLifetime(this.lifeTime);
    resolver.disposer(this.disposeHandler);

    return resolver;
  }

  protected buildOrRetrieveFromCache(container: Container<R>) {
    if (!container.cache.has(this.name)) {
      this.resolveAndCache(container);
    }

    this.container = container;

    return container.cache.get(this.name);
  }

  private resolveAndCache(container: Container<R>) {
    const value = this.factory(container.items);

    container.cache.set(this.name, value);

    // TODO Do we need to await it here?
    if (value instanceof Promise) {
      void value.then(resolved => {
        container.cache.set(this.name, resolved);
      });
    }

    return value;
  }

  static create<T, R extends ResolversMap>(
    params: ResolverParams<string, T, R>,
    options?: ContainerOptions
  ) {
    return new this(params.factory)
      .setLifetime(
        params.lifeTime ?? options?.defaultLifetime ?? LifeTime.Transient
      )
      .setName(params.key)
      .disposer(params.disposer);
  }
}
