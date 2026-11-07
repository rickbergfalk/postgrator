// Removes the build output so renamed/deleted sources cannot leave stale
// compiled files behind in the published package.
import fs from "node:fs";

fs.rmSync(new URL("../dist", import.meta.url), {
  recursive: true,
  force: true,
});
