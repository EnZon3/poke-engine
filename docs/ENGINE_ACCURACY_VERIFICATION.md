# Engine Accuracy Verification Guide

Last updated: April 2026

This guide is for contributors who want to validate and improve battle-mechanics accuracy.

## Objective

Provide a repeatable workflow to:

- identify an accuracy gap,
- reproduce it with a minimal case,
- implement a fix,
- verify no major regressions.

## Contributor workflow

1. Pick one focused mechanics topic
   - Examples: stat stages, weather multipliers, hazards, status effects, KO chance handling.
2. Create a minimal reproducible case
   - Keep sets and battle state as small as possible.
3. Compare with trusted references
   - Prefer Showdown calculator + at least one secondary source.
4. Implement the smallest viable fix
   - Avoid broad unrelated tuning in the same PR.
5. Validate
   - `npm run validate:all`
   - Plus targeted manual checks for your scenario.
6. Document
   - Add a brief note to PR with reference links and before/after behavior.

## Evidence template for PRs

Use this structure in your PR description:

- Mechanic area:
- Scenario setup:
- Reference expectation:
- Engine behavior before:
- Engine behavior after:
- Validation commands run:
- Risks / known limitations:

## Recommended references

- https://calc.pokemonshowdown.com/
- https://www.serebii.net/games/damage.shtml
- https://pokemondb.net/type

## Scope reminder

`poke-engine` is a practical matchup-ranking engine, not a full battle simulator.

A contribution is still valuable when it improves ranking quality and internal consistency even if it does not implement every edge-case interaction.
