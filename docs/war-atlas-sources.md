# War atlas / experimental heat layer

Local implementation, not deployed by Codex.

- Basemap: existing Garmoth integration (`garmoth-forts.ts`), 200px tiles,
  custom positive-Y Leaflet transformation. No tiles downloaded or rehosted.
- Locations: existing `data/forts/{balenos,serendia,nodes}.json`. This is a
  catalog, not current territory ownership, war schedules, or verified tier data.
- Icons: public `https://nodewar.gg/svg/map/node.svg` and `castle.svg`, referenced
  directly. On 2026-09-24 the user reported private permission from the site
  administrator to use its icons. This is not a claim of a public blanket license.
  Preserve attribution; confirm hosting arrangements before production deployment.
- No Nodewar.gg private data, code, accounts, or territory polygons copied.
  Exact region borders remain unimplemented pending an authorized data source
  and its coordinate reference system. Region selection currently filters points.

`/savaslar/atlas` uses existing session middleware; `/dev/war-atlas` is only
available in development with `ENABLE_COMBAT_BETA=1`. No new database writes.

Heatmap is available in `/savas-haritasi` and `/dev/combat-map` and follows the
current player and kill/death filters. It uses a fixed 36-screen-pixel radial
kernel, equal event weights, and a fixed blue/cyan/yellow/red intensity scale.
Zoom changes visual density. It is not an absolute deaths-per-area metric,
territory control, causal attribution, or a win/loss estimate. Event positions
remain approximate and must be field-calibrated.

Verified locally: TypeScript check; visible heat canvas; toggling and filters;
Bartali search result and publicly loaded Nodewar.gg icon. External tile loading
can fail transiently and is reported in the atlas UI.
