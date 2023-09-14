import { IClientCore } from "./client-common/interfaces/core";
import { BigNumber } from "ethers";

/** Defines the shape of the general purpose Client class */
export interface IClientMethods extends IClientCore {
    addRequest: (email: string) => AsyncGenerator<AddRequestValue>;
    toAddress: (email: string) => Promise<string>;
    toEmail: (address: string) => Promise<string>;
    nonceOf: (address: string) => Promise<BigNumber>;
    getValidators: () => Promise<ValidatorInfoValue[]>;
    isRelayUp: () => Promise<boolean>;
    assignValidatorEndpoint: () => Promise<void>;
    register: (email: string) => AsyncGenerator<RegisterValue>;
    getRegisterStatus: (id: string) => Promise<number>;
}

export interface IClient {
    methods: IClientMethods;
}

export type IdParams = {
    id: string;
};

export type ToAddressParams = {
    email: string;
};

export type ToEmailParams = {
    wallet: string;
};

export type NonceOfParams = {
    wallet: string;
};

export type ValidatorInfoValue = {
    address: string;
    index: number;
    endpoint: string;
    status: number;
};

export type AddRequestValue =
    | { key: AddRequestSteps.ADDING; txHash: string }
    | {
          key: AddRequestSteps.DONE;
          email: string;
          id: string;
          emailHash: string;
          address: string;
      };

export enum AddRequestSteps {
    ADDING = "adding",
    DONE = "done",
}

export type RegisterValue =
    | { key: RegisterSteps.SENDING; requestId: string; email: string; address: string }
    | {
          key: RegisterSteps.REQUESTED;
          requestId: string;
          email: string;
          address: string;
      }
    | {
          key: RegisterSteps.ACCEPTED;
          requestId: string;
          email: string;
          address: string;
      }
    | {
          key: RegisterSteps.REJECTED;
          requestId: string;
          email: string;
          address: string;
      }
    | {
          key: RegisterSteps.TIMEOUT;
          requestId: string;
          email: string;
          address: string;
      };

export enum RegisterSteps {
    SENDING = "sending",
    REQUESTED = "requested",
    ACCEPTED = "accepted",
    REJECTED = "rejected",
    TIMEOUT = "timeout",
}
