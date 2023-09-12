import { Context } from "./client-common/context";
import { ClientMethods } from "./internal/client/methods";
import { IClient, IClientMethods } from "./interfaces";
import { ClientCore } from "./client-common/core";

/**
 * Provider a generic client with high level methods to manage and interact with DAO's
 */
export class Client extends ClientCore implements IClient {
    private privateMethods: IClientMethods;

    constructor(context: Context) {
        super(context);
        this.privateMethods = new ClientMethods(context);
        Object.freeze(Client.prototype);
        Object.freeze(this);
    }

    get methods(): IClientMethods {
        return this.privateMethods;
    }
}
