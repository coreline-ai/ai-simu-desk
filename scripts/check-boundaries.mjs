import { readdir, readFile } from "node:fs/promises";
for (const area of ["domain", "application"]) {
  for (const name of (await readdir(`server/${area}`)).filter(n => n.endsWith(".ts"))) {
    const source = await readFile(`server/${area}/${name}`, "utf8");
    for (const [, path] of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      if (/drizzle|hono|three|better-auth|(?:\.\.\/)(?:db|adapters)\//.test(path)) throw new Error(`Dependency boundary violation in ${area}/${name}: ${path}`);
    }
  }
}
console.log("Domain/application dependency boundaries: OK");
