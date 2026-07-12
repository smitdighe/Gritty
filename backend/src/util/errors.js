/**
 * Typed errors for Gritty. Core code throws these — never bare strings — so
 * callers (CLI, server, tests) can branch on `err.code` instead of matching
 * message text.
 */

export class GrittyError extends Error {
  /**
   * @param {string} message human-readable description
   * @param {string} code stable machine-readable code
   */
  constructor(message, code) {
    super(message);
    this.name = 'GrittyError';
    this.code = code;
  }
}

/** No `.gritty` directory found walking up from the cwd. */
export class NotARepo extends GrittyError {
  constructor(message = 'not a gritty repository (or any parent up to the filesystem root)') {
    super(message, 'NotARepo');
    this.name = 'NotARepo';
  }
}

/** An object is missing, malformed, or the wrong type. */
export class BadObject extends GrittyError {
  constructor(message) {
    super(message, 'BadObject');
    this.name = 'BadObject';
  }
}

/** A ref (branch, tag, HEAD target) could not be resolved. */
export class RefNotFound extends GrittyError {
  constructor(message) {
    super(message, 'RefNotFound');
    this.name = 'RefNotFound';
  }
}

/** A user-facing usage/validation problem (bad args, nothing staged, etc.). */
export class UsageError extends GrittyError {
  constructor(message) {
    super(message, 'UsageError');
    this.name = 'UsageError';
  }
}
