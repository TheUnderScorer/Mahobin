import type { Container } from '../Container';

export enum ContainerEvents {
  // Emitted when container is disposed
  Disposed = 'disposed',
}

export interface ContainerEventsPayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [ContainerEvents.Disposed]: Container<any>;
}
