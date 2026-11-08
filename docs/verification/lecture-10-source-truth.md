# Lecture 10 (Debugging and profiling) — source-truth table

Verification date: 2026-11-08. Pinned baseline: `android-17.0.0_r1`.

## Upstream-traced / doc-traced facts

| # | Claim used in lecture | Source |
|---|---|---|
| 1 | Native crash machinery lives in debuggerd/tombstoned: `crash_dump`, `debuggerd` client at the tag; tombstones under `/data/tombstones/`, crashes surfaced in `logcat -b crash` | `platform/system/core/debuggerd/` @ `android-17.0.0_r1` (directory/crash_dump.cpp); Android platform debugging conventions |
| 2 | `debuggerd -b <pid>` prints a running process's thread backtraces without killing it | debuggerd tool behaviour (same tree) |
| 3 | Perfetto config textproto: `buffers { size_kb fill_policy }`, `duration_ms`, `data_sources { config { name: "linux.ftrace" ftrace_config { ftrace_events: "sched/sched_switch" … } } }`, `linux.process_stats` | Official Android Developers Perfetto example config (fetched 2026-11-08) |
| 4 | Binder kernel tracepoints `binder/binder_transaction`, `binder/binder_transaction_received` can be enabled in ftrace configs; lightweight capture accepts atrace-style categories (`sched`, `freq`, `am`, `binder_driver`, `hal`) | Perfetto documentation / ftrace event tree (doc-traced) |
| 5 | `cmd car_service inject-continuous-events` exists for generating property storm load; `inject-vhal-event` for single events | Lecture 7 source-truth row 12 (`CarShellCommand.java` @ tag) |
| 6 | avc denial format and the `dmesg`/`logcat` surfaces for SELinux evidence | Lecture 9 source-truth (verified against sepolicy docs at the tag) |
| 7 | The welcome stack's instruments exist by construction: `init.svc.*` + `vendor.acme.welcome.state` (L4), `dumpsys welcome_light` counters (L5), `getPropertyValue`/`cmd car_service` (L7), sepolicy + `service list` (L9/L6) | Lectures 4–9 of this course |

## Representative material (labelled on the page)

- All log excerpts, the tombstone excerpt, and the Perfetto trace
  narrative are representative samples in the real tools' formats,
  generated from the Running Example (per the rollout brief); none are
  pasted from a live device. Break procedures (`kill -SEGV`, denial
  removal, blocking handler) are described so Tier 2 can generate the
  real captures on Cuttlefish; they were not executed in the authoring
  environment (ADR-0002 labelling).
