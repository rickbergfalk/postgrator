import assert from "assert";
import createClient from "../src/lib/createClient.js";
import { describe, it } from "node:test";

void describe("createClient", function () {
  void it("throws an unsupported-driver error including the driver name", function () {
    // Cast to bypass TypeScript's strict union typing for the test
    const config = { driver: "nope" } as unknown as Parameters<
      typeof createClient
    >[0];
    try {
      createClient(config);
      assert.fail("should have thrown");
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.strictEqual(
        err.message,
        "db driver 'nope' not supported. Must be one of: mysql, mssql, sqlite3 or pg"
      );
    }
  });
});
