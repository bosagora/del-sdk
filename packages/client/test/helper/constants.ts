import { Wallet } from "@ethersproject/wallet";

import { ContextParams } from "../../src";

export const web3endpoints = {
    working: ["https://testnet.bosagora.org/"],
    failing: ["https://bad-url-gateway.io/"],
};

export const TEST_WALLET_ADDRESS = "0xc8195b3420abb2AcDdc3C309d4Ed22ddAAa0d8CE";
export const TEST_WALLET = "d09672244a06a32f74d051e5adbbb62ae0eda27832a973159d475da6d53ba5c0";

export const contextParamsMainnet: ContextParams = {
    network: 2019,
    signer: new Wallet(TEST_WALLET),
    linkCollectionAddress: "0x0123456789012345678901234567890123456789",
    web3Providers: web3endpoints.working,
};

export const contextParamsLocalChain: ContextParams = {
    network: "bosagora_devnet",
    signer: new Wallet(TEST_WALLET),
    linkCollectionAddress: "0xf8065dD2dAE72D4A8e74D8BB0c8252F3A9acE7f9",
    web3Providers: ["http://localhost:7545"],
};

export const contextParamsFailing: ContextParams = {
    network: "mainnet",
    signer: new Wallet(TEST_WALLET),
    linkCollectionAddress: "0x0123456789012345678901234567890123456789",
    web3Providers: web3endpoints.failing,
};
