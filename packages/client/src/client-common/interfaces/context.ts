// This file defines the interfaces of the context object holding client settings

import { Signer } from "@ethersproject/abstract-signer";
import { JsonRpcProvider, Networkish } from "@ethersproject/providers";

// Context input parameters
type Web3ContextParams = {
    network: Networkish;
    signer?: Signer;
    web3Providers?: string | JsonRpcProvider | (string | JsonRpcProvider)[];
    linkCollectionAddress?: string;
};

export type ContextParams = Web3ContextParams;

// Context state data
type Web3ContextState = {
    network: Networkish;
    signer?: Signer;
    web3Providers: JsonRpcProvider[];
    linkCollectionAddress?: string;
};

export type ContextState = Web3ContextState;
