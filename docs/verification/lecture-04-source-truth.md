# Lecture 4 (Boot and init) — source-truth table

Verification date: 2026-11-08. Pinned baseline: `android-17.0.0_r1`.

## Upstream-traced facts

| # | Claim used in lecture | Source at `android-17.0.0_r1` |
|---|---|---|
| 1 | Boot trigger order in the main `init.rc`: `early-init` → `init` → `late-init` → `post-fs` → `post-fs-data` → `boot` → `sys.boot_completed=1` actions | `platform/system/core/rootdir/init.rc` (section order) |
| 2 | `on post-fs` runs `class_start early_hal` (HALs needed before storage unlock) | Same file (~line 642) |
| 3 | `on boot` runs `class_start hal` then `class_start core` ("Start standard binderized HAL daemons") | Same file (~lines 1219–1221) |
| 4 | `on nonencrypted` runs `class_start main` and `class_start late_start` | Same file (~line 1228) |
| 5 | HAL service stanza shape: `service <name> /vendor/bin/…`, `class hal`, `user`, `group`, optional `shutdown critical` | `platform/hardware/interfaces/light/aidl/default/lights-default.rc` |
| 6 | `oneshot` = do not restart on exit; `disabled` = not started with its class, must be started explicitly; services otherwise restart on exit | `platform/system/core/init/README.md` (service options) |
| 7 | `interface aidl <fq-interface>` may be declared in a service stanza and used by `interface_start`/related commands | Same README (interface command notes) |
| 8 | Service state is observable as `init.svc.<name>` properties; boot completion as `sys.boot_completed` | Android init property conventions, exercised throughout `rootdir/init.rc` (e.g. `on property:sys.boot_completed=1`) |
| 9 | A second service definition with the same name is ignored with an error logged — duplicate stanzas do not merge | `platform/system/core/init/README.md` ("Services have unique names…") |
| 10 | Zygote stanza: `class main`, `user/group root …`, `socket zygote …`, `onrestart restart audioserver/cameraserver/media/netd…`, `critical window=… target=zygote-fatal` | `platform/system/core/rootdir/init.zygote64.rc` @ tag |
| 11 | ueventd: imports `/vendor/etc/ueventd.rc` + `/odm/etc/ueventd.rc`; `/dev` rule grammar `devname mode uid gid` (e.g. `/dev/binder 0666 root root`) | `platform/system/core/rootdir/ueventd.rc` @ tag |
| 12 | `SystemService` boot-phase constants 100/200/480/500/520/550/600/1000 dispatched via `SystemServiceManager` | `platform/frameworks/base/services/core/java/com/android/server/SystemService.java` @ tag |

## Fictional — acme (labelled on the page)

- `welcomed.rc` grown-up form (adds `interface aidl …`, `onrestart`
  property marker; keeps Lecture 9's `class hal`, `user/group system`,
  and the `post-fs-data` data-dir stanza). Every option used is
  upstream's per rows 5–7.
- All boot log excerpts and timeline timestamps are representative
  samples in the real tools' formats; the lecture says so.
- Tier 2 (boot the daemon on Cuttlefish, reproduce the three failures)
  was not run in the authoring environment (ADR-0002 labelling).
