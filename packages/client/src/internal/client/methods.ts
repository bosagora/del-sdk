import { LinkCollection__factory } from "del-osx-lib";
import { NoProviderError, NoSignerError } from "del-sdk-common";

import { AddRequestSteps, AddRequestValue, IClientMethods } from "../../interfaces";

import { ClientCore, Context } from "../../client-common";
import { ContractUtils } from "../../utils/ContractUtils";
import { BigNumber } from "ethers";
import { Contract } from "@ethersproject/contracts";

/**
 * Methods module the SDK Generic Client
 */
export class ClientMethods extends ClientCore implements IClientMethods {
    constructor(context: Context) {
        super(context);
        Object.freeze(ClientMethods.prototype);
        Object.freeze(this);
    }

    /**
     * Add a request
     *
     * @param {email} email
     * @return {*}  {AsyncGenerator<null>}
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
            wallet: events[0].args[2],
        };
    }

    public async toAddress(email: string): Promise<string> {
        const signer = this.web3.getConnectedSigner();
        if (!signer) {
            throw new NoSignerError();
        } else if (!signer.provider) {
            throw new NoProviderError();
        }

        const contract = LinkCollection__factory.connect(this.web3.getLinkCollectionAddress(), signer);

        return await contract.toAddress(email);
    }

    public async toEmail(wallet: string): Promise<string> {
        const signer = this.web3.getConnectedSigner();
        if (!signer) {
            throw new NoSignerError();
        } else if (!signer.provider) {
            throw new NoProviderError();
        }

        const contract = LinkCollection__factory.connect(this.web3.getLinkCollectionAddress(), signer);

        return await contract.toEmail(wallet);
    }

    public async nonceOf(wallet: string): Promise<BigNumber> {
        const signer = this.web3.getConnectedSigner();
        if (!signer) {
            throw new NoSignerError();
        } else if (!signer.provider) {
            throw new NoProviderError();
        }

        const contract = LinkCollection__factory.connect(this.web3.getLinkCollectionAddress(), signer);

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
}
