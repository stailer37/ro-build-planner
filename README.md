# ro-build-planner

Pre-renewal Ragnarok Online build planner. The prototype covers the Lord Knight line
(High Novice → High Swordman → Knight → Lord Knight): set stats, skills, weapon and buffs,
press **Calcular**, and get the expected damage per second against a generic target.

The UI is in Brazilian Portuguese; code and docs are in English.

## Rules source

Formulas and data follow [rAthena](https://github.com/rathena/rathena) pre-renewal at commit
`1ca3e7700939ea40120cb51a777f8681ba5e84ae`. The commit is pinned in
`scripts/extract-rathena.ts`; bump it deliberately and re-run the tests.

## Data

`npm run extract` downloads `db/pre-re/*.yml` at the pinned commit (cached in `.cache/`) and
writes the JSON in `src/data/`, which is committed:

| File | Content |
| --- | --- |
| `jobs.json` | Base amotion per weapon type and job-level stat bonuses |
| `statPoints.json` | Cumulative status points by base level |
| `skillTree.json` | Skills each job adds, with prerequisites |
| `skills.json` | Per-level skill data (hits, cast time, delays, SP) |
| `sizeFix.json` | Weapon size modifiers |
| `attrFix.json` | Element modifiers |
| `refine.json` | Weapon refine ATK by weapon level |
| `targetPresets.json` | Small/Medium/Large targets averaged from common monsters (level 50–99 for Small, 70–99 otherwise) |
| `meta.json` | Source commit and preset filter |

## Development

```sh
make               # install deps if needed and start the dev server (http://localhost:5173)
make check         # typecheck + unit tests
make build         # production build
make extract       # regenerate src/data from the pinned rAthena commit
```

Without `make`, the same targets exist as npm scripts (`npm run dev`, `npm test`, ...).

## License

GPL-3.0-or-later, matching rAthena, whose formulas this project ports. See `LICENSE`.
