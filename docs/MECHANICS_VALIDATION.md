# Mechanics Validation Notes

Last updated: April 2026

This document explains how battle mechanics are validated in `poke-engine`, what confidence level each area currently has, and where simplifications still exist.

## Validation goals

- Keep core ranking behavior mechanically sensible across generations and formats.
- Detect regressions when changing evaluation heuristics.
- Document known simplifications so contributors can interpret output correctly.

## Validation pipeline

### Automated checks

- `npm run validate:typecheck`
  - Static safety check for TypeScript changes.
- `npm run validate:bench`
  - Scenario benchmark for singles + doubles ranking behavior.
- `npm run validate:all`
  - Runs both checks above in sequence.

### Manual spot checks

For mechanics-sensitive changes (damage, speed, status, weather, setup), compare selected cases against at least one trusted external reference and record findings in PR notes.

## External references used

- Pokémon Showdown damage calculator:
  - https://calc.pokemonshowdown.com/
- Serebii damage overview:
  - https://www.serebii.net/games/damage.shtml
- Pokémon Database type chart:
  - https://pokemondb.net/type
- Psypoke stat stage reference:
  - http://www.psypokes.com/lab/stats.php
- Pokémon Database stat formula discussion (Gen 3+):
  - https://pokemondb.net/pokebase/170806/what-is-the-formula-to-calculate-ivs-and-evs

## Mechanics currently aligned

- Stat stage fractions:
  - Positive: +1 = 3/2 through +6 = 4
  - Negative: -1 = 2/3 through -6 = 1/4
- Type chart handling for dual types:
  - Immunity (`0x`), resist (`0.5x`), neutral (`1x`), super-effective (`2x`) with multiplicative stacking.
- STAB handling:
  - Standard `1.5x`, Adaptability path supported.
- Core status interactions:
  - Burn physical-attack penalty (with ability exceptions where modeled).
  - Paralysis speed/action reliability effects in expected-outcome logic.
- Battle condition impacts:
  - Reflect/Light Screen modeled.
  - Weather offensive effects for rain/sun and selected defensive boosts.
- Hazard handling:
  - Stealth Rock based on Rock effectiveness.
  - Spikes by layer count with grounded checks.
- Damage randomness:
  - 16-roll model (`85%..100%`) used for expected damage and KO odds.

## Setup-discovery behavior

The evaluator checks setup-first lines in addition to immediate attacks:

- Identifies setup-capable status moves from data + fallback mapping.
- Simulates setup into follow-up attacks across short lookahead windows.
- Compares setup line versus direct line under conservative response assumptions.
- Emits tactical notes when setup lines are selected.

## Known approximations

- Not a full battle simulator:
  - No exhaustive turn tree, queue simulation, or universal switch-branch search.
- Mechanics coverage is uneven by feature:
  - Many move/item/ability interactions are intentionally partial.
- Some generation/corner-case differences are simplified.
- Critical-hit and exception-heavy mechanics are not modeled at full fidelity.

## Confidence guidance

- High confidence:
  - Type matchups, baseline stat math, core damage bands, broad role/risk ranking.
- Medium confidence:
  - Setup discovery outcomes and doubles support-tempo valuation.
- Lower confidence:
  - Rare interaction edge-cases and highly specialized endgame lines.

## When to update this file

Update this document when you change any of:

- Stat formulas or stage logic.
- Damage multipliers or KO probability logic.
- Status/weather/screen/hazard modeling.
- Setup simulation assumptions.
- Any benchmark expectations tied to mechanic interpretation.
