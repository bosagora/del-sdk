export const SupportedNetworksArray = ["bosagora_mainnet", "bosagora_testnet", "bosagora_devnet", "localhost"] as const;
export type SupportedNetworks = typeof SupportedNetworksArray[number];
export type NetworkDeployment = {
    LinkCollection: string;
};
