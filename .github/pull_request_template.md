<!--
Security issues go through a private advisory instead:
https://github.com/BankkRoll/tesdk/security/advisories/new
-->

## What changed

<!-- And why. Link an issue if there is one. -->

## Checklist

- [ ] `npm run verify` passes
- [ ] `npx changeset` added, or this changes nothing published
- [ ] New exports have TSDoc with `@param` / `@returns`
- [ ] New endpoints link Tesla's documentation and have a real response type
- [ ] Tests cover the behaviour, including the failure path

### For a new command

- [ ] Idempotency is correct — anything with a visible physical effect
      (horn, trunk, media, lights) must **not** be retried
- [ ] A test asserts the retry disposition
