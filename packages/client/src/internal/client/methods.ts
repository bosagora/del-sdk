import { Contract } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";

import { LinkCollection__factory } from "del-osx-lib";
import { NoProviderError, NoSignerError } from "del-sdk-common";

import {
    AddRequestSteps,
    AddRequestValue,
    IClientMethods,
    RegisterSteps,
    RegisterValue,
    ValidatorInfoValue,
} from "../../interfaces";

import { ClientCore, Context, IHttpConfig } from "../../client-common";
import { ContractUtils } from "../../utils/ContractUtils";
import {
    AlreadyRegisteredAddress,
    AlreadyRegisteredEmail,
    FailedParameterValidation,
    NotValidSignature,
    NoValidator,
    ServerError,
    UnknownError,
} from "../../utils/errors";

import { handleNetworkError } from "../../utils/network/ErrorTypes";

/**
 * Methods module the SDK Generic Client
 */
export class ClientMethods extends ClientCore implements IClientMethods {
    public config: IHttpConfig;

    constructor(context: Context) {
        super(context);

        this.config = {
            url: new URL("http://localhost"),
            headers: {},
        };

        Object.freeze(ClientMethods.prototype);
        Object.freeze(this);
    }

    public async isRelayUp(): Promise<boolean> {
        await this.assignValidatorEndpoint();
        return await this.web3.isRelayUp(this.config);
    }

    public async assignValidatorEndpoint(): Promise<void> {
        const provider = this.web3.getProvider();
        if (!provider) {
            throw new NoProviderError();
        }

        const contract = LinkCollection__factory.connect(this.web3.getLinkCollectionAddress(), provider);
        const validators = await contract.getValidators();
        if (validators.length === 0) {
            throw new NoValidator();
        }
        const idx = Math.floor(Math.random() * validators.length);
        this.config.url = new URL(validators[idx].endpoint);
    }

    /**
     * Add a request
     *
     * @param {email} email
     * @return {*}  {AsyncGenerator<AddRequestValue>}
     * @memberof ClientMethods
     */
    public async *addRequest(email: string): AsyncGenerator<AddRequestValue> {
        const signer = this.web3.getConnectedSigner();
        if (!signer) {
            throw new NoSignerError();
        } else if (!signer.provider) {
            throw new NoProviderError();
        }

        const contract = LinkCollection__factory.connect(this.web3.getLinkCollectionAddress(), signer);

        const address = await signer.getAddress();

        const nonce = await contract.nonceOf(address);
        const emailHash = ContractUtils.sha256String(email);
        const signature = await ContractUtils.signRequestData(signer, email, nonce);
        const requestId = await this.getRequestId(contract, emailHash, address, nonce);

        const tx = await contract.addRequest(requestId, emailHash, address, signature);

        yield {
            key: AddRequestSteps.ADDING,
            txHash: tx.hash,
        };

        // start tx
        const receipt = await tx.wait();
        const events = receipt.events?.filter(
            x =>
                x.event === "AddedRequestItem" && x.args !== undefined && x.args.length === 3 && x.args[0] === requestId
        );

        if (events === undefined || events.length === 0 || events[0].args === undefined) {
            throw new Error("Failed to add request");
        }

        yield {
            key: AddRequestSteps.DONE,
            id: events[0].args[0],
            email: email,
            emailHash: events[0].args[1],
            address: events[0].args[2],
        };
    }

    /**
     * Register email & address
     *
     * @param {email} email
     * @return {*}  {AsyncGenerator<RegisterValue>}
     * @memberof ClientMethods
     */
    public async *register(email: string): AsyncGenerator<RegisterValue> {
        await this.assignValidatorEndpoint();
        const signer = this.web3.getConnectedSigner();
        if (!signer) {
            throw new NoSignerError();
        } else if (!signer.provider) {
            throw new NoProviderError();
        }

        const contract = LinkCollection__factory.connect(this.web3.getLinkCollectionAddress(), signer);
        const address = await signer.getAddress();
        const nonce = await contract.nonceOf(address);
        const signature = await ContractUtils.signRequestData(signer, email, nonce);
        const res = await this.web3.post(this.config, "request", {
            email,
            address,
            signature,
        });

        if (!res.ok) {
            throw handleNetworkError(res);
        }

        const response = await res.json();
        if (response.code === 200) {
        } else if (response.code === 400) {
            throw new FailedParameterValidation();
        } else if (response.code === 401) {
            throw new NotValidSignature();
        } else if (response.code === 402) {
            throw new AlreadyRegisteredEmail();
        } else if (response.code === 403) {
            throw new AlreadyRegisteredAddress();
        } else if (response.code === 500) {
            throw new ServerError();
        } else {
            throw new UnknownError();
        }

        yield {
            key: RegisterSteps.SENDING,
            requestId: response.data.requestId,
            email,
            address,
        };

        const start = ContractUtils.getTimeStamp();
        let done = false;
        let status: number = 0;
        while (!done) {
            status = await this.getRegisterStatus(response.data.requestId);
            if (status !== 0) {
                done = true;
            } else if (ContractUtils.getTimeStamp() - start > 60) {
                done = true;
            } else {
                await ContractUtils.delay(3000);
            }
        }

        let key: RegisterSteps;
        switch (status) {
            case 0:
                key = RegisterSteps.TIMEOUT;
                break;
            case 1:
                key = RegisterSteps.REQUESTED;
                break;
            case 2:
                key = RegisterSteps.ACCEPTED;
                break;
            default:
                key = RegisterSteps.REJECTED;
                break;
        }

        yield {
            key,
            requestId: response.data.requestId,
            email,
            address,
        };
    }

    public async toAddress(email: string): Promise<string> {
        const provider = this.web3.getProvider();
        if (!provider) {
            throw new NoProviderError();
        }

        const contract = LinkCollection__factory.connect(this.web3.getLinkCollectionAddress(), provider);

        return await contract.toAddress(email);
    }

    public async toEmail(address: string): Promise<string> {
        const provider = this.web3.getProvider();
        if (!provider) {
            throw new NoProviderError();
        }

        const contract = LinkCollection__factory.connect(this.web3.getLinkCollectionAddress(), provider);

        return await contract.toEmail(address);
    }

    public async nonceOf(wallet: string): Promise<BigNumber> {
        const provider = this.web3.getProvider();
        if (!provider) {
            throw new NoProviderError();
        }

        const contract = LinkCollection__factory.connect(this.web3.getLinkCollectionAddress(), provider);

        return await contract.nonceOf(wallet);
    }

    private async getRequestId(
        contract: Contract,
        emailHash: string,
        address: string,
        nonce: BigNumber
    ): Promise<string> {
        // 내부에 랜덤으로 32 Bytes 를 생성하여 ID를 생성하므로 무한반복될 가능성이 극히 낮음
        while (true) {
            const id = ContractUtils.getRequestId(emailHash, address, nonce);
            if (await contract.isAvailable(id)) return id;
        }
    }

    public async getValidators(): Promise<ValidatorInfoValue[]> {
        const provider = this.web3.getProvider();
        if (!provider) {
            throw new NoProviderError();
        }

        const contract = LinkCollection__factory.connect(this.web3.getLinkCollectionAddress(), provider);
        const validators = await contract.getValidators();
        return validators.map(m => {
            return {
                address: m.validator,
                index: m.index.toNumber(),
                endpoint: m.endpoint,
                status: m.status,
            };
        });
    }

    public async getRegisterStatus(id: string): Promise<number> {
        const provider = this.web3.getProvider();
        if (!provider) {
            throw new NoProviderError();
        }

        const contract = LinkCollection__factory.connect(this.web3.getLinkCollectionAddress(), provider);
        const res = await contract.getRequestItem(id);
        return res.status;
    }
}
