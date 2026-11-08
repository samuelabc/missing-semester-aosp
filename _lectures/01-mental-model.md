---
number: 1
title: "The AOSP mental model and source anatomy"
subtitle: "What Android Automotive actually is, where the code lives, and how to read a tree you will never finish reading."
---

## Motivation

New OEM engineers lose their first month to disorientation, not difficulty. The tree is over 200 GB with source and history. Builds have their own language. Half the directories look identical and only one of them is the one your product uses. People say "just look in frameworks" as if that narrows anything down.

The fix is a map plus one habit. The map fits on this page. The habit is: never guess where something lives when code search can tell you in seconds.

## Mental model

Think of AAOS as four layers you will touch, in very different amounts:

| Layer | What it is | Where it lives | How often you change it |
|---|---|---|---|
| Vehicle & kernel | SoC, drivers, device tree (mostly vendor-owned) | `kernel/`, vendor repos | Rarely; through interfaces |
| HAL / vendor | Treble HALs, Vehicle HAL, board config | `hardware/`, `device/`, vendor `vendor/` | Often on a program |
| Framework & system services | `system_server`, CarService, platform services | `frameworks/`, `packages/services/Car/` | Weekly |
| Product & apps layer | Your product config, overlays, system apps | `device/<vendor>/<product>/`, `packages/apps/Car/` | Daily |

Upstream AOSP is the reference implementation of the middle two layers and the rules binding all four: Treble interfaces, VINTF, CDD, CTS/VTS. Your BSP is a delta against upstream. Your product is a further delta against the BSP. Most debugging is establishing which delta introduced the behaviour you are staring at.

Three sentences that will carry you far. Android is not one program; it is hundreds of processes that mostly meet over Binder. Almost everything configurable is decided at build time by makefiles and Soong modules, then refined at runtime by overlays and properties. And the tree is the documentation of last resort: when docs and behaviour disagree, the tree (plus a log) wins.

## Walkthrough: anatomy of a synced tree

Get the pinned tree ([Setup]({{ '/setup/' | relative_url }}) has the exact commands), then orient:

```bash
repo init -u https://android.googlesource.com/platform/manifest -b android-latest-release
repo sync -c -j8
ls   # art bionic bootable build cts device external frameworks hardware kernel
     # libcore packages pdk prebuilts system test tools vendor (appears after vendor sync)
```

Directories worth memorizing on day one: `build/make` and `build/soong` (the build system, Lecture 2), `frameworks/base` (framework and `system_server` services), `frameworks/native` (surfaceflinger, binder userspace), `system/core` (`init`, `logcat`, toolbox), `hardware/interfaces` (Treble AIDL/HIDL interface definitions), `packages/services/Car` (CarService and AAOS platform services), `packages/apps/Car` (car system apps), `device/google/cuttlefish` (your reference target), and `cts`/`test/vts` (the tests of Lecture 12).

Now the habit. Use [cs.android.com](https://cs.android.com/) or a local index rather than wandering:

```bash
# Who defines the car power service?
grep -rn "class CarPowerManagementService" packages/services/Car/service/src --include=*.java
# Which files reference a vehicle property end to end?
grep -rn "VehiclePropertyIds.HVAC_FAN_SPEED" packages/services/Car hardware/interfaces/automotive/vehicle
```

Cross-referencing beats directory intuition at this scale. Learn your editor's "find references" and `grep`/`rg` fluency here; it compounds for your whole career, the same argument MIT makes for the shell.

Reading a manifest is the other orientation skill. `.repo/manifests/default.xml` lists every project, its path, and its revision. When a vendor says "our drop is based on the Q2 release," the manifest plus `repo manifest -r` (pinned revisions) is how you verify that claim instead of nodding.

## Lab (tiered)

**Tier 1 (emulator, 30 min).** Boot an AAOS emulator. Run `adb shell service list` and find three car services. Run `adb shell dumpsys car_service` (or the specific service) and read the first screen. You are connecting Lecture names to running processes.

**Tier 2 (Cuttlefish tree, 1–2 h).** In a synced tree: run `repo list | wc -l` (count the projects), open the manifest entry for `platform/packages/services/Car`, and trace one feature vertically: pick HVAC fan speed and list every file that mentions it from `hardware/interfaces/automotive/vehicle` up through CarService. Write the chain down; you will rebuild it in the capstone.

<div class="checkpoint"><strong>Checkpoint:</strong> you can state, for HVAC fan speed, the HAL interface file, the CarService class that consumes it, and the app-facing API class, without searching again. That vertical slice is the map.</div>

## Exercises

1. Find where `SystemServer` starts CarService. Name the file and the flag that can disable it.
2. Explain, in three sentences to an imaginary new hire, the difference between `frameworks/base` and `packages/services/Car`.
3. Using `repo forall -c 'git log --oneline -1'`, pick three projects and state what each contributes to an AAOS build.
4. Find one place where this lecture's claims can be checked in the tree (a path named above). Report one confirmed and, if you find it, one path that differs in your tree with the reason.

<details class="solution" markdown="1"><summary>Show hints</summary>

1. `frameworks/base/services/java/com/android/server/SystemServer.java`; look for the car service start guarded by a system property/package check.
2. Framework is the generic Android platform used by phones too; `packages/services/Car` is automotive-specific platform code layered on it.
4. Path drift between releases is expected; record the tag you synced, that difference is data, not failure.

</details>

## Go deeper: kernel and app pointers

Kernel side: everything under `kernel/` is interface territory for now; the [kernel path]({{ '/kernel-path/' | relative_url }}) starts with how GKI changes what "customizing the kernel" even means. App side: notice `packages/apps/Car` exists but resist reading it as "apps"; these are system components, and Lecture 8 treats them that way. The [app path]({{ '/app-path/' | relative_url }}) orders the rest.

<div class="callout"><p><strong>Working with AI agents on this lecture's material:</strong> agents are good at the habit, bad at the map. Ask one to find every file referencing a property or service (that is search, verify with <code>grep</code>), but make it cite paths you then open. If it cannot show you the file, it did not find anything; it guessed in a confident font.</p></div>
