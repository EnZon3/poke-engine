# TUI User Guide

This guide walks through every screen, prompt, and keybinding in the poke-engine terminal user interface (TUI).

## Table of contents

- [Launching the TUI](#launching-the-tui)
- [Setup phase](#setup-phase)
  - [Step-by-step questions](#step-by-step-questions)
  - [Littleroot Dreams game codes](#littleroot-dreams-game-codes)
- [Editor phase](#editor-phase)
  - [Editor keybindings](#editor-keybindings)
  - [Editable fields and their formats](#editable-fields-and-their-formats)
- [Results phase](#results-phase)
  - [Results keybindings](#results-keybindings)
  - [Reading the matchup cards](#reading-the-matchup-cards)
  - [Fullscreen help view](#fullscreen-help-view)
- [Common workflows](#common-workflows)
- [Tips and troubleshooting](#tips-and-troubleshooting)

---

## Launching the TUI

**From source (Node.js required):**

```bash
npm install        # first time only
npm start -- --tui
```

**From a portable runtime build (no Node.js required):**

```bash
# macOS / Linux
chmod +x ./poke-engine
./poke-engine --tui

# Windows
poke-engine.cmd --tui
```

The TUI opens in your terminal and guides you through three sequential phases: **Setup → Editor → Results**.

---

## Setup phase

When the TUI starts you see the **Teambuilder Setup** wizard. It presents one question at a time. Progress is shown in the top-left (`Step N of M`).

### Setup keybindings

| Key | Action |
|---|---|
| `Up` / `Down` | Change selected option (select questions) |
| `Enter` | Confirm answer and advance to next question |
| `Left Arrow` | Go back to previous question |
| `Esc` or `Ctrl+C` | Exit the TUI |

### Step-by-step questions

#### 1. Generation

```
Generation (1-9, or alias; blank = latest)
```

Type a number (`1`–`9`) or a recognized alias. Leave blank to use the latest generation (Gen 9 / Scarlet & Violet data).

Accepted aliases:

| Input | Generation |
|---|---|
| `1`, `gen1`, `rby`, `kanto` | Gen 1 |
| `2`, `gen2`, `gsc`, `johto` | Gen 2 |
| `3`, `gen3`, `rse`, `frlg`, `hoenn` | Gen 3 |
| `4`, `gen4`, `dppt`, `hgss`, `sinnoh` | Gen 4 |
| `5`, `gen5`, `bw`, `b2w2`, `unova` | Gen 5 |
| `6`, `gen6`, `xy`, `oras`, `kalos` | Gen 6 |
| `7`, `gen7`, `sm`, `usum`, `alola` | Gen 7 |
| `8`, `gen8`, `swsh`, `galar` | Gen 8 |
| `9`, `gen9`, `sv`, `scarletviolet`, `paldea` | Gen 9 |

The generation controls which battle gimmicks are eligible (Mega Evolution, Dynamax, Terastallization) and which species/move data set is loaded.

#### 2. Battle format

```
Battle format
▶ Singles (1v1 matchup matrix)
  Doubles (2v2 lead matrix / VGC-style)
```

- **Singles** — produces a one-on-one matchup matrix. Best for story playthroughs and standard competitive.
- **Doubles** — scores two-Pokémon lead pairs using VGC-style support/tempo heuristics.

#### 3. Battle gimmicks policy

```
Battle gimmicks policy (Mega / Dynamax / Tera)
▶ Default by generation (Gen6-7 Mega, Gen8 Dynamax, Gen9 Tera)
  Disable all battle gimmicks (no Mega / Dynamax / Tera)
```

- **Default by generation** — applies whichever gimmick matches the selected generation: Mega Evolution for Gen 6–7, Dynamax for Gen 8, Terastallization for Gen 9. Gimmicks are ignored outside their native generation regardless of team flags.
- **Disable all** — suppresses all gimmick evaluation. Useful when analyzing base-form matchups or playing on a ruleset that bans gimmicks.

#### 4. Gimmick timing control

```
Gimmick timing control
▶ Manual (use team flags directly: megaForm / teraType / dynamax)
  Auto (engine chooses timing; opponent assumes best response)
```

- **Manual** — the engine uses whatever `megaForm`, `teraType`, or `dynamax` values are set on each Pokémon in the editor. You decide which Pokémon uses the gimmick and when.
- **Auto** — the engine searches for the optimal turn to activate the gimmick and branches the evaluation against the opponent's best counter-gimmick response. Produces more thorough but slower evaluations.

#### 5. Recommendation mode

```
Recommendation mode
▶ Casual (clear + forgiving)
  Competitive (deeper + risk-aware)
  Custom (manual flag tuning)
```

- **Casual** — shorter lookahead, lenient risk profile. Good for story or casual online play where you want fast, clear recommendations.
- **Competitive** — deeper lookahead, stronger risk weighting. Suited for tournaments and rated play where margins matter.
- **Custom** — exposes raw numeric weights (only meaningful when launching from the CLI with explicit flags such as `--role-weight`, `--defensive-weight`, `--opponent-risk-weight`). In the TUI, choose Custom when you have pre-supplied those flags via the command line.

#### 6. Data source

```
Data source
▶ Pokémon Showdown data
  PokeAPI generation species
```

- **Pokémon Showdown data** *(recommended)* — loads species, moves, items, and abilities from the bundled Showdown data set. Fast, complete, and offline-capable.
- **PokeAPI generation species** — fetches species data from the public PokéAPI v2. Requires internet access. Note: PokéAPI does not expose trainer rosters, so trainer lookups always fall back to Littleroot Dreams regardless of this setting.

#### 7. Your team source

```
Your team source
▶ Build interactively (party builder)
  Load from team file (JSON or Showdown)
  Load from save file (PKHeX)
```

- **Build interactively** — starts the editor with a single default slot (Pikachu at Lv 50). Add and edit Pokémon manually.
- **Load from team file** — reads a JSON array or Showdown export text file from disk. You will be prompted for the file path (default: `my-team.json`).
- **Load from save file (PKHeX)** — imports your in-game party from a PKHeX-compatible `.sav` or `.dat` save file. You will be prompted for the save file path (default: `main.sav`).

> **File formats:** JSON files must contain an array of `PokemonSet` objects (see [Data model](../README.md#data-model)). Showdown export text is the plain-text format copied from Pokémon Showdown's teambuilder (species line, stat lines, moves prefixed with `-`).

#### 8. Your team file path *(only if "Load from team file" selected)*

```
Path to your team file (.json or Showdown .txt)
```

Enter the path to your team file relative to the working directory (e.g. `my-team.json`) or an absolute path.

#### 9. Your save file path *(only if "Load from save file" selected)*

```
Path to your save file (.sav/.dat)
```

Enter the path to your PKHeX-compatible save file (e.g. `main.sav`).

#### 10. Opponent source

```
Opponent source
▶ Load opponent from team file (JSON or Showdown)
  Use trainer roster
  Build opponent interactively
```

- **Load from team file** — reads an enemy team from a JSON or Showdown file. Default path: `enemy-team.json`.
- **Use trainer roster** — fetches a named trainer's team from an online database (Littleroot Dreams). You will be asked for the trainer source, game code, and trainer name.
- **Build opponent interactively** — starts with a blank enemy slot for manual entry in the editor.

#### 11. Opponent team file path *(only if "Load from team file" selected)*

```
Path to opponent team file (.json or Showdown .txt)
```

#### 12. Trainer source *(only if "Use trainer roster" selected)*

```
Trainer source
▶ Littleroot Dreams trainer rosters
  PokeAPI fallback (uses Littleroot)
```

Both options resolve to Littleroot Dreams data. The PokeAPI option is listed for completeness but automatically falls back because PokéAPI v2 does not expose trainer party rosters.

#### 13. Game code *(only if "Use trainer roster" selected)*

```
Game code (e.g. sv, swsh, xy)
```

Enter the game code for the title whose trainer roster you want. See the [Littleroot Dreams game codes](#littleroot-dreams-game-codes) table below.

#### 14. Trainer name *(only if "Use trainer roster" selected)*

```
Trainer name
```

Enter the trainer's name as it appears in the game. Matching is case-insensitive and ignores numbers, so `Nemona`, `nemona`, `nemona1`, and `nemona2` all resolve correctly. Partial matches and suffix-stripped variants are also tried automatically.

---

### Littleroot Dreams game codes

The following codes are accepted when selecting **Use trainer roster** → **Game code**. Both the primary code and its accepted aliases work.

| Game | Primary code | Accepted aliases |
|---|---|---|
| Pokémon Red / Blue / Green | `rbg` | `rby`, `rgb`, `gen1` *(note: Littleroot Dreams uses `rbg` internally; `rby` is mapped to it automatically)* |
| Pokémon Yellow | `rbg` | *(same roster as Red/Blue/Green)* |
| Pokémon Gold / Silver / Crystal | `gsc` | `gen2` |
| Pokémon Ruby / Sapphire | `rs` | `rse`, `hoenn`, `gen3` |
| Pokémon Emerald | `rs` | *(same roster as Ruby/Sapphire)* |
| Pokémon FireRed / LeafGreen | `frlg` | `gen3` |
| Pokémon Diamond / Pearl | `dp` | `dppt`, `gen4` |
| Pokémon Platinum | `pt` | `dppt`, `gen4` |
| Pokémon HeartGold / SoulSilver | `hgss` | `gen4` |
| Pokémon Black / White | `bw` | `gen5`, `unova` |
| Pokémon Black 2 / White 2 | `b2w2` | `bw2`, `gen5` |
| Pokémon X / Y | `xy` | `gen6`, `kalos` |
| Pokémon Omega Ruby / Alpha Sapphire | `oras` | `gen6` |
| Pokémon Sun / Moon | `sm` | `gen7`, `alola` |
| Pokémon Ultra Sun / Ultra Moon | `usum` | `gen7` |
| Pokémon Sword / Shield | `swsh` | `gen8`, `galar` |
| Pokémon Scarlet / Violet | `sv` | `gen9`, `scarletviolet`, `paldea` |

> **Note:** Littleroot Dreams does not currently host rosters for Pokémon Let's Go Pikachu/Eevee (LGPE), Brilliant Diamond/Shining Pearl (BDSP), or Legends: Arceus. If you attempt those codes the engine will display an error listing the codes it tried.

**Example — load Nemona from Scarlet/Violet:**

In the TUI setup, when prompted for game code enter `sv` and for trainer name enter `nemona`.

Equivalent CLI command:
```bash
npm start -- --my=my-team.json --game=sv --trainer=nemona
```

**Example — load the rival from Gold/Silver/Crystal:**

Enter game code `gsc` and trainer name `silver` (or `rival`).

```bash
npm start -- --my=my-team.json --game=gsc --trainer=silver
```

**Example — load Cynthia from Diamond/Pearl:**

Enter game code `dp` and trainer name `cynthia`.

```bash
npm start -- --my=my-team.json --game=dp --trainer=cynthia
```

---

## Editor phase

After setup completes, the TUI switches to the **Editor** screen. The screen is divided into three panels:

| Panel | Border colour | Contents |
|---|---|---|
| **Party** (left) | Cyan | Your team slots (Pokémon name + level) |
| **Config Editor** (centre) | Green | Fields for the currently selected Pokémon |
| **Opponent Team** (right) | Blue | Enemy team slots |

The active side being edited is indicated by `(editing)` in the panel title. The selected Pokémon slot is highlighted in yellow with `▶`.

### Editor keybindings

| Key | Action |
|---|---|
| `Up` / `Down` | Move selection between Pokémon slots (within the active side) |
| `Left` / `Right` | Move selection between fields in the Config Editor |
| `o` | Toggle active editing side (your team ↔ enemy team) |
| `e` | Start editing the selected field |
| `Enter` | Commit the edit in progress |
| `Esc` | Cancel the edit in progress |
| `a` | Add a new empty slot to the active side (max 6) |
| `x` | Delete the selected slot from the active side (minimum 1 remains) |
| `p` | Auto-estimate IVs and EVs for the selected slot |
| `s` | Save the active team to a JSON file (prompts for file path) |
| `c` | Calculate matchup results and switch to the Results phase |
| `q` or `Ctrl+C` | Quit the TUI |

### Editable fields and their formats

Use `Left`/`Right` to select a field, then `e` to edit it and `Enter` to commit.

| Field | Description | Format / accepted values |
|---|---|---|
| `species` | Pokémon species name | Exact species name, e.g. `Garchomp`, `Urshifu-Rapid-Strike` |
| `level` | Battle level | Integer 1–100 |
| `nature` | Nature | Standard nature names, e.g. `Jolly`, `Modest`, `Serious` |
| `ability` | Ability | Exact ability name, e.g. `Rough Skin`, `Intimidate`. Leave blank to unset. |
| `item` | Held item | Exact item name, e.g. `Choice Scarf`, `Focus Sash`. Leave blank to unset. |
| `megaForm` | Mega Evolution flag | `Mega` to enable, blank to disable. Only evaluated in Gen 6–7. |
| `teraType` | Tera type | Type name, e.g. `Water`, `Fire`, `Ghost`. Only evaluated in Gen 9. |
| `dynamax` | Dynamax flag | `true` / `yes` / `1` to enable, anything else to disable. Only evaluated in Gen 8. |
| `status` | Persistent status | `brn` (burn), `par` (paralysis), `psn` (poison), `tox` (badly poisoned), `slp` (sleep), `frz` (freeze). Leave blank to clear. |
| `ivs` | Individual Values | Six comma-separated integers (HP, Atk, Def, SpA, SpD, Spe), each 0–31. Example: `31, 31, 31, 31, 31, 31` |
| `evs` | Effort Values | Six comma-separated integers (HP, Atk, Def, SpA, SpD, Spe), each 0–252. Example: `0, 252, 4, 0, 0, 252` |
| `moves` | Move list | Up to four move names separated by commas. Example: `Earthquake, Dragon Claw, Swords Dance, Protect` |

> **IV/EV estimation shortcut:** Press `p` while a slot is selected to let the engine fill in estimated IVs and EVs based on the species and level. This is useful when loading a trainer roster whose spread is not known precisely.

---

## Results phase

After pressing `c` in the editor, the TUI switches to the **Matchup Results** screen. Results are displayed as a grid of cards, one card per enemy Pokémon. Each card shows the best Pokémon from your team to send into that enemy.

### Results keybindings

| Key | Action |
|---|---|
| `Up` / `Down` / `Left` / `Right` | Move selection between cards |
| `Enter` or `e` | Expand / collapse the selected card for detailed stats |
| `h` | Toggle fullscreen help overlay (opens when closed; closes when open) |
| `m` | Close fullscreen help overlay |
| `b` | Return to the editor |
| `r` | Recompute the matchup with the current teams |
| `q` or `Ctrl+C` | Quit the TUI |

### Reading the matchup cards

Each card corresponds to one enemy Pokémon (shown in the card header).

**Compact view (default):**

```
▶ Nemona's Meowscarada
#1 Skeledirge ⚡ (cleaner)
Move Shadow Ball | Conf High
Score +42.3% [████░░░░]
Dmg 65.2-77.1% | 2HKO 94.0%
Alts #2 Annihilape 38% | #3 Corviknight 21%
Note Setup line discovered on turn 2.
```

| Element | Meaning |
|---|---|
| `#1 <name>` | Your top-ranked Pokémon into this enemy |
| `⚡` | Your Pokémon has the speed advantage (acts first in the same priority bracket) |
| `(role)` | Heuristic role tag: `cleaner`, `wallbreaker`, `wall`, `pivot`, or `balanced` |
| `Move` | The highest-value move to use |
| `Conf` | Confidence in the recommendation: `High`, `Medium`, or `Low` |
| `Score` | Net expected advantage over the lookahead window as a percentage. Positive = your side comes out ahead. |
| `[████░░░░]` | Visual bar of the score magnitude (green = positive, red = negative) |
| `Dmg X-Y%` | One-hit damage range against the enemy's current HP using 85%–100% roll variance |
| `2HKO` | Probability of KO within two attacks accounting for accuracy, rolls, and status |
| `Alts` | Second- and third-best options and their scores |
| `Note` | Primary tactical note (setup discovery, hazard penalty, speed tie warning, etc.) |

**Expanded view** (press `Enter` or `e` on a card):

The expanded view adds:

- `1HKO` — probability of one-hit KO
- `Speed` — explicit speed advantage/disadvantage label
- `Role` and `Confidence` on separate lines
- **All tactical notes** listed individually
- **Top three matchup lines** showing Pokémon, best move, and score

### Fullscreen help view

Press `h` from the Results screen to open a fullscreen interpretation guide covering:

- What each output field means
- A practical battle-planning workflow (5 steps)
- Practical KO thresholds for action decisions

Press `h` again to close it, or press `m` to close it.

---

## Common workflows

### Workflow 1 — Quick story-mode check (trainer roster)

1. Launch `npm start -- --tui`
2. **Generation:** enter the generation for the game you are playing (e.g. `9` for Scarlet/Violet)
3. **Battle format:** `Singles`
4. **Gimmicks policy:** `Default by generation`
5. **Gimmick timing:** `Manual`
6. **Mode:** `Casual`
7. **Data source:** `Pokémon Showdown data`
8. **Your team source:** `Build interactively` or `Load from team file`
9. **Opponent source:** `Use trainer roster`
10. **Trainer source:** `Littleroot Dreams trainer rosters`
11. **Game code:** e.g. `sv`
12. **Trainer name:** e.g. `nemona`
13. After loading, review your team in the editor. Press `c` to calculate.
14. Read the results cards to decide which Pokémon to lead and which moves to use.

### Workflow 2 — Loading teams from files

Place your team in `my-team.json` (JSON) or `my-team.txt` (Showdown export) at the project root. Do the same for the enemy team (`enemy-team.json` / `enemy-team.txt`).

Example `my-team.json`:
```json
[
  {
    "species": "Garchomp",
    "level": 50,
    "nature": "Jolly",
    "ability": "Rough Skin",
    "item": "Choice Scarf",
    "teraType": "Ground",
    "ivs": { "hp": 31, "atk": 31, "def": 31, "spa": 31, "spd": 31, "spe": 31 },
    "evs": { "hp": 0, "atk": 252, "def": 0, "spa": 0, "spd": 4, "spe": 252 },
    "moves": ["Earthquake", "Dragon Claw", "Swords Dance", "Protect"]
  }
]
```

In the TUI:
- **Your team source:** `Load from team file` → enter `my-team.json`
- **Opponent source:** `Load opponent from team file` → enter `enemy-team.json`

You can also pass these paths directly on the command line to skip those setup questions:
```bash
npm start -- --tui --my=my-team.json --enemy=enemy-team.json
```

### Workflow 3 — VGC doubles analysis

1. **Battle format:** `Doubles`
2. **Mode:** `Competitive`
3. Build or load a six-Pokémon party and a four-Pokémon enemy lead pool.
4. The results cards score two-Pokémon lead pairs rather than individual matchups.

### Workflow 4 — Saving an edited team

In the editor, after making changes, press `s`. The TUI prompts for a file path (pre-filled with the source path). Press `Enter` to save. The file is written as a JSON array that can be reloaded later.

### Workflow 5 — Comparing two battle states

1. Run a calculation and note the scores (`r` to recompute from the results screen if needed).
2. Press `b` to return to the editor.
3. Change weather (`e` on a Pokémon, update a move or item to reflect the new condition) or adjust EVs.
4. Press `c` again to recompute and compare.

---

## Tips and troubleshooting

**The TUI displays garbled characters**
Make sure your terminal uses a UTF-8 locale and a monospaced font. On macOS Terminal or iTerm2 this works by default. On Windows, use Windows Terminal (not the legacy `cmd.exe` window).

**"Failed to fetch trainer data for …"**
The trainer lookup requires internet access. Check your connection. The error message lists the game codes that were tried — verify you entered a supported game code from the [Littleroot Dreams game codes](#littleroot-dreams-game-codes) table.

**Trainer not found**
If you receive "Trainer X not found in Y", try alternate name spellings or check the Littleroot Dreams website for the exact trainer identifier used in that game's script. Common variants: numbered suffixes (`rival1`, `rival2`), game-specific suffixes (`cynthia`, `cynthiasinnoh`), or gender suffixes (`nemonaf`, `nemonam`).

**Generation mismatch for gimmicks**
If a Mega Evolution, Dynamax, or Tera type is not being applied, confirm the selected generation matches the gimmick's native generation (Mega = Gen 6–7, Dynamax = Gen 8, Tera = Gen 9). The engine silently ignores gimmick flags outside their native generation.

**"Invalid generation input"**
You entered a string that is not a number 1–9 or a recognized alias. See the [Generation](#1-generation) section for the full alias list.

**Results say "No matchup data"**
This can happen if a Pokémon's species name is not found in the data set. Check the spelling of the `species` field in the editor (exact names like `Urshifu-Rapid-Strike`, not `Urshifu Rapid Strike`).

**Terminal is too small**
The TUI adapts to terminal dimensions but requires at least ~80 columns and ~24 rows for the editor to render comfortably. Resize your terminal window or reduce font size if panels are clipping.
