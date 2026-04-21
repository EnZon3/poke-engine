# In-Battle Gimmicks Accuracy Verification (2026-04-12)

## Scope

Validate implemented in-battle behavior for:

- Mega Evolution
- Dynamax
- Terastallization

This report focuses on mechanics currently modeled by `poke-eval` evaluation logic, not full turn-engine simulation parity.

## Source references

- Pokémon Showdown core battle actions and tests:
  - https://github.com/smogon/pokemon-showdown/blob/master/sim/battle-actions.ts
  - https://github.com/smogon/pokemon-showdown/blob/master/test/sim/misc/megaevolution.js
  - https://github.com/smogon/pokemon-showdown/blob/master/test/sim/misc/dynamax.js
  - https://github.com/smogon/pokemon-showdown/blob/master/test/sim/misc/terastal.js

## Verified checks

### Mega Evolution

- Gen gating:
  - Enabled only in Gen 6-7 under default policy.
  - Disabled under `mechanicsPolicy: disable-all`.
- In-battle form behavior:
  - `buildPokemon()` resolves to Mega species when active.
  - Mega default ability is applied from species data.

Automated checks:

- `tests/evaluation.test.ts` (`buildPokemon gates Mega, Tera, and Dynamax by generation`)
- `src/benchmark.ts` scenarios:
  - `Mechanics policy: Mega enabled by generation (Gen 6)`
  - `Mechanics policy: Mega disabled via option (Gen 6)`

### Dynamax

- Gen gating:
  - Enabled only in Gen 8 under default policy.
  - Disabled under `mechanicsPolicy: disable-all`.
- In-battle modeled effects:
  - HP scaling active when Dynamax flag is enabled.
  - Max Move base-power conversion uses cartridge/Showdown BP tables, including Fighting/Poison lower table.

Automated checks:

- `tests/evaluation.test.ts` (`dynamax damage path uses move maxMoveBasePower when available`)
- `src/benchmark.ts` scenarios:
  - `Mechanics policy: Dynamax enabled by generation (Gen 8)`
  - `Mechanics policy: Dynamax disabled via option (Gen 8)`

### Terastallization

- Gen gating:
  - Enabled only in Gen 9 under default policy.
  - Disabled under `mechanicsPolicy: disable-all`.
- In-battle modeled effects:
  - Defensive typing overridden by Tera type.
  - STAB logic aligns with expected same-type vs off-type tera behavior in modeled paths.

Automated checks:

- `tests/evaluation.test.ts` (`terastallization applies expected STAB multipliers for same-type and off-type tera`)
- `src/benchmark.ts` scenarios:
  - `Mechanics policy: Terastallization enabled by generation (Gen 9)`
  - `Mechanics policy: Terastallization disabled via option (Gen 9)`

## Validation run status

- `npm run validate:test` ✅
- `npm run validate:bench` ✅
- `npm run validate:all` ✅

## Added second-tier benchmark coverage

Additional benchmark scenarios now cover edge gimmick paths:

- Tera defensive pivot (enabled/disabled) against Electric pressure.
- Dynamax Fighting/Poison BP bucket behavior (enabled/disabled).
- Dynamax non-Fighting setup-line behavior (enabled/disabled).

These scenarios are implemented in `src/benchmark.ts` and validated in `validate:bench`.

## Current limitations (explicit)

- This project remains an evaluation engine, not a full battle simulator.
- Gimmick modeling is intentionally scoped to effects used in ranking logic.
- Not all edge-case gimmick interactions (e.g., full turn-by-turn Max Move side effects, every special-case forme edge interaction) are fully simulated.
