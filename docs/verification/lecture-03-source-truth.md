# Lecture 3 — source-truth verification

Every real command, function, and value claimed in
`_lectures/03-command-line.md`, checked against the pinned baseline
`android-17.0.0_r1` on 2026-11-08 or carried from an earlier lecture's
verified table (cited per row). All session outputs are representative
samples in the tools' real formats; the session was not executed against a
live Cuttlefish in the authoring environment — the lab tiers run it.

| # | Claim in the lecture | Source |
|---|---|---|
| 1 | `build/envsetup.sh` defines the build-shell functions `lunch`, `croot`, `godir` (among the `m`-family it installs); lunch combos of the form `<product>-<release>-<variant>` | `platform/build` → `envsetup.sh` (function definitions read at tag); Lecture 2 for combo semantics (`docs/verification/lecture-02-source-truth.md`) |
| 2 | `fastboot` reads the bootloader variable `current-slot` on A/B devices (`getvar current-slot`) | `platform/system/core` → `fastboot/fastboot.cpp` (`GetVar("current-slot", …)`) |
| 3 | `HVAC_FAN_SPEED` = 356517120 (0x15400500), usable with `cmd car_service get-property-value`; `cmd car_service` verbs incl. `inject-vhal-event <id> <area> <value>`, `get-property-value`, `list-vhal-props` | Lecture 1/7 source-truth (`docs/verification/lecture-01-source-truth.md` row 1; `lecture-07-source-truth.md` row 12) |
| 4 | Welcome-stack observables used in the session: `service list` registrations (`welcome_light`, `vendor.acme.hardware.welcome.IWelcomeLight/default`), `dumpsys welcome_light` counters (`setCalls`/`deniedCalls`/`failedCalls`, `hal=connected`), the `getprop` panel (`init.svc.welcomed`, `sys.boot_completed`, `vendor.acme.welcome.state`, `ro.boot.slot_suffix`), logcat buffers, `update_engine_client` verbs | Lectures 4, 5, 9, 10, 11 source-truth tables (each artifact created and verified in its own lecture) |

## Fictional — acme

- The session itself: a narrated morning against a `kestrel_auto`
  Cuttlefish instance (endpoint, PIDs, timestamps representative). Every
  command is real; every output is formatted as its tool formats it,
  populated with the course's frozen names.
