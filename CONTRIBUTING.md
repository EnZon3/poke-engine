# Contributing to poke-eval

Thanks for helping improve `poke-eval`.

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
- `npm run validate:test`
- `npm run validate:bench`

Or run both:

- `npm run validate:all`

If you touch battle mechanics, also review:

- `docs/MECHANICS_CHANGE_PROTOCOL.md` (required pre-change read)
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

Use the GitHub issue forms so required troubleshooting details are captured consistently.

When filing a bug, include:

- Command/options used
- Input teams (or sanitized reproducer)
- Expected behavior vs actual behavior
- Relevant output snippet
- Environment details (Node version, OS)

Maintainers triage issues using labels in `.github/labels.yml` (type, area, and status).

## Accuracy contributions

If your contribution is about battle correctness, please follow the contributor workflow in:

- `docs/MECHANICS_CHANGE_PROTOCOL.md`
- `docs/ENGINE_ACCURACY_VERIFICATION.md`

This keeps mechanics improvements reproducible and reviewable.

## Release notes and hygiene

For maintainers preparing a tag, follow:

- `CHANGELOG.md`
- `docs/RELEASE_PROCESS.md`
