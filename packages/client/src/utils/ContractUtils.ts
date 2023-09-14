/**
 *  Includes various useful functions for the solidity
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */
import { defaultAbiCoder } from "@ethersproject/abi";
import { Signer } from "@ethersproject/abstract-signer";
import { BigNumberish } from "@ethersproject/bignumber";
import { arrayify } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { verifyMessage } from "@ethersproject/wallet";

import * as crypto from "crypto";

export class ContractUtils {
    /**
     * It generates hash values.
     * @param data The source data
     */
    public static sha256(data: Buffer): Buffer {
        return crypto
            .createHash("sha256")
            .update(data)
            .digest();
    }

    public static sha256String(data: string): string {
        return ContractUtils.BufferToString(
            crypto
                .createHash("sha256")
                .update(Buffer.from(data.trim()))
                .digest()
        );
    }

    /**
     * Convert hexadecimal strings into Buffer.
     * @param hex The hexadecimal string
     */
    public static StringToBuffer(hex: string): Buffer {
        const start = hex.substring(0, 2) === "0x" ? 2 : 0;
        return Buffer.from(hex.substring(start), "hex");
    }

    /**
     * Convert Buffer into hexadecimal strings.
     * @param data The data
     */
    public static BufferToString(data: Buffer): string {
        return "0x" + data.toString("hex");
    }

    public static getTimeStamp(): number {
        return Math.floor(new Date().getTime() / 1000);
    }

    public static delay(interval: number): Promise<void> {
        return new Promise<void>((resolve, _) => {
            setTimeout(resolve, interval);
        });
    }

    public static getRequestId(emailHash: string, address: string, nonce: BigNumberish): string {
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "address", "uint256", "bytes32"],
            [emailHash, address, nonce, crypto.randomBytes(32)]
        );
        return keccak256(encodedResult);
    }

    public static getRequestHash(email: string, address: string, nonce: BigNumberish): Uint8Array {
        const encodedResult = defaultAbiCoder.encode(
            ["bytes32", "address", "uint256"],
            [ContractUtils.sha256String(email), address, nonce]
        );
        return arrayify(keccak256(encodedResult));
    }

    public static async signRequestData(signer: Signer, email: string, nonce: BigNumberish): Promise<string> {
        const message = ContractUtils.getRequestHash(email, await signer.getAddress(), nonce);
        return signer.signMessage(message);
    }

    public static verifyRequestData(address: string, email: string, nonce: BigNumberish, signature: string): boolean {
        const message = ContractUtils.getRequestHash(email, address, nonce);
        let res: string;
        try {
            res = verifyMessage(message, signature);
        } catch (error) {
            return false;
        }
        return res.toLowerCase() === address.toLowerCase();
    }
}
