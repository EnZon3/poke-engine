# Contributing to poke-engine

Thanks for helping improve `poke-engine`.

## Quick start

1. Fork and clone the repository.
2. Install dependencies:
   - `npm install`
3. Create a branch:
   - `git checkout -b feature/short-description`

## Development standards

- Keep PRs focused on one concern when possible.
- Preserve existing CLI/API behavior unless intentionally changing it.
- Add or update docs for any behavior or interface changes.
- Prefer small, composable modules over large monolithic files.

## Required local validation

Before opening a PR, run:

- `npm run validate:typecheck`
- `npm run validate:bench`

Or run both:

- `npm run validate:all`

If you touch battle mechanics, also review:

- `docs/MECHANICS_VALIDATION.md`
- `docs/ENGINE_ACCURACY_VERIFICATION.md`

## PR checklist

- [ ] Branch is up to date with `main`.
- [ ] Code compiles and typechecks.
- [ ] Benchmark validation passes.
- [ ] New behavior is documented.
- [ ] If mechanics changed, include references and spot-check notes in PR description.

## Commit message guidance

Use clear, scoped messages. Example format:

- `tui: split monolithic view into modules`
- `evaluation: tune doubles support weighting`
- `docs: add mechanics verification workflow`

## Reporting issues

When filing a bug, include:

- Command/options used
- Input teams (or sanitized reproducer)
- Expected behavior vs actual behavior
- Relevant output snippet
- Environment details (Node version, OS)

## Accuracy contributions

If your contribution is about battle correctness, please follow the contributor workflow in:

- `docs/ENGINE_ACCURACY_VERIFICATION.md`

This keeps mechanics improvements reproducible and reviewable.

## Release notes and hygiene

For maintainers preparing a tag, follow:

- `CHANGELOG.md`
- `docs/RELEASE_PROCESS.md`
