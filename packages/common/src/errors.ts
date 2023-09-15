export class TimeoutError extends Error {
  constructor(message?: string) {
    super(message ? message : "Time out");
  }
}
export class UnsupportedProtocolError extends Error {
  constructor(protocol: string) {
    super("Unsupported protocol: " + protocol);
  }
}
export class GraphQLError extends Error {
  constructor(model: string) {
    super("Cannot fetch the " + model + " data from GraphQL");
  }
}
export class IpfsError extends Error {
  constructor() {
    super("Cannot add or get data from ipfs");
  }
}
export class InvalidAddressError extends Error {
  constructor() {
    super("Invalid address");
  }
}
export class InvalidCidError extends Error {
  constructor() {
    super("The value does not contain a valid CiD");
  }
}
export class NoProviderError extends Error {
  constructor() {
    super("A web3 provider is needed");
  }
}
export class NoSignerError extends Error {
  constructor() {
    super("A signer is needed");
  }
}

export class NoLinkCollection extends Error {
  constructor() {
    super("A link collection address is needed");
  }
}

export class UnsupportedNetworkError extends Error {
  constructor(network: string) {
    super("Unsupported network: " + network);
  }
}
