import fetch, { UnfetchResponse } from "unfetch";
import { GenericRecord, IHttpConfig } from "../client-common/interfaces/common";

export namespace Network {
    /**
     * Performs a request and returns a JSON object with the response
     */

    export async function get(config: IHttpConfig, path: string, data?: GenericRecord): Promise<UnfetchResponse> {
        const { url, headers } = config;
        const endpoint: URL = new URL(path, url);
        for (const [key, value] of Object.entries(data ?? {})) {
            if (value != null) {
                endpoint.searchParams.set(key, String(value));
            }
        }
        const response: UnfetchResponse = await fetch(endpoint.href, {
            method: "GET",
            headers,
        });
        return response;
    }

    export async function post(config: IHttpConfig, path: string, data?: any) {
        const { url, headers } = config;
        const endpoint: URL = new URL(path, url);
        const response: UnfetchResponse = await fetch(endpoint.href, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            body: JSON.stringify(data),
        });

        return response;
    }
}
