# Release Process

This document defines the minimum release hygiene for `poke-eval`.

## Release types

- Stable release: `vX.Y.Z`
- Nightly pre-release: `nightly-vX.Y.Z-YYYYMMDD.RUN.ATTEMPT`

## Versioning policy

Use `MAJOR.MINOR.PATCH` for stable releases.

- `MAJOR` bump (`X+1.0.0`) when:
   - public CLI flags/behavior are removed or changed incompatibly
   - exported API contracts/types change in a breaking way
   - team JSON schema expectations change incompatibly

- `MINOR` bump (`X.Y+1.0`) when:
   - new backward-compatible features are added (new CLI flags, new outputs, new supported mechanics)
   - packaging/distribution capability is added without breaking existing usage

- `PATCH` bump (`X.Y.Z+1`) when:
   - bug fixes are backward-compatible
   - accuracy tuning, docs fixes, and internal refactors do not change public contracts

Pre-release/nightly tags do not replace stable SemVer tags; they are for preview and automation channels.

## Release checklist

1. Validation is green
   - `npm run validate:all`
2. CI workflows pass on `main`
   - `.github/workflows/validate.yml`
   - `.github/workflows/mechanics-validation.yml`
   - `.github/workflows/nightly-portable-builds.yml`
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

- Stable:
   - `git tag vX.Y.Z`
   - `git push origin vX.Y.Z`
- Nightly (automated):
   - published by `.github/workflows/nightly-portable-builds.yml`
   - portable runtime builds are produced for all supported platforms from the Ubuntu job as `.tar.gz` assets
   - single-file binaries are still built on their native CI runners where needed, especially macOS signing

## Post-release hygiene

- Create/refresh the `[Unreleased]` section in `CHANGELOG.md`.
- Add roadmap follow-ups discovered during release testing.
- Record any validation flake or reproducibility issue in an issue/PR note.
