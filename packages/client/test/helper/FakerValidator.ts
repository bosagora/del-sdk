import { ContractUtils } from "../../src";

import * as bodyParser from "body-parser";
import * as http from "http";
// @ts-ignore
import * as express from "express";
import { body, validationResult } from "express-validator";

import { LinkCollection, LinkCollection__factory } from "del-osx-lib";

import { AddressZero, HashZero } from "@ethersproject/constants";
import { NonceManager } from "@ethersproject/experimental";
import { BigNumber, BigNumberish, Signer } from "ethers";

import { GasPriceManager } from "./GasPriceManager";
import { GanacheServer } from "./GanacheServer";
import { Deployment } from "./ContractDeployer";

export class FakerValidator {
    private readonly port: number;

    protected _app: express.Application;

    protected _server: http.Server | null = null;

    protected _deployment: Deployment;

    private _accounts: Signer[];

    constructor(port: number | string, deployment: Deployment) {
        if (typeof port === "string") this.port = parseInt(port, 10);
        else this.port = port;

        this._app = express();
        this._deployment = deployment;
        this._accounts = GanacheServer.accounts();
    }

    public start(): Promise<void> {
        this._app.use(bodyParser.urlencoded({ extended: false }));
        this._app.use(bodyParser.json());

        this._app.get("/", [], this.getHealthStatus.bind(this));
        this._app.post(
            "/request",
            [
                body("email")
                    .exists()
                    .trim()
                    .isEmail(),
                body("address")
                    .exists()
                    .trim()
                    .isEthereumAddress(),
                body("signature")
                    .exists()
                    .trim()
                    .matches(/^(0x)[0-9a-f]{130}$/i),
            ],
            this.postRequest.bind(this)
        );

        // Listen on provided this.port on this.address.
        return new Promise<void>((resolve, reject) => {
            // Create HTTP _server.
            this._server = http.createServer(this._app);
            this._server.on("error", reject);
            this._server.listen(this.port, async () => {
                await this.onStart();
                resolve();
            });
        });
    }

    private async onStart() {
        await this.getContract()
            .connect(this.validator1)
            .updateEndpoint(`http://127.0.0.1:${this.port}`);
        await this.getContract()
            .connect(this.validator2)
            .updateEndpoint(`http://127.0.0.1:${this.port}`);
        await this.getContract()
            .connect(this.validator3)
            .updateEndpoint(`http://127.0.0.1:${this.port}`);
    }

    public stop(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (this._server != null) {
                this._server.close((err?) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else resolve();
        });
    }

    private makeResponseData(code: number, data: any, error?: any): any {
        return {
            code,
            data,
            error,
        };
    }

    private getContract(): LinkCollection {
        const contract = LinkCollection__factory.connect(this._deployment.linkCollection.address, this.validator1);
        return contract;
    }

    private get validator1(): Signer {
        return new NonceManager(new GasPriceManager(this._accounts[2]));
    }

    private get validator2(): Signer {
        return new NonceManager(new GasPriceManager(this._accounts[3]));
    }

    private get validator3(): Signer {
        return new NonceManager(new GasPriceManager(this._accounts[4]));
    }

    private async getRequestId(emailHash: string, address: string, nonce: BigNumberish): Promise<string> {
        while (true) {
            const id = ContractUtils.getRequestId(emailHash, address, nonce);
            if (await (await this.getContract()).isAvailable(id)) return id;
        }
    }

    private async getHealthStatus(req: express.Request, res: express.Response) {
        return res.json("OK");
    }

    private async postRequest(req: express.Request, res: express.Response) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json(
                this.makeResponseData(400, undefined, {
                    message: "Failed to check the validity of parameters.",
                    validation: errors.array(),
                })
            );
        }

        try {
            const email: string = String(req.body.email).trim(); // 이메일 해시
            const address: string = String(req.body.address).trim(); // 주소
            const signature: string = String(req.body.signature).trim(); // 서명
            const nonce = await (await this.getContract()).nonceOf(address);
            const emailHash = ContractUtils.sha256String(email);
            if (!ContractUtils.verifyRequestData(address, email, nonce, signature)) {
                return res.json(
                    this.makeResponseData(401, undefined, {
                        message: "The signature value entered is not valid.",
                    })
                );
            }

            const emailToAddress: string = await this.getContract().toAddress(emailHash);
            if (emailToAddress !== AddressZero) {
                return res.json(
                    this.makeResponseData(402, undefined, {
                        message: "This email is already registered.",
                    })
                );
            }

            const addressToEmail: string = await this.getContract().toEmail(address);
            if (addressToEmail !== HashZero) {
                return res.json(
                    this.makeResponseData(403, undefined, {
                        message: "This address is already registered.",
                    })
                );
            }

            const requestId = await this.getRequestId(emailHash, address, nonce);
            setTimeout(async () => {
                await (await this.getContract())
                    .connect(this.validator1)
                    .addRequest(requestId, emailHash, address, signature);
            }, 1000);

            setTimeout(async () => {
                await this.getContract()
                    .connect(this.validator1)
                    .voteRequest(requestId, BigNumber.from(1));
                await this.getContract()
                    .connect(this.validator2)
                    .voteRequest(requestId, BigNumber.from(1));
            }, 2000);

            setTimeout(async () => {
                await this.getContract()
                    .connect(this.validator1)
                    .countVote(requestId);
            }, 3000);

            try {
                return res.json(
                    this.makeResponseData(200, {
                        requestId,
                    })
                );
            } catch (error) {
                const message = error.message !== undefined ? error.message : "Failed save request";
                return res.json(
                    this.makeResponseData(800, undefined, {
                        message,
                    })
                );
            }
        } catch (error) {
            const message = error.message !== undefined ? error.message : "Failed save request";
            console.error(message);
            return res.json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        }
    }
}
