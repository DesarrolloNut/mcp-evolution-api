export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ProviderNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`Provider not found: ${identifier}`);
  }
}

export class ChannelNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`Channel not found: ${identifier}`);
  }
}

export class NoDefaultChannelError extends DomainError {
  constructor() {
    super('No default channel configured and no specific channel was requested');
  }
}

export class ProviderCapabilityError extends DomainError {
  constructor(providerType: string, capability: string) {
    super(`Provider '${providerType}' does not support capability '${capability}'`);
  }
}

export class AuthenticationError extends DomainError {
  constructor(message: string = 'Authentication failed') {
    super(message);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
