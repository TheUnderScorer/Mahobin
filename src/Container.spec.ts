import { Container } from './Container';
import { LifeTime } from './types/container.types';
import { Disposable } from './types/common.types';
import { NoResolverFoundError } from './errors/NoResolverFound.error';

const addDays = (date: Date, days: number) => {
  const result = new Date(date);

  result.setDate(result.getDate() + days);

  return result;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Container', () => {
  it('should register items', () => {
    const container = Container.create()
      .register({
        key: 'now',
        factory: () => new Date(),
      })
      .register({
        key: 'tomorrow',
        factory: store => addDays(store.now, 1),
      });

    expect(container.has('now')).toBe(true);
    expect(container.has('tomorrow')).toBe(true);

    expect(Object.values(container.containerResolvers)).toHaveLength(2);
  });

  it('should resolve items using "items" proxy', () => {
    const container = Container.create().register({
      key: 'now',
      factory: () => new Date(),
    });

    expect(container.items.now).toBeInstanceOf(Date);
  });

  it('should throw if requested item does not exist', () => {
    const container = Container.create();

    expect(() => container.resolve('test')).toThrow(
      new NoResolverFoundError('test')
    );
  });

  it('should throw on circular dependencies', () => {
    const container = Container.create().register({
      key: 'date',
      factory: store => store.date,
    });

    expect(() => container.resolve('date')).toThrow(
      /Circular dependency detected/
    );
  });

  it('should register many items', () => {
    const container = Container.create().registerMany({
      now: {
        factory: () => new Date(),
      },
      id: {
        factory: () => 1,
      },
    });

    expect(Object.values(container.items).length).toBe(2);
  });

  it('should support getting items without cache', async () => {
    const container = Container.create().register({
      key: 'date',
      factory: () => new Date(),
    });

    const date1 = container.build('date');

    await wait(10);

    const date2 = container.build('date');

    expect(date1.valueOf()).not.toEqual(date2.valueOf());
  });

  it('should support clearing itself', async () => {
    const container = Container.create().register({
      key: 'date',
      factory: () => new Date(),
      lifeTime: LifeTime.Singleton,
    });

    container.resolve('date');

    expect(container.cache.size).toBe(1);

    await container.clear();

    expect(container.cache.size).toBe(0);
    expect(container.containerResolvers).toEqual({});
  });

  it('should store root parent', () => {
    const rootContainer = Container.create();

    const child = rootContainer.createScope();
    const childChild = child.createScope();

    expect(childChild.containerRoot).toBe(rootContainer);
    expect(child.containerRoot).toBe(rootContainer);
  });

  it('should automatically dispose disposable items', async () => {
    const dispose = jest.fn();
    const disposable: Disposable = {
      dispose,
    };

    const container = Container.create({
      defaultLifetime: LifeTime.Singleton,
    }).register({
      key: 'disposable',
      factory: () => disposable,
    });

    container.resolve('disposable');

    await container.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('should handle promises', async () => {
    const disposer = jest.fn(async v => expect(await v).toEqual(5));

    const container = Container.create()
      .register({
        key: 'promise',
        factory: async () => 5,
        lifeTime: LifeTime.Singleton,
        disposer,
      })
      .register({
        key: 'sum',
        factory: async store => (await store.promise) + 2,
      });

    const result = await container.resolve('sum');

    expect(result).toEqual(7);

    await container.dispose();

    expect(disposer).toHaveBeenCalledTimes(1);
  });

  it('should support destructuring items', () => {
    const container = Container.create()
      .register({
        key: 'now',
        factory: () => new Date(),
      })
      .register({
        key: 'tomorrow',
        factory: store => addDays(store.now, 1),
      })
      .register({
        key: 'service',
        factory: store => {
          const newStore = {
            ...store,
            isTest: true,
            service: () => store.now.valueOf() + store.tomorrow.valueOf(),
          };

          return newStore.service;
        },
      });

    const service = container.resolve('service');

    expect(service).toBeTruthy();
  });

  it('should resolve registered items as transients', async () => {
    let nowCreatedTimes = 0;

    const container = Container.create()
      .register({
        key: 'now',
        factory: () => {
          nowCreatedTimes++;

          return new Date();
        },
      })
      .register({
        key: 'tomorrow',
        factory: store => addDays(store.now, 1),
      });

    const firstNow = container.resolve('now');

    await wait(50);

    const secondNow = container.resolve('now');

    expect(firstNow.valueOf()).not.toBe(secondNow.valueOf());

    expect(container.resolve('tomorrow')).toBeInstanceOf(Date);
    expect(nowCreatedTimes).toEqual(3);
  });

  it('should resolve registered items as singleton', async () => {
    let nowCreatedTimes = 0;
    let tomorrowCreatedTimes = 0;

    const container = Container.create()
      .register({
        key: 'now',
        factory: () => {
          nowCreatedTimes++;

          return new Date();
        },
        lifeTime: LifeTime.Singleton,
      })
      .register({
        key: 'tomorrow',
        factory: store => {
          tomorrowCreatedTimes++;

          return addDays(store.now, 1);
        },
      });

    const firstNow = container.resolve('now');

    await wait(50);

    const secondNow = container.resolve('now');

    expect(firstNow.valueOf()).toBe(secondNow.valueOf());

    const firstTomorrow = container.resolve('tomorrow');

    await wait(50);

    const secondTomorrow = container.resolve('tomorrow');

    expect(firstTomorrow.valueOf()).toBe(secondTomorrow.valueOf());

    expect(nowCreatedTimes).toEqual(1);
    expect(tomorrowCreatedTimes).toEqual(2);
  });

  it('should dispose registered transient items', async () => {
    const dispose = jest.fn();

    const container = Container.create().register({
      factory: () => new Date(),
      key: 'now',
      disposer: now => {
        expect(now).toBeInstanceOf(Date);

        dispose();
      },
    });

    container.resolve('now');

    await wait(50);

    container.resolve('now');

    await container.dispose();

    expect(dispose).toHaveBeenCalledTimes(2);
  });

  it('should support singleton items depending on transient', async () => {
    const disposer = jest.fn();

    const container = Container.create()
      .register({
        key: 'id',
        factory: () => Date.now().toString(),
        disposer,
      })
      .register({
        key: 'idAddon',
        factory: store => `${store.id}-addon`,
        lifeTime: LifeTime.Singleton,
      });

    const idAddon = container.items.idAddon;

    await wait(10);

    const firstId = container.resolve('id');

    await wait(10);

    const secondId = container.resolve('id');

    await wait(10);

    const secondIdAddon = container.items.idAddon;

    expect(firstId).not.toEqual(secondId);
    expect(idAddon).toBe(secondIdAddon);
    expect(disposer).toHaveBeenCalledTimes(2);
  });

  it('should throw when trying to access declared item', async () => {
    const container = Container.create().declare<'id', string>('id');

    expect(() => container.items.id).toThrow(
      'Tried to resolve a resolver which was registered as a declaration: id'
    );
  });

  describe('Scoped container', () => {
    it('should resolve scoped items', async () => {
      const container = Container.create().register({
        key: 'now',
        factory: () => new Date(),
        lifeTime: LifeTime.Scoped,
      });
      const firstScope = container.createScope();
      const secondScope = container.createScope();

      const firstNow = firstScope.resolve('now');
      await wait(50);
      const secondNow = secondScope.resolve('now');

      expect(firstNow.valueOf()).not.toBe(secondNow.valueOf());
      await wait(50);
      expect(firstNow.valueOf()).toBe(firstScope.resolve('now').valueOf());
      await wait(50);
      expect(secondNow.valueOf()).toBe(secondScope.resolve('now').valueOf());
    });

    it('should support declaring and registering items into scoped container', async () => {
      const container = Container.create()
        .declare<'id', string>('id')
        .register({
          key: 'idAddon',
          factory: store => store.id + '-addon',
        });

      const scope = container.createScope().register({
        key: 'id',
        factory: () => 'scoped-id',
      });

      expect(scope.items.idAddon).toBe('scoped-id-addon');
    });

    it('should not bleed transient items into parent container', async () => {
      const transientDisposer = jest.fn();

      const container = Container.create().register({
        factory: () => new Date(),
        key: 'now',
        lifeTime: LifeTime.Transient,
        disposer: transientDisposer,
      });

      container.resolve('now');
      container.resolve('now');

      expect(transientDisposer).toHaveBeenCalledTimes(1);

      const scope = container.createScope();

      scope.resolve('now');
      scope.resolve('now');

      expect(transientDisposer).toHaveBeenCalledTimes(2);
    });

    it('should not dispose parent elements', async () => {
      const scopedDisposer = jest.fn();
      const parentDisposer = jest.fn();

      const container = Container.create()
        .register({
          key: 'now',
          factory: () => new Date(),
          lifeTime: LifeTime.Scoped,
          disposer: scopedDisposer,
        })
        .register({
          key: 'id',
          factory: () => 'id',
          lifeTime: LifeTime.Singleton,
          disposer: parentDisposer,
        });

      const scope = container.createScope();

      scope.resolve('now');
      scope.resolve('id');

      await scope.dispose();

      expect(scopedDisposer).toHaveBeenCalledTimes(1);
      expect(parentDisposer).not.toHaveBeenCalled();
    });

    it('should dispose scoped items', async () => {
      const disposable: Disposable = {
        dispose: jest.fn(),
      };

      const container = Container.create().register({
        key: 'now',
        factory: () => new Date(),
        lifeTime: LifeTime.Scoped,
        disposer: () => disposable.dispose(),
      });

      const scope = container.createScope();

      scope.resolve('now');

      await scope.dispose();

      expect(disposable.dispose).toHaveBeenCalledTimes(1);
    });

    it('should dispose children correctly', async () => {
      const container = Container.create().register({
        lifeTime: LifeTime.Singleton,
        factory: () => {
          return new Date();
        },
        key: 'now',
      });

      const child = container.createScope();

      expect(container.containerChildren.length).toBe(1);

      await child.dispose();

      expect(container.containerChildren.length).toBe(0);
    });

    it('should resolve singleton items from root', async () => {
      let scopedItemCreatedTimes = 0;
      let singletonItemCreatedTimes = 0;

      const rootContainer = Container.create()
        .register({
          key: 'now',
          lifeTime: LifeTime.Singleton,
          factory: () => {
            singletonItemCreatedTimes++;

            return new Date();
          },
        })
        .register({
          key: 'tomorrow',
          factory: store => {
            scopedItemCreatedTimes++;

            return addDays(store.now, 1);
          },
          lifeTime: LifeTime.Scoped,
        });

      const firstChild = rootContainer.createScope();
      const secondChild = rootContainer.createScope();

      firstChild.resolve('tomorrow');

      await wait(20);

      firstChild.resolve('tomorrow');

      await wait(20);

      secondChild.resolve('tomorrow');

      await wait(20);

      secondChild.resolve('tomorrow');

      rootContainer.resolve('now');

      // Scoped items should be resolved once per scope
      expect(scopedItemCreatedTimes).toEqual(2);

      // Singleton items should be resolve once, always
      expect(singletonItemCreatedTimes).toEqual(1);
    });
  });
});
