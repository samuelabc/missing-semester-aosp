---
number: 3
title: "The AOSP command-line environment"
subtitle: "adb, fastboot, repo, and the twenty commands that carry an OEM workday — run as one session against the welcome stack."
reading_time: "~40 min read, plus lab"
lab_time: "2–3 h"
---

<div class="lecture-map"><span class="block-label">Lecture map</span><h2>The whole lecture on one screen</h2><div class="lecture-map-grid"><div><h3>Build the map</h3><ul><li><a href="#motivation">Motivation</a> — the daily instruments</li><li><a href="#mental-model-three-machines-two-shells">Mental model: three machines, two shells</a> — where does this command run?</li></ul></div><div><h3>Walk the work</h3><ul><li><a href="#worked-example-a-the-host-morning-daily-twenty-part-one">Worked Example A: the host morning (daily twenty, part one)</a> — the daily twenty, host side</li><li><a href="#worked-example-b-inside-the-car--the-welcome-stack-session">Worked Example B: inside the car — the welcome-stack session</a> — the welcome-stack session</li><li><a href="#the-fastboot-corner-when-android-isnt-home">The fastboot corner: when Android isn't home</a> — when only the bootloader answers</li><li><a href="#the-clinic-eight-traps-and-their-tells">The clinic: eight traps and their tells</a> — every failure announces its world</li></ul></div><div><h3>Make it a habit</h3><ul><li><a href="#lab-guided">Lab (guided)</a> — your session, fossilised</li><li><a href="#exercises">Exercises</a> — judgement, not recall</li><li><a href="#go-deeper-kernel-and-app-pointers">Go deeper: kernel and app pointers</a> — below Android, on purpose</li></ul></div><p class="map-note">Lost mid-lecture? The Contents rail on the left (top on a phone) always shows where you are. Each section opens with what it teaches and closes with what you can now do.</p></div></div>

## Motivation
<div class="section-opener"><span class="block-label">In this section</span><p>The shell lecture: <code>adb</code>, <code>repo</code>, <code>logcat</code> and friends are the daily instruments, and fluency with them compounds the way MIT's shell lecture compounds — every later skill rides on it.</p></div>

This is the shell lecture. MIT teaches shell fluency because every later skill rides on it; platform work is the same, one level up, with cars attached. `adb`, `repo`, `logcat`, and `dumpsys` are not utilities around the job — on most days they *are* the job. The engineers who debug in minutes what others schedule meetings about are rarely smarter; they are fluent in a surprisingly small command set and they know exactly which machine each command is talking to.

So this lecture is taught as a session, not a reference. You will open two terminals — one on your workstation, one inside a running `kestrel_auto` Cuttlefish — and work a morning: select the product, check the tree, build a module, interrogate the running car, exercise the welcome-light feature end to end, break it politely, and watch it recover. Every command appears with the output it produces (representative, in the real formats) and a reading of what to notice. Lectures 4–12 assume this fluency;

Lecture 10 will cash it in as a debugging runbook whose every command you will already have typed here.

<div class="section-recap"><span class="block-label">Now you can</span><p>Say which daily questions the command line answers faster than any UI — and why fluency here pays rent in every later lecture.</p></div>

## Mental model: three machines, two shells
<div class="section-opener"><span class="block-label">In this section</span><p>Three machines are in front of you — host, target, and bootloader — and every tool belongs to one of them. Confusion about where a command runs explains most beginner errors, so we settle it first.</p></div>

Confusion about *where a command runs* explains most beginner errors, so settle it first. Three machines are in front of you, and each tool belongs to one:

* **`repo` + the build system** live on your workstation and manage the *source*: hundreds of Git projects federated by a manifest (Lecture 1), turned into images by Soong/make (Lecture 2).
* **`adb`** talks to a *running Android system* — over USB or TCP, emulator and Cuttlefish included. If Android isn't up, `adb` has nobody to answer it.
* **`fastboot`** talks to the *bootloader*, in the minutes before Android exists. It flashes partitions and reads bootloader variables; it knows nothing of services or properties.

Inside `adb` there are two shells to keep apart. Your *host shell* is where `adb`, `repo`, and `m` run. The *device shell* (`adb shell …`) executes on the target in the `shell` domain — an unprivileged seat (Lecture 9's audience rules apply to you personally here), which is why some commands answer and others refuse, and why `adb root` on a `userdebug` build (re-starting adbd as root) changes what the same keyboard can do. Half the traps in this lecture's clinic are one shell's syntax evaluated by the other.

Everything else is a lens reachable through the device shell, and the lenses divide by Lecture 10's evidence states: `getprop` and `service list` read the *present* (what is running, what it believes), `dumpsys` reads a service's *self-report* (present, curated), `logcat` reads the *past* (ring buffers of what already happened), `cmd` *acts* (asks a service to do something now), and `setprop` *provokes* (changes a value and watches who reacts). Choosing the lens is choosing the question.

### The daily twenty, enumerated

The subtitle promised twenty; here they are, grouped by the machine they address. Print this table; the session below is just the table, awake.

| World | Command | The question it answers |
|---|---|---|
| source | `repo status` / `repo diff` | What is my delta, across 900 projects? |
| source | `repo sync -c -j8` | Am I on the tree I think I am? |
| build | `lunch <combo>` | Which product/variant is this terminal building? |
| build | `m <module>` / `mm` / `mma` | Build this / this-dir / this-dir-and-deps |
| build | `m nothing` | Does the whole configuration still parse? (Lecture 2) |
| transport | `adb devices` | Who is attached, in which state? |
| transport | `adb shell getprop ro.build.fingerprint` | Which build is *actually* running? |
| device | `adb shell service list` | The census: what registered? |
| device | `adb shell dumpsys <svc>` | What does this service confess? |
| device | `adb shell getprop` / `setprop` | Read the sticky notes / provoke |
| device | `adb shell cmd <svc> help` | What verbs does this service take? |
| device | `adb shell service call …` | Speak Binder by hand, transaction codes and all |
| device | `adb shell stop/start <svc>` | init, obeyed directly (Lecture 4) |
| device | `adb logcat -b <buf> -d` | What already happened, captured |
| device | `adb shell dmesg` | The kernel's side of the story |
| device | `adb push/pull` | Bytes there / evidence back |
| device | `adb install -r` / `am start` | Iterate the app layer |
| device | `adb shell pm list packages` | What does PackageManager believe exists? |
| bootloader | `fastboot getvar current-slot` | Which twin will boot? |
| bootloader | `fastboot devices` | Is the bootloader listening at all? |

Fluency is not memorizing the table; it is the questions becoming reflexes in this order — delta, build, census, confession, history, provocation last. The worked examples now run the table top to bottom.

<div class="section-recap"><span class="block-label">Now you can</span><p>For any command, state which machine it runs on and which shell hears it — before you run it.</p></div>

<figure class="anchor-figure" role="img" aria-label="Concept anchor: three machines, two shells"><p class="anchor-title">Concept anchor — three machines, two shells</p><div class="anchor-cols"><div class="anchor-col"><strong>Host</strong>your workstation: <code>repo</code>, the build, <code>adb</code> client, <code>fastboot</code> client</div><div class="anchor-col"><strong>Target</strong>the car system: <code>adb shell</code>, services, properties, logs</div><div class="anchor-col"><strong>Bootloader</strong>what answers when Android isn't home: <code>fastboot</code> server, flashing, slot control</div></div><figcaption><strong>Read it as:</strong> every command belongs to exactly one machine. Most beginner errors are a good command delivered to the wrong one.</figcaption></figure>

## Worked Example A: the host morning (daily twenty, part one)
<div class="section-opener"><span class="block-label">In this section</span><p>A workstation morning session with the running stack: the daily twenty commands, the <code>repo</code> identity ladder, and a composed session you can rehearse until it is reflexive.</p></div>

Workstation terminal. The session assumes Lecture 2's tree and a Cuttlefish instance you can start; outputs representative.

```bash
source build/envsetup.sh
lunch kestrel_auto-ap4a-userdebug
# ... (envsetup prints the configuration it selected)
repo status
# project device/acme/kestrel/        (*** NO BRANCH ***)
#   -m  BoardConfig.mk
# project packages/services/Car/      (*** NO BRANCH ***)
```

*Reading:* envsetup is not ceremony — it installs the build shell's functions (`lunch`, `croot`, `godir`, the `m` family) into *this* terminal; open a new terminal without it and `lunch` is "command not found," the most common first-day error in the field. `repo status` answers "what have I changed, across 900 projects" in one screen;

the `-m` flag is a modified file, and seeing `BoardConfig.mk` listed reminds you Lecture 2's file is a local delta — exactly what Lecture 1's delta discipline predicts. Learn `croot` (jump to tree top) and `godir <file>` (jump to a file's directory) now; they pay rent daily.

**Starting the car.** Cuttlefish's host tooling assembles a device from your build output: after a build, `launch_cvd` (from the Cuttlefish host package, per Setup) boots the images in `$OUT` as a virtual car — kernel, partitions, and all, in about the time a real head unit takes to wake.

Treat its console output the way you'd treat a bench boot log (it names the instance, its addresses, and its serial console), leave it running in its own terminal (it owns the device's lifecycle), and stop it with `stop_cvd` when the session ends rather than killing processes at random — a half-stopped instance holds the ports and haunts the next morning's `adb connect` (clinic trap 2, self-inflicted edition).

Multiple instances coexist with distinct ports and serials, which is how the bench-farm loop in Worked Example B gets its fleet. None of this changes the device-side session: from `adb devices` onward, virtual and physical targets are indistinguishable, and that indistinguishability — Setup's gift — is what makes every lab in this course possible on a laptop.

```bash
m welcomed            # module-fast: Lecture 2's habit, seconds-to-minutes
mm                    # (inside a module dir: build just this module)
adb devices
# List of devices attached
# 0.0.0.0:6520    device          <- Cuttlefish's first instance, conventional port
adb connect 0.0.0.0:6520   # if it is not already attached
```

*Reading:* `m <module>` over full `m` is the workflow Lecture 2 installed; `mm` inside `device/acme/kestrel/welcomed/` builds what you're standing in. `adb devices` is the census question from Lecture 1 — *who is attached, in which mode* — and the state column is the diagnosis (`device` = talk to me; `offline`/`unauthorized` = see the clinic). Cuttlefish is just a device that happens to be virtual: everything after this line is identical on a bench car, which is the point of the reference target.

```bash
adb shell getprop ro.build.fingerprint
# acme/kestrel_auto/cuttlefish_x86_64:17/AP4A.…/…:userdebug/test-keys   (representative)
adb shell getprop ro.boot.slot_suffix        # _a  (Lecture 11: which twin booted)
adb reboot; adb wait-for-device              # watch it come back, patiently
adb shell getprop sys.boot_completed         # 1 = Lecture 4's relay finished
```

*Reading:* the fingerprint settles every "did you flash the new build?" argument (Lectures 10–11 both start here — memorize the gesture). `wait-for-device` blocks until adbd answers, which is *before* boot completes; `sys.boot_completed=1` is the finish line. Confusing those two states is how scripts race a half-booted car and file flaky bugs against physics.

**Finding the artifact.**

```bash
ls out/target/product/kestrel/ | head        # $OUT: where this product's truth lands
find out/target/product/kestrel -name "welcomed" -o -name "*welcome*" | grep -v symbols | head
m nothing                                    # cheapest full-parse proof (Lecture 2)
```

*Reading:* `$OUT` literacy separates builders from waiters: module outputs land predictably (binaries under their install paths, the unstripped twins under `symbols/` — the tree Lecture 10 archives and Lecture 11 ships metadata about), so "did my change build?" is a `find`, not a rebuild. `mma` earns its place in the table here: `mm` builds the module you're standing in; `mma` also builds its *dependencies*, which is the correct first response when a header in another module changed and `mm` alone links against yesterday's truth.

And `m nothing` remains the five-second lie detector after any product-config edit — run it the way pilots run checklists: every time, without deciding whether this change "needs" it.

**The tree, from the shell.**

```bash
repo diff | head -40                 # what exactly is my delta, line by line?
repo start welcome-fix device/acme/kestrel
git -C device/acme/kestrel log --oneline -3
repo forall -c 'echo $REPO_PROJECT $REPO_RREV' | head -5   # the federation, named
```

*Reading:* `repo` commands are `git` with a manifest accent — `repo diff` federates `git diff`, `repo start <branch> <project>` branches one project (topic branches are the unit of uploadable work in Gerrit workflows; `repo upload` is how AOSP-style review consumes them), and `git -C <path>` drops to the single project when precision beats federation.

The senior habit: before any build, be able to say your delta in one screen (`repo status` + `repo diff --stat` thinking) — Lecture 12's attribution protocol ("smallest differing artifact") starts from engineers who always know what they've changed. When `repo sync` surprises you mid-task, `repo status` before and after is the difference between noticing and debugging it Thursday.

<div class="section-recap"><span class="block-label">Now you can</span><p>Run a host morning session — identify the tree, the target, and the state of both — from your own keyboard, without notes.</p></div>

## Worked Example B: inside the car — the welcome-stack session
<div class="section-opener"><span class="block-label">In this section</span><p>Inside the car with <code>adb shell</code>: interrogate the welcome stack on a running target, including the denied-versus-allowed service call that Lecture 5's counters will explain.</p></div>

Device shell now (every command below is `adb shell …` from the host; a bare `adb shell` drops you at a prompt on the target). This is Lecture 10's first-fifteen-minutes runbook, executed slowly, in peacetime — the same commands, learned before they are urgent.

**The census and the panel.**

```bash
adb shell service list | grep -i welcome
#  42 welcome_light: [com.acme.welcome.IWelcomeLightService]
# 117 vendor.acme.hardware.welcome.IWelcomeLight/default
#     : [aidl.vendor.acme.hardware.welcome.IWelcomeLight]
adb shell getprop | grep -E "welcomed|boot_completed"
# [init.svc.welcomed]: [running]
# [sys.boot_completed]: [1]
# [vendor.acme.welcome.state]: [ready]
```

*Reading:* two registrations, two layers — the framework service (`welcome_light`, Lecture 5) and the HAL (`IWelcomeLight/default`, Lecture 6); a healthy feature needs both lines, and *which* line is missing bounds the layer before any log is opened. The property trio is Lecture 4's boot truth (`welcomed` started), the relay's finish, and the daemon's self-report — note `running` vs `ready` are different claims (process exists vs interface served), the distinction Lecture 10's Break 1 monetized.

### Properties: the system's sticky notes, read fluently

`getprop` with no argument dumps the whole property space; learn to read it in families, because the prefix is the semantics. `ro.*` values are set once at boot and frozen (build identity lives here: fingerprint, build type, the slot suffix's cousins) — a `ro.` value you disagree with is a *build* fact, fixable only in Lecture 2/11 territory. `persist.*` values survive reboots in `/data`, making them the right home for bench toggles and the wrong home for anything a factory reset should forget.

`vendor.*`, `sys.*`, `init.svc.*`, `dev.*` are the live wires: boot progress, service states (Lecture 4's relay rendered as properties), and your own feature's instrumentation (`vendor.acme.welcome.*`). Two verbs complete the fluency. `setprop` *provokes*: some properties are pure data, some are triggers — `ctl.start`/`ctl.stop` (what `stop welcomed` spelled out above) ask init to act, and trigger properties fire `init` rules; and every set is judged by Lecture 9's property contexts, so a refusal here is policy introducing itself personally.

Reading rule for the field: when behaviour and property disagree, check *who may write* the property before doubting who read it — half of all "the service ignored my setting" bugs are a set that never landed, visible in one `getprop` re-read that nobody did.

**Ask the service to confess.**

```bash
adb shell dumpsys welcome_light
# WelcomeLightService
#   hal=connected name=vendor.acme.hardware.welcome.IWelcomeLight/default
#   state=off
#   setCalls=0 deniedCalls=0 failedCalls=0
adb shell dumpsys car_service | grep -A3 -i propert | head -20   # CarService's own sections
```

*Reading:* state before history (Mental model): `dumpsys` is the service's curated present — `hal=connected` closes the Lecture 5 question, the counters open every later one. Develop the reflex of reading dumps in three passes: identity lines (what am I), state lines (what it believes), counters (what it has done). A dump you cannot summarize in one sentence after those passes is a dump to re-read, not to paste into a bug wholesale (Lecture 10's bugreport etiquette).

### Reading any `dumpsys` like a native

The welcome dump is one instance of a system-wide genre; learn the genre once. `dumpsys` with no argument dumps *everything* (that firehose is what `bugreport` packages — Lecture 10), `dumpsys <service>` asks one service, and `dumpsys -l` lists what can confess. Services write their sections free-form, but the good ones — and now yours (Lecture 5) — share a grammar: identity and build lines first, current state, then counters/history, then per-subsystem blocks (`dumpsys car_service` nests a section per car service, each greppable by its header).

Three moves cover most encounters: `dumpsys <svc> | head` for the confession's headline, `grep` for the counter or state you came for (host-side filtering — your disk, your editor), and the *empty section* reading: a missing section usually means the subsystem never started, which is a boot-phase fact (Lecture 4), not a service bug.

When a dump contradicts `getprop` (service says ready, property says stopped), believe the pair, not either: you have found a stale self-report or a dead process with a live ghost entry, and `service check` + `ps` arbitrate. That arbitration instinct — two instruments, one disagreement, third instrument decides — is Lecture 10's whole method in miniature.

**Exercise the feature, then grade the exercise.**

```bash
adb shell cmd car_service get-property-value 356517120 1   # HVAC_FAN_SPEED, driver area
# (representative value reply)
adb shell cmd car_service inject-vhal-event 639634448 1 true   # ACME_DOOR_STATE: door opens
adb shell dumpsys welcome_light | grep -E "state|setCalls"
#   state=on
#   setCalls=1 deniedCalls=0 failedCalls=0
adb shell cmd car_service inject-vhal-event 639634448 1 false  # door closes; state=off
```

*Reading:* two property dialects in one breath — the upstream fan read by its Lecture 1 integer (356517120: the constant *is* the API at this layer, which is why Lecture 7 teaches the algebra), and the course's own door (639634448) driven by Lecture 7's injection verb. The `setCalls` increment is the behaviour's receipt: the chain property → controller → service → HAL executed, and Lecture 12 turns this exact observation into an automated assertion. Injecting events is how you test vehicle behaviour without a vehicle;

treat the verb as a laboratory instrument, not a toy.

### `cmd`: services that take verbs, and knowing who you are

`dumpsys` asks services to *report*; `cmd` asks them to *act*, and the discovery verb is the one nobody teaches: `adb shell cmd car_service help` prints the surface Lecture 7 used (`get-property-value`, `inject-vhal-event`, and friends, straight from `CarShellCommand`'s own help text).

Generalize it: many platform services expose a `cmd` face (`cmd activity`, `cmd package`, `cmd appops`…), each with `help`, and reading the help of the service you are about to debug is the two-minute investment that replaces an hour of source archaeology — the shell equivalent of Lecture 1's "search for definitions first." Pair it with identity literacy:

```bash
adb shell id            # uid=2000(shell) gid=2000(shell) … context=u:r:shell:s0
adb root; adb shell id  # uid=0(root) … (userdebug only; adb unroot hands it back)
```

*Reading:* the `context=` tail is your SELinux domain worn on your sleeve — the same `u:r:shell:s0` that Lecture 9's policy grants almost nothing, which is why this lecture's next section goes the way it does. Know which of the three seats you occupy at all times (host user, shell, root): commands don't fail randomly between them, they fail *by design*, and the design is the course.

**Meet your own privileges.**

```bash
adb shell service call welcome_light 2 i32 1        # set attempt, shell domain
# Result: Parcel(… SecurityException …)               (representative)
adb shell dumpsys welcome_light | grep deniedCalls  # deniedCalls=1
adb root && adb shell service call welcome_light 2 i32 1
adb shell dumpsys welcome_light | grep setCalls     # setCalls=2
```

*Reading:* the lecture in miniature. The shell call reaches the service (Binder doesn't care who you are) and dies at Lecture 5's *permission check* — `deniedCalls` confesses it — while root passes. Three different gates got exercised this morning and they are not interchangeable: SELinux decides whether your domain may *find* services (Lecture 9; try `service call` against the HAL's name as shell and meet that gate too), the Android permission decides whether the *service* will act for you, and the interface decides whether the request is well-formed.

When a call fails in the field, the counter and the exception tell you which gate — fluent engineers read the refusal before touching anything.

**Provoke and recover.**

```bash
adb shell stop welcomed
adb shell getprop init.svc.welcomed        # stopped
adb shell dumpsys welcome_light | grep hal # hal=unavailable   (Lecture 5, designed)
adb shell start welcomed
adb shell getprop vendor.acme.welcome.state  # ready; dumpsys: hal=connected again
```

*Reading:* init obeys `stop`/`start` by service name (Lecture 4's contract), the framework service degrades honestly instead of dying with its dependency, and recovery re-links and re-reads daemon state. You have now deliberately broken and healed the stack with five commands — the gentle rehearsal of Lecture 10's three breaks, and the correct first response when a bench feature "just stops": bound it with the panel before restarting anything in anger.

**Moving bytes: push, pull, install, look.**

```bash
adb push out/target/product/kestrel/symbols/vendor/bin/welcomed /data/local/tmp/
adb pull /data/tombstones/tombstone_03 ./bug-2314-tombstone_03
adb install -r com.acme.welcome.apk        # the Lecture 8 companion, bench iteration
adb shell am start -n com.acme.welcome/.MainActivity
adb exec-out screencap -p > bug-2314-screen.png
```

*Reading:* `/data/local/tmp/` is the shell's writable scratch space — the one address to memorize for staging payloads (Lecture 11's OTA rehearsal pushes there in spirit), test binaries (Lecture 12's), and anything the device's policy would rather you didn't scatter. `pull` is evidence collection (tombstones keep their build fingerprint company — name the local file for the bug, as shown).

`install -r` iterates on the app without uninstalling its data; on a platform-signed component like ours the device will (correctly) refuse a differently-signed build — Lecture 8's key lineage enforced at your keyboard. `am start` launches by component name for smoke tests, and `exec-out screencap` captures pixels without shell mangling binary output — bug reports with the screen *and* the logs close faster than either alone.

**The package lens.**

```bash
adb shell pm list packages | grep acme
# package:com.acme.welcome
adb shell dumpsys package com.acme.welcome | grep -E "CONTROL_WELCOME_LIGHT|granted=true" | head
adb shell cmd package list packages -U | grep acme    # (representative flags)
```

*Reading:* PackageManager is the third census (processes, services, now *packages with their grants*), and its dump is where Lecture 8's signing story becomes checkable from a keyboard: the companion app exists, and its grant lines show whether `CONTROL_WELCOME_LIGHT` arrived via certificate or via the privapp allowlist — the two mechanisms Lecture 8 separated, distinguishable here in seconds when a permission mysteriously doesn't.

When the app "can't call the service," this dump plus Lecture 5's `deniedCalls` divide the world cleanly: no grant (package layer) vs held-but-refused (service policy) vs never-arrived (Binder/SELinux). Three layers, three instruments, one grep each — the daily twenty earning its name.

**History, briefly.**

```bash
adb logcat -b crash -d | tail -5        # what died lately (nothing, on a good morning)
adb logcat -d -v threadtime | grep -i welcomed | tail -10
adb shell dmesg | grep -ci avc          # 0: policy is not part of today's story
```

*Reading:* `logcat -b` chooses the buffer (history's chapter), `-d` dumps and exits (capture, don't tail, when filing evidence), `-v threadtime` because *which thread* is half of every concurrency story. Capture-to-file with the bug's name at capture time (`adb logcat -b all -d > bug-2314-morning.log`) — Lecture 10 will not let you do otherwise. Two refinements complete the mechanic.

Narrow by process when the process is the question: `adb logcat --pid=$(adb shell pidof welcomed)` follows the daemon alone (and quietly teaches the composition rule from the clinic — the `$(…)` ran on your host, asking the device for the number, before `logcat` ever started). And filter by tag-and-priority when watching live (`adb logcat Welcomed:D *:S` — show this tag at debug, silence the rest) rather than dumping wide; live watching and evidence capture are opposite disciplines, and choosing wrong gives you either a flood or a gap.

Lecture 10 builds the full doctrine (buffers as separate histories, ring-buffer urgency) on these mechanics; here, fluency is the goal: fingers that reach for the right lens without a search engine.

### When the session seems to lie

It will happen this month: `dumpsys` says the light is on, the lamp is dark. The session did not lie; one instrument was read past its warranty, and the warranties are the content. A `dumpsys` is the service's *curated belief* — it can be stale (cached state, a re-read that hasn't happened since the daemon flapped), and Lecture 5's design (state owned by the daemon, re-read on reconnect) tells you exactly which staleness is possible and for how long.

A property is whoever-wrote-last's claim, and properties have no memory of who that was. A counter is the most honest citizen here (it only ever moves when the event happens) — which is why this course keeps promoting counters from debug aid to test assertion to health gate.

The fluent response to disagreement is never to pick a favourite instrument; it is to add the one whose warranty covers the gap (daemon's own state via the interface, hardware truth via the device node, history via the crash/log buffers) and let the three vote. Lecture 10 called this bounding the layer; at the keyboard it feels like a habit: *never argue with a single instrument.*

### The five-minute version

Fluency compresses. Once the session is habit, the whole panel is one composed line, run on arrival at any car:

```bash
adb shell 'echo ===; getprop ro.build.fingerprint; getprop ro.boot.slot_suffix;
  service list | grep -i welcome; dumpsys welcome_light | head -6'
```

and the bench-farm variant loops it over every attached target (`adb devices` parsed, `-s` per device, output filed per serial). Compose carefully: the single quotes keep the composition on the *device* (one round trip, device-side sequencing), while splitting it into separate `adb shell` calls buys host-side filtering at the price of reconnecting between breaths — both are legitimate, and knowing which you typed is clinic trap 3, mastered.

This composed panel, run before touching anything, is the smallest unit of professional conduct this course teaches; Lecture 10 merely gives it stakes and a name.

### From session to script

Everything above was typed by a human, once. The professional move is to fossilize the session into a script the day it first teaches you something — Lecture 12's behaviour tests are this fossil, fully evolved, but the intermediate form is a humble shell script that captures a *known-good morning* for later diffing:

```bash
#!/bin/bash
# morning.sh <outdir> — capture the panel, named by the build it describes
OUT=${1:?usage: morning.sh <outdir>}
mkdir -p "$OUT"
FP=$(adb shell getprop ro.build.fingerprint | tr -d '\r')
echo "$FP" > "$OUT/fingerprint.txt"
adb shell service list > "$OUT/services.txt"
adb shell dumpsys welcome_light > "$OUT/dumpsys-welcome_light.txt"
adb shell getprop > "$OUT/getprop.txt"
adb logcat -b all -d > "$OUT/logcat-all.log"
echo "captured $FP into $OUT"
```

*Reading:* three disciplines hide in fifteen lines. Outputs are *named by content* (the fingerprint is read first and filed, so every capture is self-labelling — Lecture 10's capture rule, automated). The script takes the target as given (`adb -s` belongs in real versions; see clinic trap 6) and refuses to guess an output directory.

And it captures the *panel*, not a conclusion: scripts collect evidence at machine speed so that humans can compare mornings — run it before and after any change and `diff` becomes your cheapest regression test, the prose ancestor of Lecture 12's assertions on the same counters. Keep such scripts beside the feature (Lecture 2's device tree grows a `tools/` corner on real programs) and version them like code, because they are.

<div class="checkpoint"><strong>Checkpoint:</strong> one page of terminal from this session answers Lecture 1's three questions for the welcome feature — which processes own it, which files decided it, which layer any misbehaviour belongs to — without a GUI, a meeting, or a guess.</div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Interrogate a running welcome stack from the device shell and read its answers as a census, not as noise.</p></div>

## The fastboot corner: when Android isn't home
<div class="section-opener"><span class="block-label">In this section</span><p>When Android isn't home: <code>fastboot</code> territory, where the bootloader is the only thing answering and the commands are the ones you cannot take back carelessly.</p></div>

`adb`'s silence has a differential. If the device is early in boot, wedged before adbd, or deliberately rebooted to the bootloader, you are in fastboot's world:

```bash
adb reboot bootloader        # or the target's own key/chord/console path
fastboot devices             # the bootloader census (different list, different tool)
fastboot getvar current-slot # _a  (the variable Lecture 11's bootloader acts on)
fastboot getvar all | head -30
fastboot reboot
```

*Reading:* `getvar current-slot` is verified against the tool's own source (it queries exactly this variable when reasoning about A/B), and it is the bootloader's answer to Worked Example A's `ro.boot.slot_suffix` — same truth, one floor down. Discipline for this corner: flashing commands (`fastboot flash <partition> <image>`) are Lecture 11's payload machinery done by hand — powerful, unforgiving, and on a slotted device always aimed at a *named slot's* partition; never flash from a tutorial you haven't read against your slot sheet.

Cuttlefish largely bypasses fastboot (its launch flow assembles the device host-side), so treat this corner as bench-hardware literacy: brief, respected, and rarely your first move — `adb`'s world is where system work lives.

<div class="section-recap"><span class="block-label">Now you can</span><p>Operate in the bootloader deliberately — and name which commands are reversible before you run the ones that are not.</p></div>

## The clinic: eight traps and their tells
<div class="section-opener"><span class="block-label">In this section</span><p>Eight expensive traps, each with its cheap tell: every failure announces its world — source, build, transport, device, or bootloader — if you read the tell before you start fixing.</p></div>

Every entry below was collected the expensive way by somebody's team; the tell is the cheap part — each failure announces its world (source, build, transport, device, bootloader) if you read the refusal instead of retrying louder. When a command misbehaves this week, find its trap here before inventing a ninth.

1. **`unauthorized` in `adb devices`.** Android is up; it doesn't trust this host key. Fix: accept the on-screen prompt (someone with the device must tap), or `adb kill-server` and reconnect to re-offer. Headless benches solve this once, with provisioned keys — not per engineer, per morning.
2. **`offline` / connection refused to Cuttlefish.** Usually the instance isn't running (or a stale server holds the port). `adb kill-server; adb connect 0.0.0.0:6520` after confirming the instance lives; blaming the target for a dead host process is the tell of skipping the census.
3. **The command ran on the wrong shell.** `adb shell getprop | grep x` — the pipe ran on your *host*, fine here; but `adb shell "dumpsys > /data/x"` writes on-device while `adb shell dumpsys > x` writes on-host, and `$VAR` inside double quotes expands *on the host* before adb sees it. Rule: quote for the shell you mean; when in doubt, drop into a bare `adb shell` and type at the target's own prompt.
4. **`service call` gibberish.** You addressed the wrong transaction code (they are positional — Lecture 6's append-only rule exists because code 2 must mean `setEnabled` forever) or marshalled the wrong types (`i32`/`i64`/`s16` are your spelling of the AIDL). The parcel that comes back (`Result: Parcel(...)`) prints hex; read the exception string, not the hex.
5. **`remount` "fixes" that evaporate.** `adb root && adb remount` makes `system`/`vendor` writable *for iteration* on userdebug; anything you push lives only until reflash and exists in no build. Bench hacks graduate by becoming product changes (Lecture 2) or they become next month's "works on my car" mystery.
6. **Green commands, wrong car.** Two targets attached, no `-s`: `adb` picks one (or refuses, depending on version). `adb -s 0.0.0.0:6520 shell …` names the patient. Half of all "the update didn't take" reports are surgeries performed on the car in the next bay.
7. **Two adbs, one device.** The host runs a *server* (a background daemon brokers every connection); an IDE's bundled adb and your tree's adb can fight over it, and version skew presents as devices flapping between states. `adb kill-server` then one true `adb` is the unglamorous cure; knowing the server exists is the diagnosis.
8. **Scripts that lie about failure.** Through pipes and `adb shell`, exit codes attenuate — a failing device command can exit 0 host-side while its pipeline "succeeds." Scripts that gate decisions (your `morning.sh`, Lecture 12's runners) assert on *output content* (the counter moved, the string appeared), never on the pipeline's exit status alone.

<div class="section-recap"><span class="block-label">Now you can</span><p>Read a failure's tell, name its world, and only then reach for that world's tool.</p></div>

## Lab (guided)
<div class="section-opener"><span class="block-label">In this section</span><p>Turn the two Worked Examples into your own session: build a one-page answer to “what is running, what state is it in, what is it saying”, then fossilise the session into a script.</p></div>

**Tier 1 — one page of truth (~45 min, emulator or Cuttlefish).** Reproduce Worked Example B against any AAOS target, saving the transcript: census lines for car services, `dumpsys welcome_light` equivalent for a service your target actually has (car's property service is fine), one upstream property read by integer (the fan), one injection, `logcat -b crash -d` tail. Checkpoint: your page answers "what is running, what state is it in, what is it saying" — Lecture 1's checkpoint, now from your own keyboard. Annotate each captured block with the lens it came from (present, confession, history, provocation): the annotation habit is what turns a transcript into evidence a second engineer can re-derive conclusions from, instead of a souvenir of your afternoon.

**Tier 2 — the welcome session, with weather (~1.5–2 h, Cuttlefish `kestrel_auto`).**
1. Run both Worked Examples end to end, saving outputs under the build fingerprint. Checkpoint: the transcript contains both `service list` lines, the injection pair, and the denied-then-allowed `service call` sequence with counters.
2. Introduce weather: `stop welcomed` mid-session and re-derive health from the panel alone (no restarting until your written bound names the layer); then `start welcomed` and prove recovery from `dumpsys`. Checkpoint: bound written *before* the restart.
3. Capture a boot: reboot and take `adb logcat -b all -d > boot-<fingerprint>.log` once `sys.boot_completed=1`, then find Lecture 4's stage markers in it. Checkpoint: three stage lines quoted with timestamps.
4. Fossilize: turn your steps 1–3 into a `morning.sh` in the shape of Worked Example B's script (fingerprint-first filenames), run it twice — once healthy, once with `welcomed` stopped — and `diff` the two panels. Checkpoint: the diff names the layer before you do, in writing: which lines changed, which pointedly did not (`service list` loses the HAL line; `welcome_light` remains and reports `hal=unavailable`), and what that pattern rules out.

**Tier 3 — your own card (30 min).** Take a feature you work on (or the companion app's) and write its one-page session card: the census greps, the confession command, the stimulus, the receipt counter, the recovery verb — the five moves of Worked Example B, translated. Checkpoint: a colleague could run your card cold and reach your conclusions; that is Lecture 12's behaviour test in prose, waiting to be automated.

*Verification status: envsetup functions and fastboot variables checked against `android-17.0.0_r1`; property integers and welcome-stack observables carried from Lectures 1/4/5/7/9/11's verified tables (see `docs/verification/lecture-03-source-truth.md`). Outputs are representative; the live session was not executed in the authoring environment — the tiers above are where it becomes real.*

<div class="section-recap"><span class="block-label">Now you can</span><p>Produce your own session page that answers what is running, what state it is in, and what it is saying — Lecture 1's checkpoint, from your keyboard.</p></div>

## Exercises
<div class="section-opener"><span class="block-label">In this section</span><p>Exercises in command-line judgement: place commands on the right machine, read a trap's tell, and explain a session to a colleague who only has the capture.</p></div>

1. `adb devices` shows `unauthorized`. What world are you in, and what are two fixes?
2. A bench engineer insists the new build is flashed. Give the two commands that settle it and what you expect to see.
3. Write the one-liner that counts how many Binder services a running AAOS system exposes, and state its one inaccuracy.
4. `repo status` shows changes in a project you never opened. Give two innocent explanations before assuming corruption.
5. `adb shell service call welcome_light 2 i32 1` returns a `SecurityException` parcel, yet your platform-signed app succeeds with the same request. Explain, naming the gate, the counter that confesses it, and why "the shell is root after `adb root`" also passes.
6. You typed `adb shell dumpsys welcome_light | grep state` and got host-side errors about `grep`. What actually executed where, and how do you aim the pipe at the device?

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. The `adb` world: Android is running but has not authorized this host's key. Fixes: accept the authorization prompt on the device, or delete the host keys / `adb kill-server` and reconnect so the prompt re-offers. `fastboot` thinking does not apply — the bootloader is not in this story.
2. `adb shell getprop ro.build.fingerprint` and `adb shell getprop ro.build.version.incremental` (or `ro.build.date.utc`); compare against the build output you produced. Agreement is proof; the engineer's memory is not. (This is Lecture 10's "fingerprint first" in embryo.)
3. `adb shell service list | wc -l`, minus one: the `Found N services:` header line inflates the count by exactly one. Precision about off-by-ones in census data is the exercise's real content.
4. Innocent causes: a `repo sync` updated that project past/around your local state (your "change" is divergence, not edits), or an earlier `repo start`/cherry-pick/upload left topic state in that project. Read `repo diff` and the project's `git log` before cleaning anything; `repo status` reports *difference*, and difference has authors other than you.
5. The gate is Lecture 5's framework permission (`CONTROL_WELCOME_LIGHT`, signature-level) enforced in the service: shell (even as a domain that found the service) doesn't hold it, so the call is refused *after* reaching the callee — confessed by `deniedCalls` in `dumpsys welcome_light`. Your app holds the permission via platform signing (Lecture 8). `adb root` passes because root's identity bypasses the app's permission model on userdebug — which is why root-success proves the plumbing, never the product behaviour; the denied shell call is the more faithful test of what a real caller experiences.
6. The pipe and `grep` ran on your workstation (your host shell interprets everything outside the quotes; adb received a bare `dumpsys` and printed to your terminal, where the *file* `welcome_light`... the precise mechanics vary, but the law doesn't: quote the device-side command — `adb shell "dumpsys welcome_light | grep state"` — when the pipeline is the device's, and leave it unquoted when the pipeline is yours (filtering a full dump on the host is often the better tool anyway, since the host has your editor and your disk).

</details>

<div class="section-recap"><span class="block-label">Now you can</span><p>Given a capture, reconstruct what ran where — and catch the command that ran on the wrong machine.</p></div>

## Go deeper: kernel and app pointers
<div class="section-opener"><span class="block-label">In this section</span><p>When <code>adb</code> cannot see the device at all, you are below Android: serial console, bootloader logs, and <code>dmesg</code> territory, in the kernel path's order.</p></div>

When `adb` cannot see the device at all, you are below Android: serial console, bootloader logs, and `dmesg` territory — the [kernel path]({{ '/kernel-path/' | relative_url }}) step 5 picks up there, and the fastboot corner above is the bridge. When the question becomes "what is this *app* doing," `dumpsys package`, activity commands, and the [app path]({{ '/app-path/' | relative_url }}) step 6 testing tools take over; Lecture 8's components are where you'll aim them.

<div class="callout"><p><strong>Working with AI agents:</strong> paste exact command output, never your summary of it. Agents read `dumpsys` dumps and `logcat` slices you supply with real skill, and they hallucinate device state with equal fluency when asked to remember instead. The working loop for this lecture's material: you run the command (you own the device), paste the capture, ask for suspects ranked by evidence plus the *next command* — then run that command yourself. An agent driving your shell sight-unseen is a `service call` with the wrong transaction code: confident, well-formed, and aimed at the wrong method.</p></div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Recognise the moment a problem leaves this lecture downward — and take the right pointer instead of retrying <code>adb</code>.</p></div>
