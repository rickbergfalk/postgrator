# TypeScript Migration Review

Review of the `typescript` branch against `master` for the upcoming major release.

## Checks Run

- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm run build` — passed
- `npm test` — passed, 143/143 tests
- `npm pack --dry-run` — passed
- Built package imported successfully from an external TypeScript consumer

Overall, the core port is structurally sound. Generated declarations work, namespace merging works, event overloads compile, and the compiled package imports correctly. The findings below are ordered roughly by area and priority.

---

## Correctness / Type Safety

### 7. Defaults can be overwritten by explicit `undefined`

`Object.assign({}, DEFAULT_CONFIG, options)` (`src/postgrator.ts:27-30`) means `{ schemaTable: undefined }` overrides the default with `undefined`, later crashing in `quotedSchemaTable()`.

`exactOptionalPropertyTypes` is not enabled, so TypeScript permits this. Using nullish coalescing or `??=` would be safer. The same applies to `validateChecksums: undefined`, which currently disables checksum validation instead of retaining the default.

---

## Tests

### 8. Coverage regressed when `test/api.test.js` was deleted

The deleted JS test contained:

- `assert.strictEqual(m.name, "")`
- lookup of migration 002 and `assert.strictEqual(m2.name, "some-description")`

The retained `test/api.test.ts` only asserts `m.hasOwnProperty("name")` (`test/api.test.ts:75`), so migration name parsing is no longer verified.

Restore those assertions in the TS test.

### 9. The failure test still passes if migration unexpectedly succeeds

`test/migration-failure.test.ts:51-62` uses `.then(() => {}, onRejected)`, so a successful `migrate()` is silently accepted.

It should assert rejection, e.g. fail when the fulfilled callback runs.

### 10. No test of the built package or published types

All tests import `../src/...` through `tsx`.

`npm run build` / `dist` output is never exercised in CI.

A small smoke test importing from the packed package, or at least `tsc` against `dist`, would catch packaging and declaration regressions.

### 11. Lint coverage effectively no longer includes the real source

`eslint "**/*.{js,mjs,cjs}"` (`package.json:29`) only lints JS files. All source and tests are now TS, so ESLint only really checks the config file.

Example miss: `test/api.test.ts:58` declares an unused `migrations` local. `tsc --noUnusedLocals` catches it, but the current lint does not.

Add `typescript-eslint` or at least enable `noUnusedLocals` / `noUnusedParameters`.

### 12. Minor test portability concern

The old JS API test used `path.join(__dirname, "/fail*/*")`; the retained TS test uses a hard-coded forward slash template (`test/api.test.ts:81`). Linux CI passes, but this is less portable.

The `test` script only matches `test/*.test.ts`, not nested test directories.

---

## Build / Packaging / CI

### 13. CI does not run lint or build

`.github/workflows/test.yml` only runs `npm run typecheck` and `npm test`.

Add `npm run lint` and `npm run build` so formatting, ESLint, and emitted output are checked.

### 14. `dist` is never cleaned before building

`dist/` is gitignored and `prepack` only runs `tsc`.

If a source file is renamed or deleted, stale compiled files can remain in `dist` and get packed.

Add a clean step before `tsc`.

### 15. Git installs may produce a package without `dist`

`dist` is gitignored, and only `prepack` builds it.

For non-registry installs npm runs `prepare` (currently just `husky`), not `prepack`.

Unless registry-only installation is intended, `prepare` should also build, or this behavior should be documented.

### 16. `CHANGELOG.md` is no longer in the published tarball

Old `.npmignore` did not exclude it; the new `files: ["dist"]` whitelist does.

The `npm pack --dry-run` output confirms it is absent.

### 17. Declaration maps point to files not published

`dist/postgrator.d.ts.map` references `../src/postgrator.ts`, but `src` is not in the tarball.

JavaScript maps are fine because `inlineSources` embeds the source; declaration maps are not.

Either include `src`, disable `declarationMap`, or otherwise adjust source map packaging.

### 18. Release metadata not updated

- `package.json` still says `8.0.0`.
- `CHANGELOG.md` has no TypeScript migration entry.
- This is described as a major breaking change, so it should include a version bump, changelog entry, and migration notes.

---

## Documentation

### 19. README has several mismatches to correct with the TS release

- `validateChecksum` should be `validateChecksums`.
- `execQuery` and `migrationPattern` are documented as required but typed as optional.
- Migration objects are documented as always having `md5: 'checksumvalue'`, but JS migrations now correctly type `md5` as optional.
- The example uses `execSqlScript: (sqlScript) => client.sqlScript(sqlScript)`, but `pg.Client` has no `sqlScript` method.
- No TypeScript usage / exported type documentation was added despite the package now shipping generated declarations.

---

## Smaller Items

20. `Postgrator.ExecQuery` and `Postgrator.ExecSqlScript` are exported at the top level but missing from the `Postgrator` namespace aliases (`src/postgrator.ts` namespace block), unlike the other public types.

21. `commonClient` is public and exposes the internal abstract `Client` type in the generated public declarations. Consider making it private/internal unless intentionally part of the API.

22. The ESLint config still includes `globals.mocha` even though tests use `node:test`.

23. `getMaxVersion()` still returns `-Infinity` for an empty migration directory, and `getRunnableMigrations()` silently returns `[]` for `NaN` targets. Both are pre-existing, but the major release is a good time to decide intended behavior.

24. `src/postgrator.ts` casts caught errors directly to `MigrationError`; if a non-object is thrown, assigning `appliedMigrations` will itself throw. Pre-existing, but worth hardening.

---

## Verified Good

- `tsc` build succeeds and emits JS plus declarations.
- Generated `.d.ts` supports both `Postgrator.Migration` and top-level `Migration` imports.
- Typed event overloads compile correctly.
- `on()` now correctly returns `this`, `Migration.md5` is optional, `getSql` supports promises, and `validateMigrations` has a much better return type than the old hand-written declaration.
- All driver tests pass across pg/mssql/mysql/sqlite3/better-sqlite3.
- The runtime package import from `dist` works.
