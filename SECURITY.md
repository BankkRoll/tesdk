# Security Policy

## Reporting a vulnerability

Report privately through
[GitHub Security Advisories](https://github.com/BankkRoll/tesdk/security/advisories/new).
Please do not open a public issue for a security problem.

Include a description, a reproduction, and the impact you believe it has.
Expect an initial response within a few days.

## Scope

This SDK mediates access to real vehicles and home batteries, so the following
are treated as security issues rather than ordinary bugs:

- Credentials leaking into logs, errors, or the `onRequest` hook
- A token being sent to the wrong host or with the wrong scheme
- Path handling that lets a crafted VIN or id escape its intended route
- PKCE, `state`, or token-refresh handling that weakens the OAuth flow
- A non-idempotent command being retried, which could actuate a vehicle twice

Vulnerabilities in the example applications are in scope too, since people copy
them.

## Handling credentials

If you are building on this SDK:

- **Never ship a client secret to a browser.** Use PKCE for public clients, and
  keep the confidential flow on a server.
- **Treat a refresh token like a password.** It grants the same access until
  revoked. The CLI example stores it mode `600`; a server should encrypt it at
  rest.
- **Keep your virtual-key private key out of the application process.** Tesla's
  guidance is to hold it in a KMS or HSM. Only the *public* key is ever hosted,
  at `/.well-known/appspecific/com.tesla.3p.public-key.pem`.
- **Include `requestId`, not tokens, in bug reports.**

The repository's `.gitignore` blocks `*.pem`, `*.key`, `tokens.json`, `.env`,
and `.dev.vars` for this reason.

## Supported versions

Until 1.0, security fixes land on the latest minor release only.
