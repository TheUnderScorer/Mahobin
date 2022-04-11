# Mahobin ☕

> Yet another DI library for Typescript. It's type-safe though!

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Downloads][downloads-img]][downloads-url]
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

## Install

```bash
npm install mahobin
```

## Usage

### Creating container

```ts
import {Container} from 'mahobin';

const myContainer = Container.create();
```

### Registering items

```ts
import {Container} from 'mahobin';

const myContainer = Container
  .create()
  .register({
    key: 'now',
    factory: () => new Date(),
  })
  .register({
    key: 'tomorrow',
    factory: store => {
      const tomorrow = new Date(store.now);

      tomorrow.setDate(tomorrow.getDate() + 1);

      return tomorrow;
    }
  });

console.log(myContainer.resolve('tomorrow'));
//OR
console.log(myContainer.items.tomorrow);
```

### Singleton registrations

```ts
import {Container, LifeTime} from 'mahobin';

const container = Container.create()
  .register({
    key: 'randomNumber',
    factory: () => Math.random() * 100,
  })
  .register({
    key: 'sum',
    factory: store => store.randomNumber + 2,
    lifeTime: LifeTime.Singleton,
  });

const sum = container.items.idAddon;
const secondSum = container.items.idAddon;

console.log(sum === secondSum) // true
```
> **Warning!** If a singleton is resolved, and it depends on a transient registration, those will remain in the singleton for it's lifetime!


### Creating scope

```ts
import {Container, LifeTime, Disposable} from 'mahobin';
import {User} from './types';

class TasksService implements Disposable {
  constructor(private readonly currentUser: User) {
  }

  getTasks() {
    // Some magic that returns tasks for current user!
  }

  async dispose() {
    // Dispose the service...
  }
}

const myContainer = Container
  .create()
  // Declare that "currentUser" will have type "User", but don't register anything yet
  .declare<'currentUser', User>('currentUser')
  .register({
    key: 'tasksService',
    // store: {currentUser: User}
    factory: store => new TasksService(store.currentUser),
    lifetime: LifeTime.Scoped,
    // Because "TasksService" implements "Disposable", the "dispose" method will be called after container is disposed.
    // Alternatively, you can provide custom dispose logic here as well.
    /* disposer: tasksService => {

    }*/
  });

// middleware in some web framework
app.use(async (req, res, next) => {
  // create a scoped container
  req.scope = mycontainer.createScope();

  // register some request-specific data..
  req.scope.register({
    key: 'currentUser',
    // Type of "req.user" must match "User" because of the declaration above
    factory: () => req.user,
  });

  await next();

  // Destroy scoped container
  // At this point "dispose" function will be called in TasksService!
  await req.scope.dispose();
});

app.get('/messages', async (req, res) => {
  // for each request we get a new message service!
  const tasksService = req.scope.resolve('tasksService');

  return res.send(200, await tasksService.getTasks());
});

```

## API Reference

[Read documentation](https://theunderscorer.github.io/Mahobin/)

[build-img]:https://github.com/TheUnderScorer/Mahobin/actions/workflows/release.yml/badge.svg

[build-url]:https://github.com/TheUnderScorer/Mahobin/actions/workflows/release.yml

[downloads-img]:https://img.shields.io/npm/dt/mahobin

[downloads-url]:https://www.npmtrends.com/mahobin

[npm-img]:https://img.shields.io/npm/v/mahobin

[npm-url]:https://www.npmjs.com/package/mahobin

[issues-img]:https://img.shields.io/github/issues/TheUnderScorer/Mahobin

[issues-url]:https://github.com/TheUnderScorer/Mahobin/issues

[codecov-img]:https://codecov.io/gh/TheUnderScorer/Mahobin/branch/main/graph/badge.svg

[codecov-url]:https://codecov.io/gh/TheUnderScorer/Mahobin

[semantic-release-img]:https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg

[semantic-release-url]:https://github.com/semantic-release/semantic-release

[commitizen-img]:https://img.shields.io/badge/commitizen-friendly-brightgreen.svg

[commitizen-url]:http://commitizen.github.io/cz-cli/
