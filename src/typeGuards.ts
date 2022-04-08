import { Disposable } from './common.types';

export const isDisposable = (obj: unknown): obj is Disposable => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access
  return Boolean(obj && typeof (obj as any).dispose === 'function');
};
