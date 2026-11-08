---
layout: page
title: Setup & prerequisites
subtitle: What you need to know, what you need to own, and how to check both before Lecture 1.
permalink: /setup/
---

## Prerequisites (assumed, not taught)

- **Linux shell:** navigate, edit, grep a tree, read a man page. If `find`, `grep -r`, and shell pipes are new, spend a weekend with MIT's [shell lecture](https://missing.csail.mit.edu/) first. This course starts where that one ends.
- **Git:** clone, branch, diff, log. `repo` (Lecture 3) layers on top of Git; it does not replace it.
- **Reading code:** follow C++ and Java/Kotlin you did not write, across files, with a code search tool. You will read far more AOSP code than you write.
- **Basic Android vocabulary:** package, process, permission, intent. App development experience is not required.

Quick self-check. If you can explain what a process is, find every caller of a function in a large tree, and cherry-pick a commit, you are ready. If two of three are shaky, the first two lectures will still work, just slower.

## The pinned baseline

All commands, paths, and code in this course target **Android 17 / AAOS 26Q2, API 37**, manifest branch `android-latest-release` resolved to the `android17-release` line, tag `android-17.0.0_r1` at writing. Get the source the way Lecture 1 describes:

```bash
repo init -u https://android.googlesource.com/platform/manifest \
  -b android-latest-release
repo sync -c -j8
```

Pin the manifest to the tag for reproducibility once your tree is synced (`repo manifest -r`). When the course pin moves, the changelog on the [resources page](/resources/) will list lecture-by-lecture changes rather than silently rewriting them.

## Machines, by tier

Labs are tiered so your hardware decides the tier, not whether you can participate.

| Tier | What runs | Machine you need |
|---|---|---|
| 1 · Emulator | AAOS emulator images, `adb`, `dumpsys`, car service exploration, most of Lectures 3, 7, 8, 10 | Any recent laptop, 16 GB RAM, Android Studio with the Automotive system images |
| 2 · Cuttlefish (reference) | Full AOSP/AAOS builds, custom services and HALs, SELinux, OTA | Linux x86_64 workstation or cloud VM: 32 GB RAM minimum for module work (64 GB is calmer), 300 GB free disk, 16+ cores if you value your evenings |
| 3 · Bench (optional) | Real head unit or reference board notes at the end of some labs | Whatever your program uses; never required to complete a lab |

Two honest warnings. First, building on macOS or Windows is not a supported AOSP workflow; use a Linux VM or a cloud instance (Lecture 2 covers sizing one). Second, the first full build is slow on any machine. The course is designed so you do it rarely and lean on module builds (`m`, `mm`, `mma`, Lecture 2) the rest of the time.

## Verify your setup

```bash
# Tier 1: emulator path
adb version && adb devices        # emulator-5554 (or similar) should appear after boot

# Tier 2: inside a synced AOSP tree
source build/envsetup.sh
lunch aosp_cf_x86_64_auto-ap4a-userdebug   # Cuttlefish AAOS target; name is baseline-checked in Lecture 2
m nothing                         # cheap smoke test that the build system is alive
```

<div class="checkpoint"><strong>Checkpoint:</strong> you can boot an AAOS emulator and open a car settings screen, or run <code>m nothing</code> in a synced tree without an error. Either one is enough to start Lecture 1. Both unlock every lab.</div>

Stuck before you start is the most common failure mode of self-taught AOSP. If `repo sync` or the build fails, Lecture 2's debugging section is written for exactly that state; read it out of order without guilt.
