---
number: 4
title: "Boot and init"
subtitle: "From bootloader to SystemServer, and how to debug a car that will not finish booting."
---

## Motivation

Boot failures are where system engineers earn their keep and where beginners lose days, because the failing thing is often not the thing that prints last. A head unit stuck on a logo can be a kernel problem, an `init` problem, a service crash-looping, or a display stack that never says ready. This lecture gives you the sequence, the logs at each stage, and a triage order.

## Mental model

Boot is a relay, and each runner can drop the baton:

**Bootloader → kernel → `init` (PID 1) → Zygote → `SystemServer` → system services (incl. CarService) → boot completed (` sys.boot_completed=1`, `BOOT_COMPLETED` broadcast) → launcher/SystemUI.**

`init` is an Android program with its own language: `init.rc` and imported `.rc` files declare services (`service name /path/to/binary`, classes, users, capabilities) and triggers (`on boot`, `on property:sys.boot_completed=1`). Properties are the signalling system: services set them, `init` and others react. Zygote forks app processes (and hosts `system_server`'s start). By the time you see a boot animation, the kernel and `init` have mostly succeeded and the framework relay is running.

Two consequences for debugging. First, find the stage before reading logs from the wrong stage. Second, properties are a timeline: `dev.bootcomplete`, service states (`init.svc.<name>`), and crash counters tell you how far the relay got, even with no display.

## Walkthrough: triage in order

```bash
adb shell getprop sys.boot_completed          # 1 = framework says done
adb shell getprop | grep -E "init.svc.(zygote|system_server)"  # (service names vary)
adb shell logcat -b all -d | grep -iE "boot_progress|SystemServerTiming" | head
# Crash-looping service?
adb shell ls /data/tombstones/ ; adb shell logcat -b crash -d | tail -n 60
```

If `adb` never arrives, drop a stage: serial console/`dmesg` for kernel, `init` logs in the kernel log and early `logcat`, and check the usual OEM culprits in order: wrong image or partition flashed (Lecture 2's fingerprint check, applied to the bench), a vendor service crash-looping on a missing HAL or permission (Lectures 6 and 9), a sepolicy denial killing a service (Lecture 9's `avc:` lines), or a slow storage/display path that is not dead, just slower than your patience. Set `adb logcat -b all` capturing *before* reboot whenever the device allows it; boot bugs hate being recorded and often only confess on the third boot.

Adding an `init` service is the lecture's constructive skill:

```rc
# device/<vendor>/<product>/init.<product>.rc (illustrative)
service vendor-demo /vendor/bin/vendor_demo
    class hal
    user system
    group system
    oneshot
```

Wire it from the product (install the binary, copy or generate the `.rc` via `PRODUCT_PACKAGES`/module install rules rather than hand-copying where a module type exists), then read Lecture 9 before shipping: a new service without policy is a boot failure you scheduled.

## Lab (tiered)

**Tier 1 (emulator, 1 h).** Boot AAOS capturing `logcat -b all`, and reconstruct the relay from logs alone: mark timestamps for kernel end, Zygote, `SystemServer` ready, boot completed. Report the single slowest gap and your evidence.

**Tier 2 (Cuttlefish, 2 h).** Add a harmless native daemon via an `.rc` service that logs a line at `class late_start`, build the module, and prove from logs and `init.svc.*` that it ran once, as the right user.

<div class="checkpoint"><strong>Checkpoint:</strong> given only a boot log capture, you can name the stage where boot stalled and the next command you would run. Stage-first, logs-second.</div>

## Exercises

1. Boot completed is never set, but SystemUI appears. Name two suspects and the property you check for each.
2. Your new service shows `init.svc.demo` cycling between `running` and `restarting`. Give the triage order.
3. Why is editing a service's binary in place on a running `user` build the wrong debug strategy? What build variant and commands does Lecture 2/3 suggest instead?
4. Write the `.rc` stanza for a service that must start only after boot completes, and name the risk of that choice for a vehicle function.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. A service blocking the boot-completed path (check its `dumpsys`/logs) or a property trigger never satisfied (inspect the trigger conditions and the properties they wait on with `getprop`).
2. Read its crash log first (`logcat -b crash`, tombstones), then `avc:` denials, then missing libraries/HAL dependencies in the main log, in that order.
3. `user` builds block `adb root`/remount iteration; use `userdebug`, module build, push/sync, restart the service.
4. Trigger `on property:sys.boot_completed=1`; risk: the function is unavailable during early drive-away moments when the vehicle may already need it, the classic IVI boot-time tension.

</details>

## Go deeper: kernel and app pointers

If the relay fails before `init`, you are in kernel/DT territory: [kernel path](/kernel-path/) steps 1, 3, and 5. If boot completes but the cabin experience is wrong, you have left this lecture: launcher and SystemUI behaviour live in Lecture 8 and the [app path](/app-path/) step 4.

<div class="callout"><p><strong>Working with AI agents:</strong> give the agent a <em>stage-bounded</em> log slice, not 200k lines. "Boot stalls after this timestamp; what stage is this and what sets the next property?" gets reasoning. Dumping the whole log gets a summary of the log.</p></div>
