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
