// This file contains the definition of the low level network clients

import { Signer } from "@ethersproject/abstract-signer";
import { Contract, ContractInterface } from "@ethersproject/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";

export interface IClientWeb3Core {
    useSigner: (signer: Signer) => void;
    shiftProvider: () => void;
    getSigner: () => Signer | null;
    getConnectedSigner: () => Signer;
    getProvider: () => JsonRpcProvider | null;
    isUp: () => Promise<boolean>;
    ensureOnline: () => Promise<void>;
    attachContract: <T>(address: string, abi: ContractInterface) => Contract & T;
    getLinkCollectionAddress: () => string;
}

export interface IClientCore {
    web3: IClientWeb3Core;
}
