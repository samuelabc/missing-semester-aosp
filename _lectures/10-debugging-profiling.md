---
number: 10
title: "Debugging and profiling"
subtitle: "Logs, dumps, traces, and tombstones: a workflow for when the car misbehaves and everyone is watching."
---

## Motivation

Debugging is not a talent; it is an order of operations applied under pressure. OEM programs lose weeks to random-walk debugging: flash something, poke something, meeting. This lecture gives you the loop (reproduce, bound, capture, bisect) and the four instruments that answer most system questions on AAOS: `logcat`, `dumpsys`/bugreport, Perfetto traces, and tombstones.

## Mental model

Start every bug by deciding which of three states the evidence lives in. **Now** (a live misbehaving system: `dumpsys`, `cmd`, `top`, live `logcat`), **history** (what happened: logs, bugreport's curated bundle), or **mechanism** (why, at system scale: Perfetto trace of scheduling, Binder, and your instrumentation; tombstone for a native death; ANR traces for a frozen process). Picking the wrong state produces the classic outcome: staring at a live screen describing a crash from yesterday.

The loop: write the reproduction in one sentence with inputs; bound the stage (Lecture 4's relay) and the layer (Lecture 1's map); capture before you change anything; change one variable (usually: module build, Lecture 2); and keep the capture named by bug, not by hope. Perfetto deserves its reputation: one trace replaces a dozen log greps for "slow," "janky," and "who is calling whom," because Binder transactions, thread states, and your `android.os.Trace` sections share one timeline.

## Walkthrough: the four instruments

```bash
# 1. History, bounded: the crash
adb logcat -b crash -d
adb shell ls -lt /data/tombstones/ && adb bugreport bug-<id>.zip   # the bundle reviewers actually read

# 2. Now: service truth
adb shell dumpsys car_service
adb shell dumpsys activity processes | grep -i com.android.car  # substitute your package

# 3. Mechanism: native death, read a tombstone in order
#    signal & fault address → backtrace (symbolize with the build's symbols) → registers/memory map
# In tree: stack/development tooling; keep unstripped symbols from YOUR build or backtraces lie politely.

# 4. Mechanism: Perfetto for slowness (concept; use the Perfetto UI/record tooling)
# Record sched + binder + atrace categories for your app/service, reproduce, open trace,
# find the long Binder call or blocked thread, then fix the blocking (Lecture 5 warned you).
```

Boot-time work is this lecture applied to Lecture 4: capture the whole boot (`logcat -b all` from the earliest reachable moment, plus `boot_progress` and `SystemServerTiming` lines), put stage timestamps in a row, and attack the largest gap. Sometimes the gap is a service waiting on a HAL that is waiting on a vehicle network that is asleep. The trace shows the wait; the fix is a timeout, a lazy init, or a power-state conversation (Lecture 7), not a faster CPU.

Memory and leaks, briefly because IVI uptime is measured in weeks: `dumpsys meminfo <pkg>`, procrank, and the discipline of re-checking after a soak rather than after a demo. Performance claims without a before/after trace are marketing; with one, they are engineering.

## Lab (tiered)

**Tier 1 (emulator, 1–2 h).** Manufacture evidence: trigger or find a crash/ANR-like event and a slow service call (a sleeping test method is fine), then file a mock bug report containing reproduction, one `dumpsys` excerpt, one log slice, and a stage/layer bound, reviewed against the checkpoint.

**Tier 2 (Cuttlefish, 2–3 h).** Record a Perfetto trace during a property-change storm (Lecture 7's continuous property), identify the busiest Binder path, and write up cause plus one measured remedy.

<div class="checkpoint"><strong>Checkpoint:</strong> your bug report lets a colleague reproduce and start at the right layer without messaging you. If they must ask "which build," start over; Lecture 3's fingerprint habit was the fix.</div>

## Exercises

1. A bug says "sometimes the settings screen is blank after boot." Rewrite it into a one-sentence reproduction with bounded stage and layer, inventing reasonable specifics.
2. Choose the instrument (now/history/mechanism) for: (a) yesterday's reboot on a bench, (b) fan speed UI lag while driving the emulator, (c) a service that died overnight.
3. A tombstone backtrace is all addresses. What is missing, and where should it have been kept since build day?
4. Boot got 8 s slower after a vendor drop. Describe the capture and comparison that proves where, before any fix is discussed.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Look for: a trigger condition, the boot stage reached, the layer suspected (settings app vs car service vs property), and a frequency claim that a capture can test.
2. (a) History: bugreport/logs from the bench. (b) Mechanism: Perfetto while reproducing. (c) History/mechanism pair: tombstone plus service logs.
3. Symbols for that exact build; unstripped libraries/symbol directories must be archived with every build you may ever debug, release builds included.
4. Full boot captures on both drops, stage-timestamp diff (Lecture 4 relay), largest-delta stage named with log evidence; only then a suspect service/HAL and a module-level bisect.

</details>

## Go deeper: kernel and app pointers

Kernel-side stalls appear in the same Perfetto timeline (kernel tracing, `ftrace`); the [kernel path]({{ '/kernel-path/' | relative_url }}) step 5 is the companion. For app-visible freezes, ANR analysis pairs this lecture with the [app path]({{ '/app-path/' | relative_url }}) step 6 instrumentation habits.

<div class="callout"><p><strong>Working with AI agents:</strong> this is their best lecture. Paste a bounded log slice, a tombstone backtrace (symbolized), or a <code>dumpsys</code> section and ask for stage, suspects ranked by evidence, and the next capture, not for "the fix." Then run the capture. Agents that skip evidence produce fixes you cannot review.</p></div>
