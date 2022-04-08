export class NoResolverFoundError extends Error {
  constructor(key: string) {
    super(`No resolver found for key: ${key}`);
  }
}
