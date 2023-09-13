import { Context } from "../context";
import { Wallet } from "@ethersproject/wallet";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Contract, ContractInterface } from "@ethersproject/contracts";
import { Signer } from "@ethersproject/abstract-signer";
import { IClientWeb3Core } from "../interfaces/core";
import { NoLinkCollection, NoProviderError, NoSignerError } from "del-sdk-common";
import { GenericRecord, IHttpConfig } from "../interfaces/common";
import { LinkCollection__factory } from "del-osx-lib";
import { NoValidator } from "../../utils/errors";
import { Network } from "../../utils/network";
import { UnfetchResponse } from "unfetch";

const linkCollectionAddressMap = new Map<Web3Module, string>();
const providersMap = new Map<Web3Module, JsonRpcProvider[]>();
const providerIdxMap = new Map<Web3Module, number>();
const signerMap = new Map<Web3Module, Signer>();

export class Web3Module implements IClientWeb3Core {
    constructor(context: Context) {
        providerIdxMap.set(this, -1);
        // Storing client data in the private module's scope to prevent external mutation
        if (context.web3Providers) {
            providersMap.set(this, context.web3Providers);
            providerIdxMap.set(this, 0);
        }

        if (context.signer) {
            this.useSigner(context.signer);
        }

        if (context.linkCollectionAddress) {
            linkCollectionAddressMap.set(this, context.linkCollectionAddress);
        }

        this.config = {
            url: new URL("http://localhost"),
            headers: {},
        };
        Object.freeze(Web3Module.prototype);
        Object.freeze(this);
    }

    private get linkCollectionAddress(): string {
        return linkCollectionAddressMap.get(this) || "";
    }

    private get providers(): JsonRpcProvider[] {
        return providersMap.get(this) || [];
    }

    private get providerIdx(): number {
        return providerIdxMap.get(this)!;
    }

    private get signer(): Signer | undefined {
        return signerMap.get(this);
    }

    /** Replaces the current signer by the given one */
    public useSigner(signer: Signer): void {
        if (!signer) {
            throw new Error("Empty wallet or signer");
        }
        signerMap.set(this, signer);
    }

    /** Starts using the next available Web3 provider */
    public shiftProvider(): void {
        if (!this.providers.length) {
            throw new Error("No endpoints");
        } else if (this.providers.length <= 1) {
            throw new Error("No other endpoints");
        }
        providerIdxMap.set(this, (this.providerIdx + 1) % this.providers.length);
    }

    /** Retrieves the current signer */
    public getSigner(): Signer | null {
        return this.signer || null;
    }

    /** Returns a signer connected to the current network provider */
    public getConnectedSigner(): Signer {
        let signer = this.getSigner();
        if (!signer) {
            throw new Error("No signer");
        } else if (!signer.provider && !this.getProvider()) {
            throw new Error("No provider");
        } else if (signer.provider) {
            return signer;
        }

        const provider = this.getProvider();
        if (!provider) throw new Error("No provider");

        signer = signer.connect(provider);
        return signer;
    }

    /** Returns the currently active network provider */
    public getProvider(): JsonRpcProvider | null {
        return this.providers[this.providerIdx] || null;
    }

    /** Returns whether the current provider is functional or not */
    public isUp(): Promise<boolean> {
        const provider = this.getProvider();
        if (!provider) return Promise.reject(new Error("No provider"));

        return provider
            .getNetwork()
            .then(() => true)
            .catch(() => false);
    }

    public async ensureOnline(): Promise<void> {
        if (!this.providers.length) {
            return Promise.reject(new Error("No provider"));
        }

        for (let i = 0; i < this.providers.length; i++) {
            if (await this.isUp()) return;

            this.shiftProvider();
        }
        throw new Error("No providers available");
    }

    /**
     * Returns a contract instance at the given address
     *
     * @param address Contract instance address
     * @param abi The Application Binary Inteface of the contract
     * @return A contract instance attached to the given address
     */
    public attachContract<T>(address: string, abi: ContractInterface): Contract & T {
        if (!address) throw new Error("Invalid contract address");
        else if (!abi) throw new Error("Invalid contract ABI");

        const signer = this.getSigner();
        if (!signer && !this.getProvider()) {
            throw new Error("No signer");
        }

        const provider = this.getProvider();
        if (!provider) throw new Error("No provider");

        const contract = new Contract(address, abi, provider);

        if (!signer) {
            return contract as Contract & T;
        } else if (signer instanceof Wallet) {
            return contract.connect(signer.connect(provider)) as Contract & T;
        }

        return contract.connect(signer) as Contract & T;
    }

    /** Returns the current Link Collection address */
    public getLinkCollectionAddress(): string {
        if (!this.linkCollectionAddress) {
            throw new NoLinkCollection();
        }
        return this.linkCollectionAddress;
    }
    public config: IHttpConfig;

    public async assignValidatorEndpoint(): Promise<void> {
        const signer = this.getConnectedSigner();
        if (!signer) {
            throw new NoSignerError();
        } else if (!signer.provider) {
            throw new NoProviderError();
        }

        const contract = LinkCollection__factory.connect(this.getLinkCollectionAddress(), signer);
        const validators = await contract.getValidators();
        if (validators.length === 0) {
            throw new NoValidator();
        }
        const idx = Math.floor(Math.random() * validators.length);
        this.config.url = new URL(validators[idx].endpoint);
    }

    public async isRelayUp(): Promise<boolean> {
        try {
            const res = await this.get("/");
            return (res.status === 200 && (await res.json())) === "OK";
        } catch {
            return false;
        }
    }

    public async get(path: string, data?: GenericRecord): Promise<UnfetchResponse> {
        return Network.get(this.config, path, data);
    }

    public async post(path: string, data?: GenericRecord): Promise<UnfetchResponse> {
        return Network.post(this.config, path, data);
    }
}
