# Contributing

Thanks for helping improve tesdk.

## Setup

```sh
git clone https://github.com/BankkRoll/tesdk.git
cd tesdk
npm install
```

The repo is an npm workspace. `npm install` at the root wires the SDK and every
example together — the examples resolve `tesdk` to your local build, so changes
show up immediately.

## The loop

```sh
npm run dev        # rebuild on change
npm run test:watch # tests on change
npm run verify     # everything CI runs
```

`verify` chains typecheck, lint, tests, build, [publint](https://publint.dev),
and [attw](https://arethetypeswrong.github.io). Run it before opening a pull
request; CI runs the same thing.

## Standards

The bar is high because this is a client library people depend on.

- **No `any`, no unexplained casts, no `@ts-expect-error`.** `strict`,
  `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` are all on.
- **TSDoc on every export** — `@param`, `@returns`, `@throws`, units, and
  constraints. Include an `@example` where it helps.
- **Comments explain _why_, not _what_.** If the code already says it, delete
  the comment. Notes about Tesla-specific quirks are the exception and are very
  welcome.
- **Tests for behaviour, not coverage.** Thresholds sit at 99% statements and
  100% functions; a change that drops them needs a reason.

## Adding an endpoint

1. Add the method to the matching `src/resources/*.ts`, with a real response
   type rather than `unknown`.
2. Link the [Fleet API docs](https://developer.tesla.com/docs/fleet-api) for
   that endpoint in the TSDoc.
3. Decide whether it is idempotent. Anything with a visible physical effect —
   a horn, a trunk, a media skip — must **not** be retried. See
   `CommandsResource.send`.
4. Export any new types from `src/index.ts`.
5. Add a test asserting the verb, path, and retry disposition.

## Changesets

Anything that changes the published package needs one:

```sh
npx changeset
```

Pick `patch` for fixes, `minor` for new endpoints or options, `major` for
breaking changes. Docs-only and example-only changes do not need a changeset.

## Examples

Each directory under `examples/` is its own workspace with its own README and
`tsconfig.json`. They are held to the same standard as the SDK and must
typecheck and build.

## Reporting bugs

Include the SDK version, runtime, a minimal reproduction, and — if the failure
came from Tesla — the `requestId` off the error. That is the `x-txid` header,
and Tesla support asks for it.

Never paste a token, a refresh token, or a private key into an issue.
