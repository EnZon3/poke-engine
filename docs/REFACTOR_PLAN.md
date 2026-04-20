# Refactor Plan

Date: 2026-04-17
Branch: `refactor/core-boundaries`

## Scope

- Reduce development friction by tightening module boundaries in data loading, parsing, evaluation orchestration, benchmark scenario definition, and TUI view-model shaping.
- Keep behavior stable while refactoring.

## Non-goals

- No feature work from roadmap items in this branch.
- No mechanics/ranking behavior changes.
- No broad UI redesign in this branch.

## Guardrail

- Refactor PRs in this branch must preserve behavior and pass validation gates before merge.

## Linear Task List

- [x] 1. Freeze behavior baseline: run `npm run validate:all` and capture benchmark baseline output for comparison.
- [x] 2. Create branch `refactor/core-boundaries` and add this refactor plan with scope + non-goals + no-behavior-change guardrail.
- [x] 3. Split `src/data.ts` into pure normalization modules:
  `src/data/normalize-species.ts`, `src/data/normalize-moves.ts`,
  `src/data/normalize-abilities.ts`, `src/data/normalize-items.ts`.
  Keep `loadData()` public API unchanged.
- [x] 4. Split `src/data.ts` fetchers from transformers:
  `src/data/fetch-showdown.ts`, `src/data/fetch-pokeapi.ts`.
- [x] 5. Add focused tests for extracted data normalizers.
- [x] 6. Refactor `src/team-import.ts` into parser stages under `src/team-import/`.
- [x] 7. Add parser parity tests for supported import shapes and edge cases.
- [x] 8. Split `src/evaluation/index.ts` into orchestration + branch logic modules.
- [x] 9. De-duplicate strictly identical singles/doubles shared logic only.
- [x] 10. Move benchmark scenario data out of `src/benchmark.ts`.
- [x] 11. Introduce benchmark fixture builders for repeated scenario shapes.
- [x] 12. Extract TUI view-model transformations from rendering.
- [x] 13. Standardize repeated CLI option parsing/validation patterns.
- [x] 14. Add module-level public-surface tests for refactored areas.
- [x] 15. Final consolidation: remove dead internals, rerun `validate:all`, compare benchmark output to baseline.

## Baseline Artifacts

- Validation command baseline: `npm run validate:all` passed on 2026-04-17.
- Benchmark snapshot:
  `docs/validation-reports/REFACTOR_BENCH_BASELINE_2026-04-17.txt`
