import { Container } from './Container';

class User {
  constructor(public id: string) {}
}

class TasksService {
  constructor(protected user: User) {}

  createTask() {
    // Implementation...
  }
}

const container = Container.create()
  .declare<'currentUser', User>('currentUser')
  .register({
    key: 'tasksService',
    factory: store => new TasksService(store.currentUser),
  });

const user = new User('123');

const scope = container.createScope().register({
  key: 'currentUser',
  factory: () => user,
});

console.log(scope);
