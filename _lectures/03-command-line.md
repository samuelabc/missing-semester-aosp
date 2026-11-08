---
number: 3
title: "The AOSP command-line environment"
subtitle: "adb, fastboot, repo, and the twenty commands that carry an OEM workday."
---

## Motivation

This is our shell lecture. MIT teaches shell fluency because every later skill rides on it; platform work is the same, one level up. `adb`, `fastboot`, `repo`, `logcat`, and `dumpsys` are not utilities around the job. On most days they are the job. Engineers who drive them fluently debug in minutes what others schedule meetings about.

## Mental model

Three tools, three different machines in front of you. `repo` manages the *source* (hundreds of Git projects as one). `adb` talks to a *running Android system* (over USB or TCP; your emulator and Cuttlefish included). `fastboot` talks to a *bootloader*, when Android is not running yet. Confusing which world you are in explains a large share of beginner errors: `adb` commands fail in fastboot mode because there is no Android to answer.

Everything else in this lecture is lenses onto the running system, reachable through `adb shell`: `logcat` (logs), `dumpsys` (service state), `cmd` (service commands), `getprop`/`setprop` (system properties), `service` (Binder service list), and `pm`/`am` (packages and activities).

## Walkthrough: the daily twenty

```bash
# repo: live in the manifest, not in 900 git repos
repo status                 # what have I changed, across projects?
repo diff                   # show it
repo sync -c -j8            # current branch only, parallel
repo start my-topic .       # topic branch in this project
repo upload                 # Gerrit upload (on AOSP-style workflows)

# adb: the running system
adb devices                 # who is attached, and in which mode?
adb root && adb remount     # userdebug: writable system for iteration
adb shell getprop ro.build.fingerprint   # what exactly is running?
adb shell service list | grep -i car
adb shell dumpsys car_service | head -n 80
adb logcat -b all -T '01-01 00:00:00.000' > boot.log   # capture a boot, Lecture 4/10
adb shell cmd car_service get-property-value 557847504  # ask CarService directly (IDs vary)

# fastboot: the bootloader (device-dependent; Cuttlefish uses its own launch flow)
adb reboot bootloader
fastboot devices
fastboot getvar all
```

Habits that separate fluent from frequent. Annotate captures at capture time (`adb logcat > bug-2314-repro.log` beats `log.txt` forever). Prefer `dumpsys` before `logcat` when a service is alive; state beats history. Use `adb shell getprop` dumps to settle "which build is this, really" arguments, including on benches where someone swears they flashed the new image. And learn `adb emu` / Cuttlefish console equivalents for your virtual targets, since your hands will live there more than on hardware.

For Cuttlefish specifically, the workflow is launch, then treat it like a device: `launch_cvd` with an automotive image, `adb connect` to its address, and the same `dumpsys`/`logcat` habits afterwards. The car does not care that the hardware is virtual, and for system work, mostly neither should you.

## Lab (tiered)

**Tier 1 (emulator, 45 min).** Boot AAOS, then produce a one-page "state of this car" report from the command line only: build fingerprint, car service list, current HVAC fan speed via `cmd car_service` or `dumpsys`, and the last 20 lines of `logcat` mentioning the car stack.

**Tier 2 (Cuttlefish, +30 min).** Repeat against Cuttlefish, diff the two reports, and explain every difference that is target, not user error.

<div class="checkpoint"><strong>Checkpoint:</strong> your report answers "what is running, what state is it in, what is it saying" without opening a GUI or asking anyone. That is the whole lecture in one page.</div>

## Exercises

1. `adb devices` shows `unauthorized`. What world are you in, and what are two fixes?
2. A bench engineer insists the new build is flashed. Give the two commands that settle it and what you expect to see.
3. Write the one-liner that counts how many Binder services a running AAOS system exposes.
4. `repo status` shows changes in a project you never opened. Give two innocent explanations before assuming corruption.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Android is running but has not authorized this host key: accept the on-screen prompt, or delete host keys and reconnect (`adb kill-server`).
2. `adb shell getprop ro.build.fingerprint` and `ro.build.version.incremental` (or `ro.build.date`); compare against the build you produced.
3. `adb shell service list | wc -l` (mind the header line).
4. A `repo sync` moved the project under your local edit elsewhere, or a previous `repo start`/cherry-pick on another manifest; check `repo diff` and `git log` before cleaning.

</details>

## Go deeper: kernel and app pointers

When `adb` cannot see the device at all, you are below Android: serial console and `dmesg` territory, [kernel path](/kernel-path/) step 5. When the question is "what is this app doing," `dumpsys package` and the [app path](/app-path/) step 6 testing tools take over.

<div class="callout"><p><strong>Working with AI agents:</strong> paste exact command output, not your summary of it. Agents are strong at reading <code>dumpsys</code> dumps you supply and weak at knowing your device state; make them reason from the capture in front of them, and re-run any command they "remember" before trusting it.</p></div>
