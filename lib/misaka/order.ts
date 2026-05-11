import { MisakaClient, type CreateInstanceParams } from "./client";
export async function createMisakaOrder(client: MisakaClient, params: CreateInstanceParams) { return client.createInstance(params); }
