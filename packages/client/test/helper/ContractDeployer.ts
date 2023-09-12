import { GanacheServer } from "./GanacheServer";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Signer } from "@ethersproject/abstract-signer";
import { ContractFactory } from "@ethersproject/contracts";
import { LinkCollection, LinkCollection__factory } from "del-osx-lib";

export interface Deployment {
    provider: JsonRpcProvider;
    linkCollection: LinkCollection;
}

export class ContractDeployer {
    public static async deploy(): Promise<Deployment> {
        const provider = GanacheServer.createTestProvider();
        GanacheServer.setTestProvider(provider);

        const [deployer, , validator1, validator2, validator3] = GanacheServer.accounts();
        const validators = [validator1, validator2, validator3];

        try {
            const linkCollectionContract: LinkCollection = await ContractDeployer.deployLinkCollection(
                deployer,
                validators.map(m => m.address)
            );
            GanacheServer.setTestLinkCollectionAddress(linkCollectionContract.address);
            return {
                provider: provider,
                linkCollection: linkCollectionContract,
            };
        } catch (e) {
            throw e;
        }
    }

    private static async deployLinkCollection(deployer: Signer, validators: String[]): Promise<LinkCollection> {
        const linkCollectionFactory = new ContractFactory(
            LinkCollection__factory.abi,
            LinkCollection__factory.bytecode
        );
        const linkCollectionContract: LinkCollection = (await linkCollectionFactory
            .connect(deployer)
            .deploy(validators)) as LinkCollection;
        await linkCollectionContract.deployed();
        await linkCollectionContract.deployTransaction.wait();
        return linkCollectionContract;
    }
}
