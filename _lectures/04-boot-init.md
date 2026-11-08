---
number: 4
title: "Boot and init"
subtitle: "The relay from kernel to boot-completed, welcomed.rc written properly, and a boot timeline you reconstruct from logs instead of guessing."
reading_time: "~35 min read, plus lab"
lab_time: "2–3 h"
---

## Motivation

Boot failures are where system engineers earn their keep and where beginners lose days, because the failing thing is often not the thing that prints last. A head unit stuck on a logo can be a kernel that never handed over, an `init` script that never started a service, a daemon crash-looping every five seconds, or a framework waiting on a property nobody will ever set. The log will happily show you all four at once, in the wrong order, at 3 a.m. on a bench.

This lecture gives you the sequence, the observable evidence at each stage, and one constructive skill done completely: the init stanza for the course's daemon. Lecture 9 shipped a four-line stand-in `welcomed.rc` so its SELinux denials could happen. Here that file is written properly — service class, interface declaration, restart behaviour, data-directory timing — and every line is defended. By the end you can take any boot, healthy or broken, and reconstruct its timeline from properties and logs alone; and you can look at any `.rc` file on a real program and say when its service starts, as whom, what happens when it dies, and what it is allowed to assume already exists. That last skill is the one that transfers: most "the car won't boot" tickets are answered in an `.rc` file somebody edited without asking those four questions.

## Mental model

Boot is a relay, and `init` is both a runner and the referee:

**Bootloader → kernel → `init` (PID 1) → early stages → Zygote → `system_server`/SystemServer → system services (incl. CarService) → `sys.boot_completed=1` → launcher/SystemUI.**

`init` speaks its own small language, and the language has only three ideas you need daily. **Actions** are `on <trigger>` blocks of commands; triggers are boot stages (`on boot`, `on post-fs-data`) or property changes (`on property:sys.boot_completed=1`). **Services** are `service <name> <path>` blocks with indented options: which class, which user, restart behaviour. **Properties** are the signalling system that connects them: anything may set one, and `init` (plus services that poll them) reacts.

The actual trigger order in the pinned tree's main `/init.rc` (`system/core/rootdir/init.rc`, worth opening once) is: `early-init`, `init`, `late-init`, `post-fs`, `post-fs-data`, `boot`, then property-driven completions. Two class starts are placed with intent you should be able to explain: `on post-fs` runs `class_start early_hal` for the handful of HALs needed before encrypted storage unlocks, and `on boot` runs `class_start hal` and then `class_start core` under the comment "Start standard binderized HAL daemons". Ordinary application-facing classes (`main`, `late_start`) start on `nonencrypted`, after `post-fs-data` has made user data available. So "when does my service start" is never answered by vibes; it is answered by its class and the trigger that starts that class.

Two consequences run the whole lecture. First, properties are a *timeline*, not just configuration: `init.svc.<name>` tells you a service's state (`running`, `stopped`, `restarting`), `sys.init.svc.<name>` variants and restart counters exist on many trees, and `sys.boot_completed` tells you how far the relay got even with a black screen. Second, find the stage before reading the log. A log is a merged river of every stage at once; the stage tells you which tributary to stand in.

## File anatomy: the .rc file

An init service lives in an `.rc` file installed to a partition's `etc/init/` (for vendor modules, `/vendor/etc/init/`), imported automatically by `init` at startup. You do not register the file by hand anywhere else; the module's build rule installs it, which is why Lecture 2 read `init_rc: ["welcomed.rc"]` in the daemon's `Android.bp` as a load-bearing field. The anatomy that matters:

| Part of the stanza | Written as | Decided by it | Wrong, you see |
|---|---|---|---|
| Service header | `service welcomed /vendor/bin/welcomed` | The name everything else uses (`init.svc.welcomed`, `ctl.start` targets) and the binary `init` execs | Name collisions are *ignored with an error logged*, per the init README; your second definition silently does not exist |
| Class | `class hal` | Which trigger starts it (here: `on boot`'s `class_start hal`) | A service in no started class simply never runs, with no error anywhere |
| User/group | `user system` / `group system` | The Unix identity; the SELinux domain is separate (Lecture 9) | File/device access failures that look like policy bugs and are identity bugs |
| Interface | `interface aidl <fq-name>` | Lets init find/start the service by its Binder interface | `interface_start` and lazy-HAL tooling cannot see the service |
| Restart policy | (default), `oneshot`, `onrestart …`, `disabled` | What happens on exit: restart, run once, run a hook, or never auto-start | Crash loops, or a daemon that dies once and takes the feature with it |
| Actions in the same file | `on post-fs-data` blocks etc. | Setup that must exist before the service runs (directories, permissions) | The service starts correctly into a world that is not ready for it |

Read upstream's reference once so the shape is familiar: `hardware/interfaces/light/aidl/default/lights-default.rc` at the pinned tag is five lines — `service vendor.light-default /vendor/bin/hw/android.hardware.lights-service.example`, `class hal`, `user nobody`, `group nobody`, `shutdown critical`. A real program's HAL stanzas add options from the table only as needed; a stanza with twelve options is usually a history of incidents, and reading it as such is a skill this lecture's exercises practice.

### Reading an upstream stanza like a reviewer: zygote

Before writing our own, read the most consequential stanza in the tree, from `system/core/rootdir/init.zygote64.rc` at the pinned tag (trimmed):

```
service zygote /system/bin/app_process64 -Xzygote /system/bin --zygote --start-system-server --socket-name=zygote
    class main
    priority -20
    user root
    group root readproc reserved_disk
    socket zygote stream 660 root system
    onrestart restart audioserver
    onrestart restart cameraserver
    onrestart restart media
    onrestart restart netd
    task_profiles ProcessCapacityHigh MaxPerformance
    critical window=${zygote.critical_window.minute:-off} target=zygote-fatal
```

Run the four questions. *When?* `class main`, which starts on `nonencrypted` — after `post-fs-data`, because forking app processes (and `system_server`, note `--start-system-server` in the binary's own arguments) before user data unlocks would be useless and unsafe. *As whom?* `root`, unusually, because Zygote must setuid down into every app it forks; the group list (`readproc`, `reserved_disk`) is the tell that identity here is capability budgeting, not habit. *On death?* The `onrestart` block is a small disaster protocol: restart the media and network services that hold Binder references into the old `system_server` world, abort FUSE mounts, and reacquire the wakelock. Nothing here is decorative; if your service's death orphans dependents, this block is the pattern your stanza is missing. *What does it assume?* The `socket` lines create the famous `zygote` socket at service start, owned `root:system` mode `660` — the rendezvous every app start in Android passes through, created by init rather than by the daemon because only init can guarantee it exists before the first client. And the `critical` line marks the service whose repeated failure within a window is treated as fatal to the device, not just to the feature. Our `welcomed` needs none of this weight. Reading why the heavyweight needs it is how you learn to keep your stanza light on purpose rather than by luck.

### Properties as a timeline: the sixty-second boot interview

The reconstruction below uses a capture; this one uses only properties, live, and it is the fastest useful thing you can do on an unfamiliar head unit. Four reads, in order:

```bash
adb shell getprop sys.boot_completed
adb shell getprop | grep -E "^\\[init.svc" | grep -E "welcomed|zygote|bootanim|surfaceflinger"
adb shell getprop vendor.acme.welcome.state
adb shell getprop ro.build.fingerprint
```

Interpret them as the table taught. A `sys.boot_completed` of `1` with `init.svc.bootanim` stopped (the property remains set after the service exits) says row 6 fired. `init.svc.zygote` running says row 4's host exists, and since Zygote hosts `system_server`, framework death theories now need framework evidence, not stage suspicion. `vendor.acme.welcome.state` discriminates the three ways "welcome light broken" actually decomposes: `ready` means rows 3 and 5 both held and the feature's own logic ran; `restarting` (or a flicker between reads) means Failure 2's loop with boot otherwise healthy; empty means the daemon never got far enough to set it, pushing you back to row 3's `init.svc.welcomed` and its log. And the fingerprint closes the interview the Lecture 2/3 way: it tells you which product and variant produced this boot, because a staging image and a release image can fail the same way for opposite reasons. Sixty seconds, four commands, and you know the stage, the layer, and the next log to open. That compression — evidence first, at the right altitude — is the entire debugging philosophy of this course in miniature, and Lecture 10 will build the heavy instrumentation on top of it.

## Worked example: welcomed.rc, written properly

### The file

Replace the Lecture 9 stand-in at `device/acme/kestrel/welcomed/welcomed.rc` with:

```
# welcomed — cabin welcome-light daemon (acme Running Example)
# Started by class (on boot, class_start hal); see Lecture 4 for the
# trigger order and Lecture 9 for this daemon's SELinux domain.

service welcomed /vendor/bin/welcomed
    class hal
    interface aidl vendor.acme.hardware.welcome.IWelcomeLight/default
    user system
    group system
    onrestart setprop vendor.acme.welcome.state restarting

# The daemon's data directory must exist, with the label Lecture 9
# assigned, before the daemon first opens it. /data/vendor is only
# available after post-fs-data, so the mkdir lives here, not in the
# service stanza and not in the daemon.
on post-fs-data
    mkdir /data/vendor/welcomed 0770 system system
```

Line by line. `class hal` places the daemon in the class that `on boot` starts, alongside the other binderized HAL daemons and *before* `system_server`'s consumers come looking — the correct neighbourhood for something whose only client (Lecture 5's service) lives in `system_server` and will start later. Contrast the stand-in's risk had we chosen `class late_start`: the daemon would start on `nonencrypted`, later, for no benefit, and every "service not found" during early CarService startup would be our fault. The `interface aidl …` line declares the Binder face in init's own registry, using the exact instance name Lecture 9 labelled in `service_contexts`; it costs nothing and buys `interface_start`-style tooling and lazy-service options later. `user system` / `group system` match the identity Lecture 9's policy assumes — change them here and the policy's file-access reasoning must change too, which is why these two files are reviewed together on real programs. `onrestart setprop …` runs one command when (not if) the daemon is restarted: it marks the status property `restarting`, so a Lecture 10 investigator can distinguish "daemon died and came back" from "never started" in a single `getprop`. Note what is absent, deliberately: no `oneshot` (a welcome-light daemon that exits must be restarted; `oneshot` means *do not restart when it exits*, per the init README, and would convert any crash into a silent feature deletion), no `disabled` (which means *not started with its class*), and no `shutdown critical` (the lights HAL declares it because lights participate in shutdown paths; a welcome light does not, and claiming criticality you do not need slows every reboot for every user).

The `on post-fs-data` block is the line beginners most often put in the wrong place. The daemon opens `/data/vendor/welcomed/state` at startup (Lecture 9's stand-in does this literally). `/data` is not mounted, let alone decrypted, at `class hal` time on many configurations — but the directory is created once, at `post-fs-data`, with mode and ownership set by init, and Lecture 9's `file_contexts` entry gives it the `welcomed_data_file` label when `restorecon` semantics apply. It persists across boots, so creating it is idempotent. Creating it from inside the daemon instead would require the daemon to hold directory-creation permissions on `/data/vendor` itself — a broader SELinux grant (Lecture 9 refused exactly this shape) to solve a problem init solves for free.

Rebuild and reinstall the module, reboot, and verify all four questions from the anatomy table in one pass:

```bash
m welcomed selinux_policy   # then rebuild/relaunch your image
adb shell getprop init.svc.welcomed
# running
adb shell getprop vendor.acme.welcome.state
# ready
adb shell ls /vendor/etc/init/ | grep welcomed
# welcomed.rc
adb shell ps -Z | grep welcomed
# u:r:welcomed:s0 ... /vendor/bin/welcomed
```

<div class="checkpoint"><strong>Checkpoint:</strong> <code>init.svc.welcomed</code> reads <code>running</code> (not <code>restarting</code> — hold that distinction for Failure 2), the status property says <code>ready</code> rather than <code>restarting</code>, and the stanza you wrote is the file on the device at <code>/vendor/etc/init/welcomed.rc</code>. Three different subsystems — init state, your property contract, and the installed artifact — agree.</div>

### The import graph: how your `.rc` reaches PID 1

Owners add `.rc` files and assume init will "find" them; init is more specific than that, and the specifics explain several otherwise-mysterious non-starts. First-stage init mounts the logical partitions, then processes the main `init.rc`, whose `import` statements pull in platform files (including the hardware-specific `init.${ro.hardware}.rc`), and init additionally scans the per-partition rc directories: `/system/etc/init`, `/product/etc/init`, `/odm/etc/init`, and `/vendor/etc/init`. `welcomed.rc` ships in that last directory because Lecture 2's `Android.bp` installed the daemon's rc with the vendor module — vendor daemon, vendor init config, one owner. Three consequences matter in reviews. Duplicate service names across the whole graph are the Failure 1 family: the second definition is ignored with an error logged, and the *first* wins, which is why "a second rc file I added does nothing" is a duplicate-name symptom before it is a class symptom. Ordering guarantees are trigger-based, not filename-based: two files both hooked to `post-fs-data` run in parse order, which is an implementation detail you must not load ordering semantics onto; if step B truly requires step A, express it as a property gate or a class boundary, not as "my file sorts first." And SELinux labels travel with the partition: init can only `exec` or create what the vendor policy allows from vendor context, which is why Lecture 9's labelling of the binary and the data directory shows up again here as "did the `on post-fs-data` mkdir succeed" rather than as an abstract policy question. The import graph is invisible when it works; the moment a service does not start, it is the first map you need.

### Timing arithmetic: reading boot progress like an accountant

Stage evidence tells you where the boot is; elapsed time tells you whether it is healthy there. When `boot_progress` markers are in the log, read them as a ledger — representative numbers in the standard format:

```
BOOT_PROGRESS_START 120              (init running, mounts proceeding)
BOOT_PROGRESS_PRELOAD_START 2850     (Zygote preloading classes/resources)
BOOT_PROGRESS_PRELOAD_END 5600
BOOT_PROGRESS_SYSTEM_RUN 7400        (system_server starting services)
BOOT_PROGRESS_PMS_START 8100         (PackageManagerService scan starts)
BOOT_PROGRESS_PMS_READY 14200
BOOT_PROGRESS_AMS_READY 15600        (ActivityManager ready)
BOOT_PROGRESS_ENABLE_SCREEN 19200
```

Do the subtraction before theorizing: preload consumed 5,600 − 2,850 = 2,750 ms, the package scan 14,200 − 8,100 = 6,100 ms — the largest line item on this device, and the one that grows exactly when somebody ships more preinstalled apps (Lecture 8's subject) or the user-data package state is cold. Neither number is "the boot problem" yet; they are the two accounts where money went, and the corrective action differs completely per account (preload tuning versus package inventory versus storage health). On a car, add the product question this ledger must answer: the rear-view camera and cluster tells have hard time budgets while `PMS_READY` plainly does not, which is why AAOS systems budget the ledger per account and treat a growing middle section as a product defect even when total boot time still "feels fine" in the lab. Lecture 10 teaches the tracing machinery; this arithmetic — markers, differences, biggest account, named cause — is the habit that makes the machinery worth opening.

### Reconstructing a boot timeline from evidence

Now the diagnostic half of the lecture, performed on the healthy boot you just made so the broken ones have a reference. Capture first, analyse second:

```bash
adb logcat -b all -d > kestrel-boot-healthy.log
grep -nE "boot_progress|SystemServerTiming.*(Start|Ready)|boot_completed" kestrel-boot-healthy.log | head -n 40
adb shell getprop | grep -E "sys.boot_completed|init.svc.(zygote|welcomed|bootanim)"
```

From those, build the table this lecture will use for every boot from now on. Times below are representative (your Cuttlefish numbers will differ; the *order and the markers* are the contract):

| # | Stage boundary | Evidence marker | Healthy sign |
|---|---|---|---|
| 1 | Kernel → init | Kernel log ends, early `init` lines; `adb` may not exist yet | No panic; `init` starts importing `.rc` files |
| 2 | `post-fs-data` | Data mounted/decrypted actions; your `mkdir` runs here | `/data/vendor/welcomed` exists with the right label (`ls -Z`) |
| 3 | `on boot`: `class hal` | HAL daemons start; `init.svc.welcomed` → `running` | Daemon up *before* its framework consumers |
| 4 | Zygote → SystemServer | `boot_progress_start`, `SystemServerTiming` lines begin | Steady progress; no single timing line eating the boot |
| 5 | CarService and system services | Car service in `service list`; Lecture 5's service registers | Consumers find `IWelcomeLight` (Lecture 9's `find` grant exercised) |
| 6 | Boot completed | `sys.boot_completed=1`; `BOOT_COMPLETED` receivers run | Value reads back `1`; boot animation service stops |

The method matters more than the table: every row names an *observable*, not a hope. On a broken boot you walk the rows top-down and stop at the first row whose observable is wrong; that row's stage owns the bug, and only then do you read its log slice. The slowest-gap variant of the same method — subtract consecutive marker timestamps and attack the largest gap — answers the other great boot question ("it boots, but it takes ninety seconds") and is Lab Tier 1's deliverable. Notice row 3's placement: because `class hal` starts on `boot`, a HAL-class daemon's absence cannot be blamed on the framework, and a framework service's "HAL not found" cannot be blamed on the daemon until row 3 checks out. Stage-first, logs-second is not a slogan; it is this table, used in order.

### ueventd: the boot you do not see

Parallel to the service story runs a hardware story owned by `ueventd`, init's sibling daemon: it listens for kernel uevents and creates the `/dev` nodes (and fixes their ownership and modes) as devices appear, including the synthetic coldplug replay that materializes everything already present at boot. The rules live in `ueventd.rc` files — the core one at `system/core/rootdir/ueventd.rc`, which itself `import`s `/vendor/etc/ueventd.rc` and `/odm/etc/ueventd.rc`, the exact slots a board vendor owns. The rule grammar is one line per node family, from the upstream file verbatim in shape: `/dev/binder 0666 root root`, `/dev/dma_heap/system 0444 system system`. For kestrel this is where `/dev/welcome_light` gets its existence and permissions: a vendor ueventd rule (Kestrel hardware configuration — the device tree and driver determine the real node; the rule pattern is upstream's) assigns the node to the `system` user/group family the daemon runs as, and Lecture 9's SELinux type (`welcome_light_device`) then governs it a second time. Hold both mechanisms apart deliberately, because bench debugging constantly confuses them: DAC permissions from ueventd answer "does the Unix mode let this uid in," SELinux answers "does policy let this domain in," and a node can pass either gate while failing the other — which is precisely the two-error-messages problem (`Permission denied` versus an `avc: denied` for the same open) that Lecture 9's denial reading separates. Timing note: `welcomed` opens the node at startup, so coldplug ordering matters; drivers that surface late produce the not-yet variant of Failure 3, and the daemon's open-with-retry behaviour (within its first seconds) is the designed answer rather than an init ordering hack. Boot is a relay of at least three runners — mount/first-stage, ueventd's device materialization, and init's triggers — and "the daemon started before its device existed" is the baton drop between runners two and three.

### Boot modes: when the relay deliberately runs a different race

Everything above is the *normal* boot. The same first-stage code also serves recovery, the off-mode charger, and the bootloader handoff paths, and recognizing a mode switch saves hours of "why is none of my stuff running." Recovery boots a separate (or combined) recovery ramdisk image whose init starts recovery's own minimal services: no Zygote, no `system_server`, no `welcomed`, by design. The charger path (`ro.bootmode=charger` family) similarly runs a minimal animation-only environment. For your work the actionable consequences are two. First, properties like `ro.bootmode` and the `init.svc.*` census tell you the mode before you interpret absences: a missing `welcomed` in recovery is health, a missing `welcomed` in normal mode is Failure 1, and confusing the two has launched many wild goose chases. Second, the Lecture 2 arrangements (separate recovery resources, dynamic partitions, the OTA machinery of Lecture 11) exist because these modes share a kernel and a partition table while intentionally sharing almost nothing else. When the timeline reconstruction below "loses" the boot at an early row, checking which race is actually being run is step zero.

### Inside row 5: `system_server`'s own phase relay

Row 5 deserves a zoom, because "framework up" is itself a relay with gates every system service must respect — and Lecture 5's service will live here. `SystemServer` starts services in dependency order under `SystemServiceManager`, which dispatches numbered boot phases defined in `SystemService` at the pinned tag: `PHASE_WAIT_FOR_DEFAULT_DISPLAY = 100`, `PHASE_LOCK_SETTINGS_READY = 480`, `PHASE_SYSTEM_SERVICES_READY = 500`, `PHASE_DEVICE_SPECIFIC_SERVICES_READY = 520`, `PHASE_ACTIVITY_MANAGER_READY = 550`, `PHASE_THIRD_PARTY_APPS_CAN_START = 600`, and `PHASE_BOOT_COMPLETED = 1000`. Services override `onBootPhase(phase)` and do each kind of work only when its gate opens: nothing that needs the keyguard/lock-settings stack before 480, nothing that assumes other system services are all registered before 500, nothing app-facing before 600, and anything that must wait for the full boot (including the `BOOT_COMPLETED` broadcast world) at 1000. Read the constants as the framework's version of init's classes: the same discipline — *name the stage that guarantees your preconditions, start exactly there* — expressed in Java constants instead of rc triggers. When Lecture 5's system-side welcome service chooses where to connect to `welcomed`, it will make exactly this decision in these numbers: connecting at 500 is a claim that the vendor daemon's Binder registration (row 3) plus service discovery is a safe precondition, and the claim is checkable on-device with the same `init.svc.welcomed` and `service check` evidence. Two boot systems, one contract language. The engineers who debug cars fastest are fluent in both because the failure that presents in one is frequently authored in the other.

## The three boot failures you will actually meet

**Failure 1: the service is never started, and nothing complains.** `init.svc.welcomed` is absent entirely (not `stopped` — absent), and `ps` shows nothing. In order: the `.rc` file is not installed (`ls /vendor/etc/init/` — the fix lives in the module's `init_rc` field, Lecture 2, not in the `.rc` text); the file is installed but the class is wrong or misspelled, so no started class ever includes it; or a second service already claimed the name `welcomed` earlier in init's parse order and yours was ignored with an error in the kernel log (`dmesg | grep -i init` — the init README warns that duplicate service definitions do not merge). The tell that separates this failure from the other two: total silence. Init does not log "service not started"; absence *is* the symptom.

**Failure 2: the crash loop.** `init.svc.welcomed` cycles `running`/`restarting`, your status property reads `restarting` (the `onrestart` line from the worked example just paid for itself), and the boot may still complete — which is why this failure reaches the field. Triage order, fixed: the crash evidence first (`logcat -b crash`, `/data/tombstones/` — Lecture 10 teaches reading them), then policy (`logcat -b all | grep avc` near the restart timestamps; a fresh SELinux denial after any Lecture 9 change is the prime suspect), then dependencies (missing library or HAL in the daemon's own log lines). What you must not do is reach for `oneshot` to stop the cycling: that converts a loud failure into a silent missing feature. A crash loop is information with a period of about five seconds; use the period to capture, then fix the cause.

**Failure 3: started, healthy, and too late — or waiting on a world that never comes.** The daemon runs, but consumers report it missing during their startup, or the daemon blocks forever on a file or property. Two shapes dominate. The daemon was placed in a late class (`late_start`, or worse, gated on `on property:sys.boot_completed=1` as a service-start trigger) while its consumers start earlier — a vehicle function that arrives after drive-away has, for automotive purposes, not arrived, which is why the worked example rejected boot-completed gating for `welcomed`. Or the daemon waits on something sequenced later than itself: a directory created at a trigger after its class, a property set only by a framework service that is itself waiting for the daemon. That second shape is a dependency cycle written in two files, and it is found by exactly the Stage table above: write down what each side waits for, in trigger order, and the cycle shows itself. The fix is sequencing — move the setup earlier (`post-fs-data` is the usual home) or remove the wait — never a sleep. A `sleep` in a daemon is a boot-time race you have decided to lose intermittently in the field.

If `adb` never arrives at all, drop one stage below this lecture: serial console or `dmesg` for the kernel, early init output in the kernel log, and the usual first suspect on any bench — the wrong image or partition was flashed (Lecture 2's fingerprint check, applied before any boot analysis). Boot bugs hate being recorded, so wherever the target allows, start the capture *before* the reboot that reproduces, not after.

### Decision drill: class and user for four new services

The worked stanza generalizes. For each hypothetical, the answer is a *precondition sentence* first and syntax second:

| Service | Needs | Class | User | Why not the tempting alternative |
|---|---|---|---|---|
| Calibration reader that must seed a property from `/data/vendor` before apps run | Unlocked vendor data; no display, no framework | `late_start` (fires after `post-fs-data` without waiting for full framework) | `system` | `class hal` also works but over-promises HAL-style availability to early clients that do not exist |
| Display splash daemon that must show before `system_server`'s phase 100 | Framebuffer before default display | `early_hal` | `system` (+ graphics group) | `class core` starts after `hal` on `boot` — too late for a splash whose entire purpose precedes it |
| Fleet telemetry uploader | Network, app data, user consent state | `late_start`, or app-hosted (Lecture 8) | `system` (or app uid) | `class hal` would start it on every boot including before networking exists, manufacturing Failure 3 restarts |
| One-time factory provisioning tool | Run once at first boot, never again | `late_start` + `oneshot` + `disabled`, started by an explicit property trigger | `root` only if it truly writes protected areas | `oneshot` alone without `disabled` still runs on every boot with its class — "one-time" is the combination, plus the tool deleting/flagging its own completion |

If you can write the precondition sentence, the stanza writes itself; if you cannot, the stanza will encode a guess and the boot will grade it in production. That sentence is also the review artifact: in code review, ask for it explicitly before reading a single option.

## Lab (guided)

Same daemon at both tiers: Tier 1 reconstructs a boot from evidence; Tier 2 changes the daemon's startup behaviour and proves the change from properties and logs.

**Tier 1 — read a boot (AAOS emulator or Cuttlefish, ~1 h, no file changes).**

1. Boot the target while capturing (`adb logcat -b all` started as early as your target allows) and save the capture with the build fingerprint in the filename. Checkpoint: the file's first lines let you name the build (`ro.build.fingerprint` from a `getprop` snapshot saved beside it).
2. Build the six-row stage table for *this* boot from grep markers, with your real timestamps. Checkpoint: every row cites a line number in your capture; a row you "know" happened but cannot cite gets marked as unobserved, which is the correct scientific state and the interesting one.
3. Compute the gaps between consecutive markers and name the single slowest one with its evidence. Checkpoint: your claim is a subtraction anybody can re-run, and you can state one plausible owner (service, HAL wait, storage) plus the next command that would test it.
4. Record `init.svc.welcomed` (or the closest HAL-class service on an emulator image without it), `init.svc.zygote`, and `sys.boot_completed`. Checkpoint: the three values are consistent with your table's rows 3, 4, and 6 — or you have found a genuine inconsistency and written down which row to distrust.

**Tier 2 — change the startup, prove it (kestrel_auto on Cuttlefish, ~2 h).**

1. Install the worked example's `welcomed.rc` (rebuild `m welcomed`, rebuild/relaunch), and run its four verification commands. Checkpoint: all four agree, as in the worked example.
2. Add a harmless late-start companion: a second stanza `service welcomed-probe /vendor/bin/kestrel-info` (the script module from Lecture 2's lab; give it `class late_start` and `oneshot`), rebuild, reboot. Checkpoint: from `init.svc.welcomed-probe` and log timestamps, `welcomed` (class `hal`, on `boot`) is running before the probe executes, and the probe's oneshot lifecycle — run once, `stopped`, never restarted — is visible in properties rather than assumed.
3. Break it deliberately, one failure at a time, in the order of the failures section: rename the service in the stanza (Failure 1's collision/absence shape), then make `kestrel-info` exit non-zero every run *without* `oneshot` on the probe and watch `init.svc.welcomed-probe` cycle (Failure 2's shape, safely confined to the probe), restoring the file after each. Checkpoint: for each break you have the property evidence *before* the log evidence — stage-first, demonstrated on your own machine.
4. Gate the probe on `on property:sys.boot_completed=1` instead of its class (convert it to `disabled` and start it from that trigger), reboot, and record when it runs relative to your Tier 1 table. Checkpoint: you can state, with timestamps, what a vehicle function gated this way would miss — the drive-away paragraph of Failure 3, now with your own numbers.

**Tier 3 — bench (optional, 30 min).** On any real head-unit image you can inspect, find one HAL-class and one `late_start` service, and write the four answers for each: when, as whom, restart behaviour, assumed setup. Flag any `oneshot` daemon whose death would silently delete a feature.

*Verification status: trigger order, class starts, service-option semantics, and HAL stanza shape checked against `android-17.0.0_r1` (`system/core/rootdir/init.rc`, `system/core/init/README.md`, `hardware/interfaces/light/aidl/default/lights-default.rc`); see `docs/verification/lecture-04-source-truth.md`. Tier 2's boot cycles were not run in the authoring environment; your captures are the verification, so keep them.*

## Exercises

1. Boot completes (`sys.boot_completed=1`) but the welcome light never works and `init.svc.welcomed` reads `running`. Using the stage table, name the two rows you check next and the evidence each gives you.
2. A teammate "fixes" the Failure 2 crash loop by adding `oneshot` and the boot log goes quiet. Write the review comment: what changed semantically, what the field will now experience, and what you require instead.
3. A new sensor daemon must start only after `/data` is available, must restart if it dies, and must be startable by name from another `.rc` file for a factory test. Write its stanza (name it `sensord`, binary `/vendor/bin/sensord`, class of your choosing) and defend each option in one line.
4. On a broken boot, `init.svc.zygote` is absent and the kernel log is clean, but HAL services are running. Which stage owns the bug, which marker do you grep next, and why is reading the CarService log at this point a waste of a capture?
5. Your daemon must publish a "ready" property only after it has opened the light device successfully. A teammate proposes `onrestart setprop` for this too. Explain why the *ready* marker cannot live in init, where it must live instead, and which line of the worked example is the contrasting case that *can* live in init.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Rows 3 and 5. Row 3's evidence is finer than `running`: check the daemon actually registered (Lecture 9's `service list` check) and that `vendor.acme.welcome.state` reads `ready`, not `restarting` or empty — `running` proves a process, not a working service. Row 5 checks the consumer side: CarService/system services present and their logs for the `find`/call path Lecture 9 granted. Boot completing only proves row 6 fired; the feature lives in rows 3 and 5.
2. Look for: `oneshot` changes init's contract from "keep this daemon alive" to "run it at most once", so the crash still occurs, exactly once, early, and the feature is silently absent for the whole drive — the failure mode IVI users report as "it just doesn't work" with no log to catch. Require instead: the crash evidence (tombstone/crash buffer), the avc check at the restart timestamps, and the root-cause fix; if a stopgap is truly needed, it is a change that keeps the loop loud (a bounded restart note in the bug), not one that mutes it.
3. A strong answer: `service sensord /vendor/bin/sensord`, a class started no earlier than the stage that guarantees `/data` (justify `late_start`/`main` on `nonencrypted`, i.e. after `post-fs-data`, over `class hal` on `boot`), `user`/`group` named for its driver access, *no* `oneshot` (restart-on-death is the default and here a requirement), and *no* `disabled` — or `disabled` plus an explicit `start sensord` from the factory action, with the trade-off stated: `disabled` services are not started with their class, so the factory path must start it by name, which the README's service semantics allow. The oneshot trap and the early-class trap are the two planted errors; a correct stanza avoids both and says why.
4. The Zygote/SystemServer row (row 4). HAL services running rules rows 1–3 in; CarService is a row-5 consumer of a row-4 host that never started, so its log cannot contain the cause. Next grep: the zygote start path in the main `init.rc` chain — the device `.rc`'s start-zygote trigger (on many trees gated on a property such as `ro.zygote`/`dev.bootcomplete`-family conditions; find yours with `grep -rn "start zygote" system/core/rootdir/ device/`) and any `init.svc.zygote*` state, plus `logcat` lines from `init` around the zygote service start. Stage-first: the bug belongs to whatever prevented the service start, which lives in init's world, not the framework's.
5. `onrestart` commands run in init, at restart time, whether or not the new process ever reaches its device-open; a ready flag set there asserts something init cannot know. Readiness is the daemon's own knowledge, so it belongs in the daemon: open the device first, then `property_set("vendor.acme.welcome.state", "ready")` (Lecture 9's stand-in order is exactly this, and its `vendor_restricted_prop` typing is what lets the daemon set it while the system only reads). The contrasting worked-example line is `onrestart setprop … restarting`: init *does* know the daemon is being restarted — that fact is init's, so that marker can honestly live in init. The rule: a property belongs to whoever knows the thing it claims.

</details>

## Go deeper: kernel and app pointers

If your stage table stops at row 1 — no init, no `adb` — you have left this lecture for the kernel's: serial console, `dmesg`, and device-tree territory, in the order the [kernel path]({{ '/kernel-path/' | relative_url }}) steps 1, 3, and 5 lay out. If boot completes and the cabin behaviour is wrong, you have also left, in the other direction: launcher, SystemUI, and the car apps live in Lecture 8 and the [app path]({{ '/app-path/' | relative_url }}) step 4. This lecture's claim ends at a system that finishes booting with its services alive; what they then do is the next lectures' business.

<div class="callout"><p><strong>Working with AI agents:</strong> give the agent a <em>stage-bounded</em> slice — the six-row table with the failing row marked, plus that row's log lines — and ask what sets the next marker. "Boot is broken, here is the whole log" gets a summary of the log; "row 4 never fires, here are the forty lines around row 3, what starts Zygote in this tree?" gets reasoning you can check. As ever, the agent's stage theory is a hypothesis: the properties are the referee, and they are one <code>getprop</code> away.</p></div>
