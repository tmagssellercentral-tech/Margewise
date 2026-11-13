// Which Shopify store the current piece of work is for. The owner store (Flexi Muscles) runs with
// no context and uses its own credentials from the environment; every store that installed the
// app from the App Store runs inside `runForStore` with its own token.

import { AsyncLocalStorage } from "node:async_hooks";

export interface StoreCredentials {
  store: string; // some-store.myshopify.com
  token: () => Promise<string>;
}

const als = new AsyncLocalStorage<StoreCredentials>();

export const currentStore = () => als.getStore() ?? null;
export const runForStore = <T>(c: StoreCredentials, fn: () => Promise<T>) => als.run(c, fn);
