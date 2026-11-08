---
number: 10
title: "Debugging and profiling"
subtitle: "Break welcomed three ways — policy, crash, stall — and diagnose each with the loop: evidence first, layer by layer, until the fix is obvious."
reading_time: "~40 min read, plus lab"
lab_time: "2–3 h"
---

## Motivation

Every previous lecture ended with instruments: a service that confesses through `dumpsys`, properties that timestamp the boot, counters that separate denied from failed, a manifest that states what's true. This lecture is where those investments pay out. Debugging is not a talent; it is an order of operations applied under pressure, and OEM programs lose weeks to its absence — random-walk debugging by flash-and-poke, fixes that treat the last process to print, bug reports that cannot survive one round-trip.

The Worked Example is a controlled burn: we break the welcome daemon three deliberate ways — an SELinux refusal, a native crash with a tombstone, and a Binder stall — and diagnose each with the same loop until the fix is forced by the evidence. Because the stack is ours, every layer has an instrument and every instrument was introduced by the lecture that built it. That is the transferable skill: on the program you join next, the layers will have different names, and the loop will not care.

## Mental model

Start every bug by deciding which of three states the evidence lives in. **Now** — a live, still-misbehaving system: `dumpsys`, `cmd`, `getprop`, a `logcat` tail, the counters from Lecture 5 ticking in front of you. **History** — something already happened and ended: log buffers, bugreport's curated bundle, tombstones, yesterday's boot. **Mechanism** — why, at system scale, over time: a Perfetto trace where scheduling, Binder transactions, and your feature's events share one timeline. Picking the wrong state produces the classic wasted day: staring at a live screen describing a crash from yesterday, or grepping logs for a scheduling question that only a trace can answer.

Then the loop, five steps, in order, no skipping:

1. **Reproduce in one sentence** — inputs, conditions, expected versus actual. If you cannot write it, you do not yet have a bug; you have a rumour.
2. **Bound the layer** — Lecture 4's boot relay for stage, Lectures 5–7's chain for layer. A bug report that names its layer in line one saves everyone the archaeology.
3. **Capture before you change anything** — logs, dumps, the property values, the build fingerprint. Captures are named by bug and build, never by hope.
4. **Change one variable** — ideally a module rebuild (Lecture 2), one policy line, one property. Two variables is an experiment about neither.
5. **Verify against the reproduction** — the same commands that demonstrated the bug now demonstrate its absence, and the capture goes in the bug so a reviewer can re-run your reasoning.

Two habits make the loop cheap. First, *the counters before the logs:* the instruments you built (next section) usually localize a bug to a layer in seconds; logs are for the "why" inside that layer. Second, *opaque timestamps are lies of omission:* always know which build you are looking at (`ro.build.fingerprint`, Lecture 3) and what time base a log uses, because half of all "impossible" log sequences are two builds' outputs interleaved by a tired engineer.

### The instrument panel you already built

Debugging begins by inventorying what the system can tell you about itself. The welcome stack's panel, by lecture:

| Instrument | Built in | Answers |
|---|---|---|
| `init.svc.welcomed`, `vendor.acme.welcome.state` | Lecture 4/9 | Is the daemon started, alive, restarting, self-reporting ready? |
| Boot stage markers, `sys.boot_completed` | Lecture 4 | How far did the relay get; what never ran? |
| `dumpsys welcome_light` (`state`, `hal=`, set/denied/failed counters) | Lecture 5 | Did requests arrive? Which way did they die — authorization, absence, or downstream failure? |
| `service list` / `service check` | Lectures 5/6/9 | Is the interface registered at all — i.e., is this a Binder/policy problem or an application problem? |
| Manifest + matrix on device | Lecture 6 | Is the pairing even legal — or is this an OTA-time gate failing early? |
| `cmd car_service get-property-value`, `inject-vhal-event` | Lecture 7 | What does the vehicle layer currently believe; can I drive it deterministically? |
| Granted permissions, overlay state | Lecture 8 | Did the app's two grant mechanisms deliver; is the right resource winning? |
| avc lines in `dmesg`/`logcat` | Lecture 9 | Is policy the refusal — and which of the four questions does the denial answer? |

Read the table as the course's thesis in diagnostic form: *observability is not a Lecture 10 feature you bolt on; it is the residue of building every earlier layer honestly.* A team that skips dumpsys in Lecture 5 debugs Lecture 10 blind.

### logcat craft: the history instrument, used properly

Most engineers use `logcat` as a firehose and drown accordingly. Used as an instrument, it is precise. The buffers are separate histories with separate authors — `main` (app/framework chatter), `system` (system services), `crash` (fatal signals and their mini-reports), `events` (structured `am_*`/`wm_*` lifecycle facts), `radio`, and `kernel` — and choosing the buffer *is* bounding the layer: `logcat -b crash -d` answers "what died" without forty thousand lines of opinions. Formats are evidence choices too: `-v threadtime` (timestamp, pid, tid, tag) is the default dialect for system work because *which thread* is half of every concurrency story; `--pid=<pid>` isolates a process once Break-style work has named it; tag filters (`MyTag:D *:S`) are for live watching, while bug work uses the opposite discipline — dump wide (`-b all -d > bug-<id>.log` at capture time), filter on the host where filtering is free and repeatable. Two properties of the medium to internalize: the buffers are *rings* — on a busy system the interesting lines scroll out in minutes, which is why Capture precedes Fix in the loop and why "it worked when I looked later" is not data; and they do not survive reboot (the kernel's previous-boot console may, in `/sys/fs/pstore/`, which is where yesterday-booted-into-a-wall cases start). The capture protocol for any real bug is therefore mechanical: note the fingerprint, clear nothing, start the capture or dump immediately, reproduce, mark wall-clock time, *then* read.

### The first fifteen minutes: a runbook for the welcome stack

When the call comes in ("welcome light broken on the bench car"), this is the sequence — every command exists because a previous lecture installed the instrument, and the order is cheapest-evidence-first:

```bash
adb shell getprop ro.build.fingerprint        # which build is accused
adb shell getprop sys.boot_completed          # relay finished?
adb shell getprop init.svc.welcomed           # daemon: running / restarting / absent
adb shell getprop vendor.acme.welcome.state   # daemon's self-report
adb shell service list | grep -i welcome      # registrations: one line or two
adb shell dumpsys welcome_light               # state, hal=, set/denied/failed
adb shell cmd car_service get-property-value 639634448 1   # vehicle truth, driver door
adb logcat -b crash -d | tail -5              # anything die recently
adb shell dmesg | grep -ci avc                # is policy even in the room
```

Read as a decision tree: fingerprint wrong → stop, you are debugging the wrong car. `boot_completed` unset → Lecture 4's relay, not this feature. Daemon `restarting` → Break 2's world (tombstones). Daemon `ready` but one `service list` line → Break 1's world (avc count will be non-zero). `hal=connected`, `failedCalls` climbing → Break 3's world (or the daemon's hardware path). `deniedCalls` climbing → Lecture 5/8's authorization world. Property reads stale → Lecture 7's chain. Nine commands, and the bug has a layer, a name, and a next capture. *That* is what "instrumented" buys a program: not fewer bugs, but bugs whose first fifteen minutes are a procedure instead of a personality test.

### bugreport: the bundle reviewers actually read

`adb bugreport bug-<id>.zip` asks `dumpstate` to curate everything: all `dumpsys` sections, the log buffers, tombstone listings, process and memory state, the works. Its virtues are completeness and a shared vocabulary — "attach a bugreport" ends arguments about what to capture. Its vice is the same completeness: megabytes in which your three relevant lines hide. The professional workflow is loop-shaped: reproduce with narrow captures first (your diagnosis almost never *starts* in a bugreport), then take the bugreport as the archival record, and in the bug itself quote the narrow excerpts with the commands that produced them, so a reviewer re-derives your conclusion instead of spelunking for it. Read others' bugreports in the order dumpstate writes them: header (fingerprint — always the fingerprint), boot and crash evidence, the service sections you own, then the logs around *your* timestamps, not the file's beginning. And the corollary for your own code, from Lecture 5 forward: everything `dumpsys` prints will be read by strangers under time pressure — write it like evidence, because it is.

### Writing the bug so the loop survives you

The loop's last product is not the fix; it is a bug report that lets the next engineer start at your Step 4 instead of your Step 1. Five lines suffice, and every lecture of this course has been quietly manufacturing their contents. **Reproduction:** one falsifiable sentence — trigger, frequency, build fingerprint. **Bound:** the layer and stage the evidence acquits *and* the layer it convicts ("daemon `ready`, interface unfindable → below `system_server`, at service registration"). **Evidence:** the smallest excerpt that convicts — the one avc, the three tombstone frames, the frozen counters — each with the command that produced it, so it can be re-derived after the fix. **Suspects ranked, with the capture that separates them:** "pool stall vs. handler crash-loop; `debuggerd -b` during the freeze separates them." **Verification:** the exact post-fix re-run and the numbers it must show, written *before* the fix exists, so future-you cannot grade on a curve. Filed this way, a bug becomes an asset: Lecture 12 will mine exactly these reports as its regression-test backlog, and your fleet's night-shift engineer inherits a procedure instead of a mystery. The counterexample is the bug database you already have: titles like "welcome light weird," no fingerprint, closed as *cannot reproduce* — which means, translated, *the capture step was skipped and the loop starved*.

## Worked example: break welcomed three ways

Ground rules for all three breaks: perform them on your Cuttlefish `kestrel_auto`, one at a time, restoring fully between breaks; capture each symptom *before* diagnosing (Step 3 of the loop), and keep the captures — the lab reuses them as known-answer exercises.

### Break 1: the policy refusal (the daemon runs; nobody can find it)

**Inflict:** in `device/acme/kestrel/sepolicy/vendor/service_contexts`, change the label of the HAL registration to a type `system_server` has no `find` on — or, more surgically, delete the `find` grant in `welcomed.te` — rebuild only the policy (`m selinux_policy` is the module from Lecture 9), push/reboot.

**Symptom, captured:** the light is dead, yet —

```bash
adb shell getprop init.svc.welcomed        # running
adb shell getprop vendor.acme.welcome.state # ready
adb shell service list | grep -i welcome
# ...  welcome_light: [com.acme.welcome.IWelcomeLightService]     ← only one line
adb shell dumpsys welcome_light
#   state=off (-1→ shown as unavailable after timeout)  hal=unavailable
#   setCalls grows as doors open; failedCalls grows with them
```

**Diagnose with the loop.** Bound the layer: the daemon is alive and self-reporting `ready` (Lecture 4 instrument), so this is not a start failure and not a crash — it is a *reachability* failure between `system_server` and the daemon, which means Lecture 9's territory. The evidence, one command:

```bash
adb shell dmesg | grep -i "avc.*welcomed\|avc.*IWelcomeLight" | tail -3
# avc: denied { find } for pid=1044 comm="system_server"
#   name="vendor.acme.hardware.welcome.IWelcomeLight/default"
#   scontext=u:r:system_server:s0 tcontext=u:object_r:hal_welcome_service:s0
#   tclass=service_manager permissive=0
```

Lecture 9 taught you to read that line as a complete sentence: *who* (`system_server`), *what verb* (`find`), *on what* (your service, correctly labelled `hal_welcome_service` — the label survived; the *grant* is what you deleted), *which manager*. The fix is the one-line grant's restoration, and the verification is the loop's Step 5 re-run: `service list` shows both lines, `dumpsys` reports `hal=connected`, door injection moves `setCalls` with `failedCalls` flat. Note the diagnostic signature to memorize: **daemon `ready`, interface unfindable, one avc** — process health and policy health are independent axes, and `getprop` plus `service list` separate them in ten seconds.

### Break 2: the native crash (a tombstone tells the story)

**Inflict:** simulate the daemon dereferencing garbage on a door event — in the Tier 2 drill you may patch a deliberate `*(volatile int*)0 = 0;` behind a property trigger, or for a first rehearsal simply deliver the signal directly:

```bash
adb shell pidof welcomed
# 612
adb shell kill -SEGV 612
```

**Symptom, captured:** the light dies; seconds later the feature mysteriously works again (or flaps). The panel explains the flap before any log is opened: `init.svc.welcomed` cycled (init restarted the daemon, Lecture 4's contract), `vendor.acme.welcome.state` went back to `ready`, and Lecture 5's service shows a `failedCalls` bump where its in-flight call met the death, then recovery. History lives in two places:

```bash
adb logcat -b crash -d | tail -20
adb shell ls -lt /data/tombstones/ | head
adb shell cat /data/tombstones/tombstone_03 | head -40
```

The tombstone (written by the platform's crash machinery — `system/core/debuggerd`'s `crash_dump`/tombstoned — excerpt representative) reads in a fixed order, and the order is the method:

```
Build fingerprint: 'acme/kestrel_auto/cuttlefish…:17/…/userdebug'
pid: 612, tid: 901, name: welcomed >>> /vendor/bin/welcomed <<<
signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x0
backtrace:
    #00 pc 0000000000004f3c  /vendor/bin/welcomed (WelcomeLight::setEnabled(bool)+88)
    #01 pc 00000000000051a0  /vendor/bin/welcomed (aidl::…::BnWelcomeLight::onTransact+…)
    #02 pc … libbinder_ndk.so (ABinderProcess_…)
```

Read it top-down the way the file is written: *fingerprint first* — a tombstone from last week's build is archaeology, not evidence; confirm it names the build on the device (Step 3's discipline). *signal and fault address* — `SIGSEGV` at `0x0` is a null dereference, a different universe from a wild pointer or a stack smash, and the remedy differs accordingly. *backtrace, symbolized* — frames landing in `WelcomeLight::setEnabled` via `BnWelcomeLight::onTransact` put the death inside the Binder handler on a client call, which is why Lecture 5's service recorded exactly one failed call at that second: the call *was* the crash. Two corruptions of this instrument to respect: an unsymbolized backtrace (addresses only) means the symbols for *this build* were not kept — archive `symbols/` with every build you might ever debug, release builds emphatically included — and a tombstone count that keeps growing means a crash *loop*, at which point Lecture 4's "quiet the loop with `oneshot`" malpractice may tempt someone; the tombstones, arriving one per restart, are the data that refutes it. `debuggerd -b <pid>` gives the same lens on a *live* process (all threads' stacks, no death required) — the bridge to Break 3.

#### Symbolizing it yourself

The tombstone above arrived pre-symbolized because you read it on a userdebug device with symbols in place. Understand the machinery underneath, because the day it matters the frames will be bare addresses and someone must do this by hand. The unstripped twin of every binary lives in the build's symbol tree — `out/target/product/<device>/symbols/` mirrors the filesystem layout, so the dead `welcomed`'s twin sits at `symbols/vendor/bin/welcomed` — and each frame's `pc` is an offset inside that file that a symbolizer (`llvm-addr2line`/`addr2line -e <binary> <pc>`, or the source tree's `stack` tooling, which pipes a whole tombstone through the symbol tree at once) converts to `WelcomeLight::setEnabled(bool)+88` — function, plus how far into it the crash landed. Two matches must hold or the ritual produces confident nonsense: the symbol binary must be *the same build* as the crashed one (the tombstone's fingerprint header is the check; a same-named binary from Tuesday symbolizes Monday's crash into a plausible, wrong function — the most dangerous output this lecture can produce), and the `pc` must be read against the file it died in, frame by frame, since each frame names its own library. Read the resulting stack as a sentence in the direction of causality: `libbinder_ndk` frames are the doorway (someone's call arrived), `BnWelcomeLight::onTransact` is the generated stub doing unmarshalling (rarely the culprit, always on the scene), and the first frame of *your* code is where evidence starts being about you. A stack that dies inside *your* frame with the fault in a library call below it is a different bug — bad argument most likely — than one that dies on your own dereference, and conflating them sends the fix to the wrong desk. Drill this once on an emulator tombstone while nothing is on fire; it is a twenty-minute skill that is worth a day during an incident.

### Break 3: the Binder stall (alive, registered, and useless)

**Inflict:** make the daemon's `setEnabled` sleep — twenty seconds behind a debug property, say — while a client calls. Remember the stand-in's shape from Lecture 9: `ABinderProcess_setThreadPoolMaxThreadCount(0)` plus `joinThreadPool()` means *one* thread serves every call. One slow call is now a full outage.

**Symptom, captured:** `init.svc.welcomed` says `running`; `service list` shows the registration; no tombstone, no avc — and `service call … IWelcomeLight/default` (or the door-driven path) takes twenty seconds, Lecture 5's `setLightEnabled` posts pile onto its background thread, `dumpsys welcome_light` shows calls neither succeeding nor failing — the counters freeze mid-flight. Every cheap instrument says healthy; only *time* is wrong. This is the mechanism state: the question is no longer what happened but *where the thread is*.

**Diagnose.** First, the live stack (`debuggerd -b`, Break 2's tool, no death required) shows the daemon's single Binder thread inside the sleeping handler and — eloquently — *no other thread able to serve*: `getState`, which should be instantaneous, queues behind the nap. That asymmetry (one method slow, all methods slow) convicts the thread pool, not the method: with `MaxThreadCount(0)`, the interface has exactly one lane. The fix is Lecture 5's daemon-side mirror: give the pool real threads (`ABinderProcess_setThreadPoolMaxThreadCount(4)`, say) *and* keep handlers non-blocking, because four lanes only move the cliff — a handler that blocks on hardware must hand off internally or the fifth concurrent call re-creates the stall at higher load. Verify by re-running the storm: `getState` answers in milliseconds while a `setEnabled` is mid-nap.

Convict from the caller's side too, because in the real incident you usually start there. `debuggerd -b` aimed at `system_server` shows Lecture 5's background thread parked *inside the Binder call itself* — waiting on a reply, stack bottomed out in the kernel Binder driver — while the thread that called `getState` queues behind it in your service's own bookkeeping. Two processes, two stacks, one wait: the caller's stack proves *who is waiting*, the daemon's proves *what for*, and either alone invites the classic misdiagnosis in which the team whose dashboard froze first gets assigned the bug. (In the `running`/`restarting` panel this is the stall's fingerprint: both processes present, both healthy by every alive-check, exactly one thread in each doing anything interesting — and it is the same transaction seen from both ends.)

**The property-change storm, traced.** Rehearse the same question at system scale: drive Lecture 7's door property hard (`cmd car_service inject-continuous-events`, or a fast `inject-vhal-event` loop) while capturing a Perfetto trace with Binder and scheduling visible. A minimal textproto configuration, following the official example schema:

```
buffers { size_kb: 65536 fill_policy: RING_BUFFER }
duration_ms: 15000
data_sources {
  config {
    name: "linux.ftrace"
    ftrace_config {
      ftrace_events: "sched/sched_switch"
      ftrace_events: "binder/binder_transaction"
      ftrace_events: "binder/binder_transaction_received"
      atrace_categories: "am"
      atrace_categories: "wm"
    }
  }
}
data_sources { config { name: "linux.process_stats" } }
```

fed to the device with `adb shell perfetto -c - --txt -o /data/misc/perfetto-traces/welcome-storm.pftrace` (config on stdin), pulled, and opened in the Perfetto UI. Read it as three questions: *Where do transactions queue?* — the `binder_transaction` spans between the car process, `system_server`, and `welcomed` show call durations; in the healthy system they are sub-millisecond, in the stalled one they stretch exactly as wide as the nap. *Who wakes whom?* — `sched_switch` on the involved threads turns "the UI feels laggy when doors flap" into a named thread waking per event, which either matches the design (one callback per transition) or exposes a storm multiplier (one event becoming N Binder calls). *What does the storm cost?* — aggregate the welcome path's CPU across the fifteen seconds before and after any remedy; that number, not an adjective, goes in the bug. The trace is also where Lecture 7's change-mode lecture becomes visible: an on-change property behaving continuously is instantly recognizable as a solid band of transactions, and no amount of log archaeology shows it as clearly.

Reading the trace in the Perfetto UI is a skill of its own, and it follows the loop's order. Open the `.pftrace` at [ui.perfetto.dev](https://ui.perfetto.dev) and resist zooming at random: first find your processes — the track list carries one group per process, and `welcomed`, `system_server`, and the car service are the three lanes of this course's highway. Pin those three tracks so they stay on top. Then find the storm window: the fifteen seconds of injection are usually visible before any searching, as a solid band of Binder activity. Search is the third move — `Ctrl+F` for `binder_transaction` (or for your AIDL method name, which Perfetto often surfaces from atrace) — and measurement is the fourth: drag across a single `getState` transaction, note its duration in the details panel; drag across ten and the UI reports aggregate and mean. The number you owe the bug report is a distribution, not a vibe: "median welcome-path transaction 0.4 ms at rest, 380 ms during the storm, recovering within a second of injection stopping" is a sentence a reviewer can act on; "Binder looked busy" is not. Finally, export or screenshot the window with the three pinned lanes visible — the trace file itself is the archival evidence, the picture is the argument. The discipline generalizes past Binder: almost any "the car feels slow when X" bug becomes (a) pin the lanes of X, (b) select the transactions of X, (c) quote a before/after distribution. Everything else — sched, IRQ, frequency lanes — is depth you add when those three lanes acquit themselves.

<div class="checkpoint"><strong>Checkpoint:</strong> for each break you can produce, from capture alone: the one command that bounds the layer, the evidence sentence that convicts it (the avc's verb, the tombstone's backtrace frame, the frozen counters plus the single-lane stack), and the post-fix re-run showing all three panel rows green. Diagnosis by evidence, three for three.</div>

### The frozen-process family: ANR and watchdog

Break 3 has managed-code relatives, and separating the three "alive but useless" states is a core triage skill. A native daemon that stops answering leaves its threads visible to `debuggerd -b` and its Binder calls timing out — nothing in the system *announces* it; that silence is why the Perfetto storm matters. An **app** that stops answering gets announced: input dispatch times out, the system takes an ANR trace (the process's thread stacks, saved under `/data/anr/` and surfaced via `dumpsys activity`), and the user is offered a dialog. Read an ANR trace exactly like Break 3's stacks — find the main thread, ask what it waits on; the commonest answer in this course's world is "a synchronous Binder call into a service whose thread is parked," at which point the two lectures shake hands. **`system_server` itself** is policed by the Watchdog: framework monitors must check in, and a blocked monitor thread produces watchdog kill lines in the log and a full framework restart — every service down, boot phases re-run, a very recognizable "the whole car blinked" signature with *no tombstone* (nobody crashed; the referee shot the game). This is the institutional reason for Lecture 5's rule against blocking Binder and boot-phase threads in `system_server`: the blast radius of a stall there is not your feature, it is the framework. Three states — quiet stall, announced ANR, refereed restart — separated by two questions: who noticed, and what artifact did they leave?

### Memory: the slow break

The fourth break is the one nobody inflicts on purpose, so rehearse its detection. IVI uptime is measured in weeks; a daemon leaking a kilobyte per door event is invisible in every demo and fatal in the field's second month. The instruments are unglamorous: `dumpsys meminfo <process-or-package>` (read Pss and the native-heap line for a C++ daemon), `procrank` for the system-wide table, sampled *identically* across time — after boot, after a duty cycle of a thousand injected door events, after a soak day. A claim requires the graph: flat is health, a staircase keyed to events is a leak with a return address, and growth in the tombstone-adjacent world (buffers, caches) wants a different fix than growth in the heap. Welcomed's honest profile is a few megabytes, flat, bored; anything else is a bug with a long fuse, and this lecture's position is that you find it in the lab (Tier 2's storm doubles as the duty cycle) or the field finds it for you.

## The loop applied elsewhere: boot and soak

**Boot slowness** is Break-thinking on Lecture 4's relay, and it deserves a worked pass because the arithmetic is the whole method. Capture the boot (`logcat -b all` from the earliest reachable moment; boot-progress, init-stage, and `SystemServer` timing lines are already timestamps waiting to be subtracted), then build the stage ledger — the six-row evidence table from Lecture 4, with the measured second each marker fired. A representative regression, invented but shaped like the real ones: `zygote` starts at 8.2 s, `SystemServer` entry at 11.0 s, `PHASE_SYSTEM_SERVICES_READY` (500) at 14.6 s, `BOOT_COMPLETED` at 19.1 s — against last week's 8.0 / 10.4 / 12.1 / 15.3. Total damage: 19.1 − 15.3 = 3.8 s. Stage deltas: the 500-phase boundary moved by 14.6 − 12.1 = 2.5 s, which means the regression lives overwhelmingly *inside* the system-services phase, before it — not in "the kernel" and not in "apps starting late," however the bug report phrased it. One level down, the same subtraction between service-start lines inside that window names the service whose start or `onStartUser`-adjacent work grew; one level further, a boot trace prices the wait itself. Notice what the method refuses: it never optimizes the stage you *suspect*, it bills the stage that *grew* — and in the commonest real-world case the growth is a wait, not work: a service waiting on a HAL that waits on a vehicle network that is asleep until the body controller wakes. The capture shows the wait as dead air; the fix is a timeout, a lazy connection (Lecture 5's retry posture), or a power conversation (Lecture 7) — never a faster CPU purchased to shorten a nap.

**Overnight death** is Break 2 with a longer fuse: the tombstone's timestamp plus `init.svc.*` history plus which tombstone *number* it is tells you whether the daemon dies hourly or died once at 03:12 during a suspend transition — different bugs sharing a headline. **Memory growth** on IVI timescales (weeks, not demo minutes) is `dumpsys meminfo <pkg>`/`procrank` sampled across a soak, claimed only with a before/after; a leak you cannot graph is a rumour with a dashboard.

### From bench to fleet: what survives the user build

Everything above assumes engineering builds and a bench — state plainly what changes on locked production cars, because the answer shapes what you build *now*. On `user` builds, the shell loses its superpowers progressively: `adb` access itself is gated, much of `dumpsys` and direct process inspection is restricted to privileged paths, Perfetto capture runs only through sanctioned channels, and heapprofd-style allocation profiling is a development-build instrument. What survives is what you deliberately shipped: your service's `dumpsys` section (readable through bugreport pipelines), your counters, your structured logs at sane levels, tombstones collected by the fleet's reporting path. The loop still works in the field — reproduction, bound, capture — but the captures are the ones your product *pre-authorized*. That is the closing argument of this lecture, and it reaches backward through the whole course: the counter triplet in Lecture 5, the `running`/`ready` distinction in Lecture 4, the state property in Lecture 9's annex, the panel runbook above — none of it is decoration. It is the debugging surface of a machine you will mostly never be allowed to touch, designed while you still could. When a feature review asks "why the extra getprop, why the counter," the answer is a night-shift engineer, eighteen months from now, running the first fifteen minutes against a car on another continent.

## Lab (guided)

**Tier 1 — work the evidence cold (~1 h, emulator + captures).** Using the captures from the Worked Example (or your Tier 2 partner's — see below), write the bug reports: reproduction in one sentence, layer bound, the evidence excerpt that convicts, the fix, the verification command. Swap reports with a colleague (or yesterday's you) and grade against the checkpoint: could the reader start at the right layer without messaging the author? Then take one real tombstone from any crashed process on the emulator image and read it in the lecture's order — fingerprint, signal, fault address, top three frames — stating what each rules in or out.

**Tier 2 — the three breaks, blind round (~2–3 h, Cuttlefish).**
1. Perform Breaks 1–3 yourself, restoring between each, saving every capture with the build fingerprint in the filename. Checkpoint: three directories, three conviction sentences written *before* you allowed yourself to fix anything.
2. **Blind round:** a partner (or a script you wrote last week and have forgotten) inflicts one of the three breaks, or a fourth of their invention within the welcome stack. Diagnose cold: panel first (two minutes, no logs), one bounding command, one evidence capture, then fix. Checkpoint: your written layer bound was correct before the fix was attempted; if it wasn't, the miss — not the fix — is the lab's output.
3. Record the property-change storm trace twice — once against the single-threaded daemon, once after the thread-pool fix — and extract one number (welcome-path CPU or median `getState` latency under load) from each. Checkpoint: both traces saved, both numbers in the writeup, and the remedy is a measured sentence, not an adjective.

**Tier 3 — bench triage (30 min).** On any real head unit with a known annoyance (slow boot, a flapping feature), run the first fifteen minutes of the loop: reproduction sentence, layer bound from the panel equivalents the device offers, one capture. Stop there — the deliverable is the bound and the capture, not the fix. Checkpoint: a colleague could pick your capture up tomorrow and lose nothing.

*Verification status: crash machinery and tombstone surfaces, Perfetto config schema and Binder ftrace points, and the injection tooling checked against `android-17.0.0_r1` / official documentation (see `docs/verification/lecture-10-source-truth.md`). All log and tombstone excerpts are representative samples in the tools' real formats, and the traces are described, not pasted; the breaks were not executed in the authoring environment — Tier 2 exists to make them real.*

## Exercises

1. A bug says "sometimes the settings screen is blank after boot." Rewrite it into a one-sentence reproduction with inputs, stage bound, and layer bound, inventing reasonable specifics.
2. Assign each scenario its evidence state (now/history/mechanism) and first instrument: (a) yesterday's spontaneous reboot on a bench unit; (b) HVAC fan UI lagging while you drive the emulator; (c) a vendor daemon that died overnight, once; (d) "the whole system feels slow since the last build."
3. A tombstone arrives with an all-addresses backtrace and the build server has since cleaned the output directory. State what is unrecoverable, what the process change is, and the one directory archived per build from now on.
4. `dumpsys welcome_light` shows `setCalls` climbing, `failedCalls` climbing in lockstep, `deniedCalls` flat, `hal=connected`. The light never lights. Bound the layer and name the two suspects in order — and the command that separates them.
5. A colleague proposes diagnosing Break 3 by adding log lines inside `setEnabled` and rebuilding. Accept or reject: what does the trace give that the logs cannot, and when are the logs nonetheless the right tool?
6. The bench car "blinked" overnight: this morning the clock is wrong, all apps restarted, the welcome feature works, and there is no new tombstone. Name the most likely mechanism, the two artifacts that confirm it, and why the welcome stack is a witness here rather than a suspect.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Look for: a trigger ("cold boot with the driver door open"), a stage bound ("after `sys.boot_completed=1`, before first unlock" or similar), a layer bound ("companion app renders, `welcome_light` state unknown"), and a frequency claim a capture can test ("3 of 10 cold boots"). Sentences that cannot be falsified by a capture are not yet reproductions.
2. (a) History — bugreport from the bench (its logs and last-reboot evidence outlive the event). (b) Mechanism — Perfetto during reproduction; the question is scheduling/Binder over time. (c) History/mechanism pair — tombstone (when, what signal, symbolized frames) plus the daemon's own log slice around that timestamp. (d) Mechanism — before/after traces across the build boundary; "feels slow" is a scheduling claim until a trace prices it. Marking (a) or (c) as "now" (opening a live `dumpsys` and describing it as the bug) is the classic category error.
3. The mapping from addresses to code for *that exact binary* is gone; without symbols the tombstone can convict a library at best, never a line. Process change: archive the build's symbol tree (`symbols/` — unstripped binaries keyed to the fingerprint) with the same retention as the image itself, release builds first, because the crashes that matter happen on builds nobody kept. A backtrace without symbols "lies politely": it looks like evidence and cannot be cross-examined.
4. The layer bound is below the service and above/at the daemon's handler: requests arrive and are accepted (`setCalls` climbs, nobody is denied), the service believes the HAL is connected, yet every call fails. Suspects in order: (1) the daemon's handler is dying per call in a way that surfaces as `RemoteException` — but tombstones would exist, and `hal=` would flap as death/reconnect cycles; (2) the daemon is *alive but erroring* — e.g. the LED path failing (sysfs node moved, policy on the device node — Break 1's file-level cousin) with the handler converting failure into an exception. Separator: the daemon's own log around one failed call, plus one direct check of the hardware path (`cat` the brightness node / trigger via the daemon's debug surface). `deniedCalls` flat is the datum that acquits Lecture 5's layer; honour it.
5. Reject as the *first* move, accept as the second. The trace answers "where does time go and who waits on whom" across four processes on one timeline — the stall's actual question — without a rebuild that itself changes timing (and a rebuild may make the bug shy). Logs inside the handler would show entries and exits of one function in one process, which cannot distinguish queueing-behind-the-nap from slow hardware from a blocked caller. Once the trace has convicted the lane, targeted logging (entry/exit timestamps during the Tier 2 re-run) is exactly right for confirming the fix. Instrument order: trace for the mechanism, logs for the confirmation.
6. Watchdog. A framework-wide restart with no tombstone is the referee's signature: something in `system_server`'s monitored world blocked past its limit and the Watchdog killed the process. Confirm with the `Watchdog` lines in the system log around the restart (which monitor failed to check in is the named suspect) and the boot-phase lines re-running afterward — `SystemServer` starting late explains the wrong clock better than any clock bug. The welcome stack is a witness because a service death or denial there cannot restart the framework (Breaks 1–3 are all local: a find denial, one daemon tombstone, one stalled lane); its `dumpsys` counters resetting to zero, though, timestamps the restart precisely — use witnesses as clocks before you use them as suspects.

</details>

## Go deeper: kernel and app pointers

When the stall lives below Binder — a driver holding a lock, an interrupt storm — the same Perfetto timeline carries the kernel's side (ftrace scheduling and IRQ events), and the [kernel path]({{ '/kernel-path/' | relative_url }}) step 5 is the companion reading. App-visible freezes pair this lecture with ANR analysis on the [app path]({{ '/app-path/' | relative_url }}): an ANR trace is, mechanically, Break 3's "where is the thread" question asked of an app process, and it surrenders to the same reading.

<div class="callout"><p><strong>Working with AI agents:</strong> this is their best lecture — and their worst failure mode is confidence without capture. Paste a *bounded* slice (the stage table with the failing row marked, one tombstone, one <code>dumpsys</code> section) and ask for suspects ranked by evidence plus the next capture to run — never for "the fix." Then run the capture. An agent that wants to edit before it can state the layer bound is doing random-walk debugging at machine speed; the loop in this lecture is the leash.</p></div>
