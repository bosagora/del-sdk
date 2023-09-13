import { Server } from "ganache";
import { GanacheServer } from "./helper/GanacheServer";
import { contextParamsLocalChain } from "./helper/constants";
import { FakerValidator } from "./helper/FakerValidator";
import { Client, Context, ContractUtils } from "../src";
import { AddRequestSteps } from "../src/interfaces";
import { BigNumber } from "ethers";
import { ContractDeployer, Deployment } from "./helper/ContractDeployer";

describe("SDK Client", () => {
    let deployment: Deployment;
    const [, , validator1, validator2, , user1] = GanacheServer.accounts();
    let fakerValidator: FakerValidator;

    describe("SDK Client", () => {
        let server: Server;

        beforeAll(async () => {
            server = await GanacheServer.start();

            deployment = await ContractDeployer.deploy();

            GanacheServer.setTestWeb3Signer(user1);

            fakerValidator = new FakerValidator(7070, deployment);
            await fakerValidator.start();
        });

        afterAll(async () => {
            await server.close();
            await fakerValidator.stop();
        });

        describe("Method Check", () => {
            let client: Client;
            beforeAll(async () => {
                const context = new Context(contextParamsLocalChain);
                client = new Client(context);
            });

            const userEmail = "a@example.com";
            let requestId: string;
            let emailHash: string;
            let address: string;
            it("Add request", async () => {
                for await (const step of client.methods.addRequest(userEmail)) {
                    switch (step.key) {
                        case AddRequestSteps.ADDING:
                            expect(typeof step.txHash).toBe("string");
                            break;
                        case AddRequestSteps.DONE:
                            expect(step.id).toMatch(/^0x[A-Fa-f0-9]{64}$/i);
                            expect(step.email).toEqual(userEmail);
                            expect(step.emailHash).toEqual(ContractUtils.sha256String(userEmail));
                            expect(step.wallet).toEqual(await user1.getAddress());
                            requestId = step.id;
                            emailHash = step.emailHash;
                            address = step.wallet;
                            break;
                        default:
                            throw new Error("Unexpected step: " + JSON.stringify(step, null, 2));
                    }
                }
            });

            it("Vote request", async () => {
                await deployment.linkCollection.connect(validator1).voteRequest(requestId, BigNumber.from(1));
                await deployment.linkCollection.connect(validator2).voteRequest(requestId, BigNumber.from(1));
            });

            it("Count Vote", async () => {
                await deployment.linkCollection.connect(validator1).countVote(requestId);
            });

            it("Check", async () => {
                await expect(await client.methods.toAddress(emailHash)).toEqual(address);
                await expect(await client.methods.toEmail(address)).toEqual(emailHash);
            });

            it("getValidators", async () => {
                const infos = await client.methods.getValidators();
                console.log(infos);
            });
        });
    });
});
