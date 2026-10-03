# Contributing

## Run the checks

Run all four before you open a pull request.

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
```

Run `npm run format` to fix formatting.

## Where tests live

Tests sit next to the code they cover, as `*.test.ts` and `*.test.tsx` files under `src/`.

- `src/content/source.contract.ts` is the shared contract suite. Every adapter runs it.
- `src/content/adapters/wordpress/wordpress.contract.test.ts` runs that suite against a live WordPress. It is skipped unless `WP_GRAPHQL_URL` is set.
- The other WordPress adapter tests use recorded responses and need no network.

## Commit style

- Write the subject in the imperative, for example `Add tag-based revalidation webhook`.
- Keep the subject under about 72 characters, with no trailing full stop.
- Add a body when the reason for the change is not obvious from the subject.
- Keep each commit to one change.

## Writing rules for docs

Use short sentences and the second person for instructions. Do not use em dashes, en dashes or exclamation marks. Put every command and snippet in a code block.
