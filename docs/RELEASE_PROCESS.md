# Release Process

This document defines the minimum release hygiene for `poke-engine`.

## Release types

- Pre-release: `vX.Y.Z-rc.N`
- Stable release: `vX.Y.Z`

## Pre-release checklist

1. Validation is green
   - `npm run validate:all`
2. CI workflows pass on `main`
   - `.github/workflows/validate.yml`
   - `.github/workflows/mechanics-validation.yml`
3. Documentation is current
   - `README.md`
   - `docs/API.md`
   - `docs/MECHANICS_VALIDATION.md`
   - `docs/ENGINE_ACCURACY_VERIFICATION.md`
4. Changelog is updated
   - Move relevant items from `[Unreleased]` into the release section in `CHANGELOG.md`
5. Known limitations are explicitly stated
   - Ensure simulator-scope caveats and planned mechanics work are documented.

## Tagging convention

- Pre-release:
  - `git tag v0.1.0-rc.1`
  - `git push origin v0.1.0-rc.1`
- Stable:
  - `git tag v0.1.0`
  - `git push origin v0.1.0`

## Post-release hygiene

- Create/refresh the `[Unreleased]` section in `CHANGELOG.md`.
- Add roadmap follow-ups discovered during release testing.
- Record any validation flake or reproducibility issue in an issue/PR note.
