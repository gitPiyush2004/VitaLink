# Globe workspace

The accepted UI direction makes geography the primary exploration surface while preserving a complete national-record and investigation workflow. It takes interaction inspiration from [God’s Eye View](https://github.com/bilawalsidhu/gods-eye-view), especially its [camera](https://github.com/bilawalsidhu/gods-eye-view/blob/main/src/camera.js), [context policy](https://github.com/bilawalsidhu/gods-eye-view/blob/main/src/contextModePolicy.js) and [HUD](https://github.com/bilawalsidhu/gods-eye-view/blob/main/src/hud.js). No reference source code was copied. This implementation uses the existing React and MapLibre stack.

## The working interaction

1. The initial view is a dark globe with a compact layer control and actual source freshness. Search, Records, Cases and Sources remain available in the header.
2. Recall locations represent reported recalling-firm cities. Exact coordinate groups retain all matching records; MapLibre clusters nearby groups and shows the record count. Red means the group includes at least one Class I record, not that all its records have that classification.
3. Selecting a contact opens its records and moves the camera. Selecting a record opens a compact evidence inspector. Closing the inspector restores the preceding camera view.
4. National shortages are accessed through US regulatory coverage, the national-evidence tray or medicine/company/NDC search. They never receive invented city pins, including when a stale location field exists.
5. Opening an investigation uses the existing organisation-scoped workflow. Candidates and Report expand the inspector for reading; manual compact/expand controls remain available. History allows selecting actual retained source observations, alongside the distinct case-opening evidence and original archive captures.
6. Overview, Fit locations, layer visibility and Unmapped records make navigation explicit. Record drawers supply the complete alternative when WebGL is unavailable. Keyboard access and reduced motion are supported. The current acceptance target is laptops; mobile support is not required for this review.

Search clears incompatible event/status/watch/place filters. Event-type changes reset source status. Closed investigations are hidden by default with an explicit Show closed cases control. Source errors and retrieval caps remain visible.

## Cartography and meaning

The bundled [Natural Earth countries](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson) are public-domain 1:110m overview geometry: 177 country features, original geometry, trimmed name/ISO attributes. Source/license and original/bundled hashes are retained in the asset README. It needs no paid tile key. Longitude/latitude guides are generated cartography, not routes. Zoom is capped at 6 because this is city-level context and coarse map geometry.

The cyan US outline indicates regulatory coverage, not an affected area. Neither cities, labels nor a dramatic visual style establish factory sites, supply dependencies, inventory or shipments. Contact counts are derived from the filtered retained records. The footer uses successful source-ingestion timestamps rather than a cosmetic live clock. The camera HUD reports the actual map center and zoom.

## Implementation and verification

`Workspace.tsx` composes `useWorkspace.ts`, `WorkspaceChrome.tsx`, `WorkspaceInspector.tsx`, `MonitorRail.tsx` and `Globe.tsx`. `globe-data.ts` contains conservative geographic grouping, scope and freshness helpers; `globe-graticule.ts` supplies cartographic lines; `globe-workspace.css` supplies the responsive shell. Native GeoJSON clustering avoids dropping overlapping cities. Source IDs, evidence rules and backend organisation/write checks are unchanged.

Five focused tests cover national records without pins, overlapping record counts, invalid coordinates, same printed city with different coordinates and true ingestion freshness. Browser acceptance on 13 October 2026 exercised cluster-to-record inspection, exact camera return, national medicine search, existing cases, expanded candidates, retained-version selection and real HTML/JSON report downloads. At the inspected refresh, the monitor retained 1,855 records: 1,555 shortage identities and 300 recalls, including 226 mapped recalls at 63 exact coordinate groups. These are dated counts. FDA feeds were healthy; Nominatim reported unreachable. Existing geocodes remain useful while unlocated evidence stays accessible.

The current isolated local preview is port 5182 against API port 4001; this host also has earlier preview processes. Standard repository defaults remain 5173/4000. `VITALINK_WATCH_POLLING=1` enables optional file-watch polling on hosts where notifications fail. See [setup](07_LOCAL_SETUP_AND_VALIDATION.md), [current state](02_CURRENT_STATE.md) and [review readiness](14_PHASE1_REVIEW_READINESS.md).

## Final laptop verification

On 13 October 2026, `npm run verify` passed: formatting, zero-warning lint, API/worker/web types, 439 tests across 36 files, all configured gates and consistency checks for 422 generated file notes. The production web build passed with a retained 1.333 MB minified-chunk warning (367 kB gzip). Laptop acceptance inspected 1280 × 720 and 1223 × 704 layouts without horizontal page overflow, including keyboard activation of a native contact. Mobile verification is outside the requested scope. Numerical/backend behavior was unchanged; the preceding Phase 1 Python run passed 118 tests. These checks do not establish clinical or forecasting accuracy.
