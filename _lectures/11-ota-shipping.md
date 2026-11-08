---
number: 11
title: "OTA, partitions, and shipping"
subtitle: "A/B updates, dynamic partitions, update_engine, signing, and the discipline of not bricking cars."
---

## Motivation

Development ends at "works on my bench." Shipping begins where a change must reach vehicles you will never touch, survive a power cut mid-update, and roll back if it cannot boot. OTA is where system customization becomes irrevocable, so it is taught last among the build topics and first in every post-mortem. This lecture covers the mechanism and the release discipline around it.

## Mental model

Modern AAOS uses **A/B (seamless) updates**. Partitions exist in two slots (A and B). The running system is one slot; `update_engine` writes the *other* slot in the background, marks it active, and the bootloader tries it on reboot. If the new slot fails to boot or fails post-boot health checks, the bootloader rolls back to the slot that worked. **Virtual A/B** compresses the inactive side with snapshotting (dm-snapshot/COW) to save space. **Dynamic partitions** put system/vendor/product and friends inside one super partition whose logical sizes can change between releases, which is freedom with bookkeeping attached.

Consequences an OEM engineer must internalize. `/system` and friends are read-only in operation (your Lecture 8 overlays and Lecture 2 product choices are baked at build). Data survives; your job includes migrations that respect that. Downgrade and rollback are designed behaviours with anti-rollback counters and verified-boot state (Lecture 9) in the loop, not hacks. And an OTA payload is a signed artifact: who signs, with which keys, verified against what, is a program-level decision made long before the release branch is cut.

## Walkthrough: from build to payload to applied update

```bash
# Build artifacts -> OTA package (release workflow, names per pinned baseline)
# dist builds produce target-files; ota tooling turns target-files into a payload:
#   ota_from_target_files  (in build tooling) -> payload.bin + properties, signed with release keys
# Inspect before you ever apply:
unzip -l <ota>.zip | head
# Apply on a virtual target / test bench through update_engine interfaces, e.g. via
# update_engine_client or the system Updater sample, then watch the state machine:
adb shell dumpsys update_engine
adb logcat -b all -d | grep -i update_engine | tail -n 40
adb shell getprop | grep -E "slot|boot"   # slot suffix & successful-boot markers (names vary by device)
```

Read an update like a reviewer: payload manifest (which partitions, deltas vs full), signatures and key lineage from the build that produced the *currently running* slot (an OTA signed for a different key set is a paperweight recipe), post-install hooks, and the space math for virtual A/B on your partition sizes. Then the release discipline: branch strategy (one release branch per program/model year, cherry-picks logged), build variants signed for release are `user` builds from a clean, reproducible tree (Lectures 2 and 9), target-files and symbols archived per release (Lecture 10 will demand them), and a rollback plan rehearsed on Cuttlefish/bench *before* the fleet sees the payload, including the ugly cases: power loss mid-apply, corrupted download, new slot boots but car services fail health checks.

Cars add one twist phones forgive: update timing is a vehicle decision. Garage mode, power state, and user consent (Lecture 7's CarService power world) gate when `update_engine` may run; an OTA that fights a low 12 V battery loses, and should.

## Lab (tiered)

**Tier 1 (reading/tree, 1 h).** Produce the partition-and-slot sheet for the reference target: partitions, A/B or virtual A/B, where `update_engine` configuration lives, and how rollback is triggered. Cite paths.

**Tier 2 (Cuttlefish/bench-class target, 3 h).** Build two module-differing images or use release-style artifacts as your environment allows, generate an OTA payload, apply it to the inactive slot, reboot, verify slot switch and fingerprint change (Lecture 3), then simulate failure (do not mark success / force a bad slot as tooling permits) and observe rollback.

*Verification status: flow and tooling doc-verified against the pinned baseline; the full build→payload→rollback cycle was not run in the authoring environment and is the course's heaviest lab. Budget it as a half day, not an evening.*

<div class="checkpoint"><strong>Checkpoint:</strong> you can narrate one update's life from signed payload to successful-boot mark, name the exact moment rollback was still possible, and state which keys signed it. Until then, do not ship one.</div>

## Exercises

1. A power cut hits mid-apply on a real car. Walk the next three boots.
2. Your OTA applies and boots, but CarService crash-loops. Does rollback save you? Distinguish boot success from system health in your answer.
3. Why must target-files and symbols be archived for every release, naming Lectures that will ask for them?
4. A supplier proposes disabling verified boot "to simplify field updates." Write the risk paragraph for the design review.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Inactive slot is partially written and never marked active (or fails verification/boot), bootloader keeps/returns to the known-good slot; the update restarts from a clean apply later. The running car never depended on the half-written side.
2. Not by itself: slot rollback triggers on boot failure criteria; a booting but unhealthy system needs post-boot health checks and program policy to mark unsuccessful, or the failure ships. Design the health signal deliberately.
3. Target-files regenerate/compare payloads and diagnose update failures; symbols symbolize release tombstones (Lecture 10). Both are un-reproducible later if the tree has moved.
4. Look for: unsigned/attacker or supplier-compromised payloads become installable, rollback protection weakens, and VTS/CTS plus customer security review consequences, i.e., the simplification trades a fleet-scale trust boundary for convenience.

</details>

## Go deeper: kernel and app pointers

Bootloader and kernel participate in slot selection and verified boot chains; the vendor's bootloader documentation plus [kernel path](/kernel-path/) step 1 frame what questions to ask. Updatable modules and app-layer updates (APEX, app updates outside OTA) are the complement; the [app path](/app-path/) explains why cabin apps increasingly ship without waiting for your system OTA, and what that split means for feature planning.

<div class="callout"><p><strong>Working with AI agents:</strong> let agents draft release checklists, payload inspections, and rollback test plans, where completeness is the value. Never let an agent's confidence substitute for the rehearsed rollback: the only trustworthy sentence in this lecture is "we watched it roll back." </p></div>
