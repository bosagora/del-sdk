import { UnfetchResponse } from "unfetch";

export class InvalidEmailParamError extends Error {
    constructor() {
        super("The param does not email");
    }
}

export class MismatchApproveAddressError extends Error {
    constructor() {
        super("Customer and approver mismatch");
    }
}

export class UnregisteredEmailError extends Error {
    constructor() {
        super("Unregistered email error");
    }
}
export class InsufficientBalanceError extends Error {
    constructor() {
        super("Insufficient balance error");
    }
}

export class NoHttpModuleError extends Error {
    constructor() {
        super("A Http Module is needed");
    }
}
export class ClientError extends Error {
    public response: UnfetchResponse;
    constructor(res: UnfetchResponse) {
        super(res.statusText);
        this.name = "ClientError";
        this.response = res;
    }
}

export class InvalidResponseError extends ClientError {
    constructor(res: UnfetchResponse) {
        super(res);
        this.message = "Invalid response";
    }
}
export class MissingBodyeError extends ClientError {
    constructor(res: UnfetchResponse) {
        super(res);
        this.message = "Missing response body";
    }
}
export class BodyParseError extends ClientError {
    constructor(res: UnfetchResponse) {
        super(res);
        this.message = "Error parsing body";
    }
}

export class NoValidator extends Error {
    constructor() {
        super("No Validators");
    }
}

export class FailedParameterValidation extends Error {
    constructor() {
        super("Parameter validation failed");
    }
}

export class NotValidSignature extends Error {
    constructor() {
        super("Signature is not valid");
    }
}

export class AlreadyRegisteredEmail extends Error {
    constructor() {
        super("Email is already registered");
    }
}

export class AlreadyRegisteredAddress extends Error {
    constructor() {
        super("Address is already registered");
    }
}

export class ServerError extends Error {
    constructor() {
        super("Failed request");
    }
}

export class UnknownError extends Error {
    constructor() {
        super("Unknown error occurred");
    }
}
export class EVMError extends Error {
    constructor() {
        super("Error in EVM");
    }
}
