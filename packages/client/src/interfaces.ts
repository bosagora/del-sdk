import { IClientCore } from "./client-common/interfaces/core";
import { BigNumber } from "ethers";

/** Defines the shape of the general purpose Client class */
export interface IClientMethods extends IClientCore {
    addRequest: (email: string) => AsyncGenerator<AddRequestValue>;
    toAddress: (email: string) => Promise<string>;
    toEmail: (wallet: string) => Promise<string>;
    nonceOf: (wallet: string) => Promise<BigNumber>;
    getValidators: () => Promise<ValidatorInfoValue[]>;
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
          wallet: string;
      };

export enum AddRequestSteps {
    ADDING = "adding",
    DONE = "done",
}
