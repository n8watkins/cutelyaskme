import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

type Database = ReturnType<typeof createDatabase>;

let client: Client | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

function createDatabase(databaseClient: Client) {
  return drizzle(databaseClient, { schema });
}

export function getDbClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is required");
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export function getDb(): Database {
  database ??= createDatabase(getDbClient());
  return database;
}

// Preserve the existing import surface while deferring credentials and network
// setup until a request actually uses the database.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const value = Reflect.get(getDb(), property);
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
});
