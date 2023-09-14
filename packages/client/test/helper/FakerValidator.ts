import { ContractUtils } from "../../src";

import * as cron from "node-cron";
import * as bodyParser from "body-parser";
// @ts-ignore
import cors from "cors";
import * as http from "http";
// @ts-ignore
import e, * as express from "express";
import { body, validationResult } from "express-validator";

import { LinkCollection, LinkCollection__factory } from "del-osx-lib";

import { AddressZero, HashZero } from "@ethersproject/constants";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumberish } from "@ethersproject/bignumber";
import { NonceManager } from "@ethersproject/experimental";

import { GasPriceManager } from "./GasPriceManager";
import { GanacheServer } from "./GanacheServer";
import { Deployment } from "./ContractDeployer";

export enum JobType {
    REGISTER,
    VOTE1,
    VOTE2,
    VOTE3,
    COUNT,
}
export interface IJob {
    type: JobType;
    requestId: string;
    registerData?: {
        emailHash: string;
        address: string;
        signature: string;
    };
}

export class FakerValidator {
    public static INIT_WAITING_SECONDS: number = 2;
    public static INTERVAL_SECONDS: number = 12;
    protected _app: express.Application;
    protected _server: http.Server | null = null;
    protected _deployment: Deployment;
    private readonly port: number;
    private readonly _accounts: Signer[];
    private readonly _worker: Worker;

    private _jobList: IJob[] = [];

    constructor(port: number | string, deployment: Deployment) {
        if (typeof port === "string") this.port = parseInt(port, 10);
        else this.port = port;

        this._app = e();
        this._deployment = deployment;
        this._accounts = GanacheServer.accounts();
        this._worker = new Worker("*/1 * * * * *", this);
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

    public start(): Promise<void> {
        this._app.use(bodyParser.urlencoded({ extended: false }));
        this._app.use(bodyParser.json());
        this._app.use(
            cors({
                allowedHeaders: "*",
                credentials: true,
                methods: "GET, POST",
                origin: "*",
                preflightContinue: false,
            })
        );

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
            // Create HTTP server.
            this._server = http.createServer(this._app);
            this._server.on("error", reject);
            this._server.listen(this.port, async () => {
                await this.onStart();
                await this._worker.start();
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
            await this._worker.stop();
            await this._worker.waitForStop();
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

    private async getRequestId(emailHash: string, address: string, nonce: BigNumberish): Promise<string> {
        while (true) {
            const id = ContractUtils.getRequestId(emailHash, address, nonce);
            if (await this.getContract().isAvailable(id)) return id;
        }
    }

    private async getHealthStatus(_: express.Request, res: express.Response) {
        return res.status(200).json("OK");
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
                        message: "The email is already registered.",
                    })
                );
            }

            const addressToEmail: string = await this.getContract().toEmail(address);
            if (addressToEmail !== HashZero) {
                return res.json(
                    this.makeResponseData(403, undefined, {
                        message: "The address is already registered.",
                    })
                );
            }

            const requestId = await this.getRequestId(emailHash, address, nonce);
            this.addJob({
                type: JobType.REGISTER,
                requestId,
                registerData: {
                    emailHash,
                    address,
                    signature,
                },
            });

            return res.json(
                this.makeResponseData(200, {
                    requestId,
                })
            );
        } catch (error) {
            const message =
                error instanceof Error && error.message !== undefined ? error.message : "Failed save request";
            // console.error(message);
            return res.json(
                this.makeResponseData(500, undefined, {
                    message,
                })
            );
        }
    }

    private async addRequest(requestId: string, emailHash: string, address: string, signature: string) {
        try {
            await this.getContract()
                .connect(this.validator1)
                .addRequest(requestId, emailHash, address, signature);
        } catch (e) {
            const message =
                e instanceof Error && e.message !== undefined
                    ? e.message
                    : "Error when saving a request to the contract.";
            console.error(message);
        }
    }

    private async voteAgreement(signer: Signer, requestId: string) {
        try {
            await (await this.getContract()).connect(signer).voteRequest(requestId, 1);
        } catch (e) {
            const message = e instanceof Error && e.message !== undefined ? e.message : "Error when calling contract";
            console.error(message);
        }
    }

    private async countVote(requestId: string) {
        try {
            await (await this.getContract()).connect(this.validator1).countVote(requestId);
        } catch (e) {
            const message = e instanceof Error && e.message !== undefined ? e.message : "Error when calling contract";
            console.error(message);
        }
    }
    public async onWork() {
        const job = this.getJob();
        if (job !== undefined) {
            switch (job.type) {
                case JobType.REGISTER:
                    console.info(`JobType.REGISTER ${job.requestId}`);
                    if (job.registerData !== undefined) {
                        await this.addRequest(
                            job.requestId,
                            job.registerData.emailHash,
                            job.registerData.address,
                            job.registerData.signature
                        );
                    }

                    this.addJob({
                        type: JobType.VOTE1,
                        requestId: job.requestId,
                    });
                    break;

                case JobType.VOTE1:
                    console.info(`JobType.VOTE1 ${job.requestId}`);
                    await this.voteAgreement(this.validator1, job.requestId);

                    this.addJob({
                        type: JobType.VOTE2,
                        requestId: job.requestId,
                    });
                    break;

                case JobType.VOTE2:
                    console.info(`JobType.VOTE2 ${job.requestId}`);
                    await this.voteAgreement(this.validator2, job.requestId);

                    this.addJob({
                        type: JobType.VOTE3,
                        requestId: job.requestId,
                    });
                    break;

                case JobType.VOTE3:
                    console.info(`JobType.VOTE3 ${job.requestId}`);
                    await this.voteAgreement(this.validator3, job.requestId);

                    this.addJob({
                        type: JobType.COUNT,
                        requestId: job.requestId,
                    });
                    break;

                case JobType.COUNT:
                    const res = await (await this.getContract()).canCountVote(job.requestId);
                    if (res === 1) {
                        console.info(`JobType.COUNT, Counting is possible. ${job.requestId}`);
                        await this.countVote(job.requestId);
                    } else if (res === 2) {
                        console.info(`JobType.COUNT, Counting is impossible. ${job.requestId}`);
                        this.addJob({
                            type: JobType.COUNT,
                            requestId: job.requestId,
                        });
                    } else {
                        console.info(`JobType.COUNT, Counting has already been completed. ${job.requestId}`);
                    }
                    break;
            }
        }
    }

    private addJob(job: IJob) {
        this._jobList.push(job);
    }

    private getJob(): IJob | undefined {
        return this._jobList.shift();
    }
}

export enum WorkerState {
    NONE = 0,
    STARTING = 2,
    RUNNING = 3,
    STOPPING = 4,
    STOPPED = 5,
}

export class Worker {
    protected task: cron.ScheduledTask | null = null;
    private readonly _validator: FakerValidator;

    protected state: WorkerState;

    protected expression: string;

    private is_working: boolean = false;

    constructor(expression: string, validator: FakerValidator) {
        this._validator = validator;
        this.expression = expression;
        this.state = WorkerState.NONE;
    }

    public async start() {
        this.state = WorkerState.STARTING;
        this.is_working = false;
        this.task = cron.schedule(this.expression, this.workTask.bind(this));
        this.state = WorkerState.RUNNING;
        await this.onStart();
    }

    public async onStart() {
        //
    }

    public async stop() {
        this.state = WorkerState.STOPPING;

        if (!this.is_working) {
            this.state = WorkerState.STOPPED;
        }

        await this.onStop();
    }

    public async onStop() {
        //
    }

    private stopTask() {
        if (this.task !== null) {
            this.task.stop();
            this.task = null;
        }
    }

    public waitForStop(timeout: number = 60000): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            const start = Math.floor(new Date().getTime() / 1000);
            const wait = () => {
                if (this.state === WorkerState.STOPPED) {
                    this.stopTask();
                    resolve(true);
                } else {
                    const now = Math.floor(new Date().getTime() / 1000);
                    if (now - start < timeout) setTimeout(wait, 10);
                    else {
                        this.stopTask();
                        resolve(false);
                    }
                }
            };
            wait();
        });
    }

    public isRunning(): boolean {
        return this.task !== null;
    }

    public isWorking(): boolean {
        return this.is_working;
    }

    private async workTask() {
        if (this.state === WorkerState.STOPPED) return;
        if (this.is_working) return;

        this.is_working = true;
        try {
            await this.work();
        } catch (error) {
            console.error({
                validatorIndex: "none",
                method: "Worker.workTask()",
                message: `Failed to execute a scheduler: ${error}`,
            });
        }
        this.is_working = false;

        if (this.state === WorkerState.STOPPING) {
            this.state = WorkerState.STOPPED;
        }
    }

    protected async work() {
        await this._validator.onWork();
    }
}
