import { activeContractsList } from "del-osx-lib";
import { NetworkDeployment, SupportedNetworks } from "./interfaces/common";

export const LIVE_CONTRACTS: { [K in SupportedNetworks]: NetworkDeployment } = {
    bosagora_mainnet: {
        LinkCollection: activeContractsList.bosagora_mainnet.LinkCollection,
    },
    bosagora_testnet: {
        LinkCollection: activeContractsList.bosagora_testnet.LinkCollection,
    },
    bosagora_devnet: {
        LinkCollection: activeContractsList.bosagora_devnet.LinkCollection,
    },
    localhost: {
        LinkCollection: "",
    },
};
