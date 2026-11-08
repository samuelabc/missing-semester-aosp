---
number: 6
title: "Treble, HALs, and VINTF"
subtitle: "The vendor boundary: why your HAL is a contract, and how Android checks that you kept it."
---

## Motivation

Treble is the reason a modern AAOS system can update the framework without waiting for a silicon vendor, and the reason "it worked on the old build" can be a contract violation rather than a mystery. OEM engineers live on this boundary. If you understand HALs as versioned promises with a checker (VINTF) and a test suite (VTS, Lecture 12), the whole vendor side stops being folklore.

## Mental model

Split the world in two. The **system** side (framework, CarService) is Google/OEM-updatable. The **vendor** side (SoC code, drivers' userspace, HAL implementations) ships with the BSP. They may only meet through **stable interfaces** declared in `hardware/interfaces` (AIDL today; legacy HIDL still exists in older trees). A HAL is an implementation of one such interface, running in its own process, reached over Binder (Lecture 5's rules, with stricter stability).

**VINTF** is the manifest-and-matrix machinery that checks compatibility: the device manifest (`device manifest`, from vendor) declares which HAL versions it provides; the framework compatibility matrix declares what the system requires; they are compared at build time and at OTA/boot time (`libvintf`). When they disagree, the error is the system doing its job. Read it, do not suppress it.

The **Vehicle HAL (VHAL)** is the automotive instance you will touch most: it implements the automotive vehicle interface, translating vehicle signals (from CAN, a microcontroller, or emulation) into **vehicle properties** that CarService consumes. Lecture 7 lives upstairs from it; the capstone crosses this boundary deliberately.

## Walkthrough: read a HAL like a contract

```bash
# The contract
ls hardware/interfaces/automotive/vehicle/aidl/        # interface definitions (layout varies by release)
grep -rn "interface IVehicle" hardware/interfaces/automotive/vehicle/
# An implementation and its registration
grep -rn "IVehicle" hardware/interfaces/automotive/vehicle/aidl/default/ | head
# What the running device actually provides
adb shell lshal | grep -i vehicle          # legacy view; AIDL services also via service list
adb shell service list | grep -i vehicle
adb shell dumpsys android.hardware.automotive.vehicle.IVehicle/default  # if exposed
```

Follow one property's paperwork: interface property definitions and types (values, access modes, change modes), the default/emulated implementation's behaviour (this is what your Cuttlefish uses, and why emulation is a legitimate development target), the VINTF manifest entry declaring the HAL, and the.rc/`vintf` fragments that install it. Then the failure modes become legible: interface changed without version discipline (system and vendor now disagree), manifest not updated (VINTF complains), implementation registered under the wrong instance name (clients find nothing, `service list` tells the truth).

Adding a HAL follows the capstone's longer path: extend or define the interface (vendor properties often ride the vendor extension area rather than editing upstream interfaces; Lecture 7 explains property IDs), implement against it, declare in manifest and build, write policy (Lecture 9), test like VTS will (Lecture 12).

<div class="callout"><p><strong>HIDL is legacy, not dead knowledge:</strong> older vehicle programs still carry HIDL HALs (<code>.hal</code> files, <code>lshal</code>). Learn to read them, write new work in AIDL, and never let a translation between the two be described as "just a wrapper" in a design review.</p></div>

## Lab (tiered)

**Tier 1 (emulator/tree, 1 h).** In the source tree, produce the contract sheet for the vehicle HAL: interface package and version, instance name, manifest location, default implementation path, and the property types header. No build.

**Tier 2 (Cuttlefish, 2 h).** On a running target, enumerate automotive HAL services, read one property through the VHAL-facing tooling your target exposes, then deliberately query a nonexistent property and explain the error path from CarService down.

<div class="checkpoint"><strong>Checkpoint:</strong> you can answer, with paths: what the contract is, who implements it here, how the system learned the implementation exists (manifest/registration), and what would break at OTA if the vendor bumped the implementation without the interface.</div>

## Exercises

1. VINTF fails after a vendor drop. State the two files you compare first and what a version mismatch on each side means.
2. A HAL method exists in the implementation but clients cannot see it. List causes from interface to policy, in order.
3. Why does Treble forbid the framework from linking directly against a vendor library? Answer in terms of update schedules.
4. Your VHAL supports a property in the emulator but not the bench. Where do you look first, and what evidence separates "not implemented" from "implemented but failing"?

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Device manifest (what vendor declares it provides) vs framework compatibility matrix (what system requires); a too-old provided version fails the requirement, a missing HAL fails presence.
2. Interface version/snapshot not rebuilt, instance name mismatch, manifest entry absent, service not registered (check `service list`), SELinux denying find/call.
3. Their binaries would couple two independently updated partitions; a framework OTA could then break vendor code it cannot rebuild, which is exactly the pre-Treble failure Treble exists to remove.
4. The default/emulated VHAL implementation vs the vendor's; property support lists (`getPropConfigs` through CarService/`cmd car_service`) separate unsupported from supported-but-erroring, whose logs then show the failing call.

</details>

## Go deeper: kernel and app pointers

Below the HAL sits the driver it talks to (serial, CAN, virtualized VirtIO in SDV architectures); [kernel path](/kernel-path/) steps 3–4 are the reading order, and multi-VM AAOS (hypervisor, VirtIO) is the vendor architecture topic to ask your BSP team about armed with Lecture 6's contract questions. Apps must never see this layer directly; if a feature request implies they should, Lecture 7's CarProperty path is the answer.

<div class="callout"><p><strong>Working with AI agents:</strong> have the agent build the contract sheet (files, versions, instance names) with citations, then verify each path by opening it. Interface/version questions are where agents blend HIDL and AIDL eras most fluently; the manifest on disk is the referee.</p></div>
