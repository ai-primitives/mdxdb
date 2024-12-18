import { DatabaseProvider } from "@mdxdb/types";
import { Hono } from "hono";

export function createServer(config: { provider: DatabaseProvider }) {
  const app = new Hono();
  const provider = config.provider;

  app.get("/api/collections/:name", async (c) => {
    const name = c.req.param("name");
    const collection = provider.collection(name);
    const result = await collection.find({});
    return c.json(result);
  });

  return app;
}
