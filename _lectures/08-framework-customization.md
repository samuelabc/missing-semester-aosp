---
number: 8
title: "Framework customization"
subtitle: "Overlays, configuration, and privileged system components: changing Android's behaviour the way Android expects."
---

## Motivation

Every OEM must make Android theirs: brand, vehicle behaviour, regional rules, hardware quirks. There are two ways to do it. Edit framework code in place and own a fork forever, or use the customization mechanisms Android provides (resource overlays, config, product selection) and let upgrades stay boring. Programs bleed money on the first way for years. This lecture teaches the second, and how to recognize when someone proposes the first in disguise.

## Mental model

Customization has a preference order, cheapest-maintenance first:

1. **Configuration values** — `config.xml` booleans/integers/strings the framework already reads (feature presence, defaults, timeouts).
2. **Runtime resource overlays (RROs)** — a package that replaces resources (strings, layouts, colors, config values) in a target package at runtime, declared with a manifest and a priority, enabled per product.
3. **Product/static overlays** — `DEVICE_PACKAGE_OVERLAYS` / `PRODUCT_PACKAGE_OVERLAYS` directories whose resources replace the base at build time.
4. **New system components** — your own privileged app or service (Lectures 5–7) consuming platform APIs.
5. **Framework edits** — sometimes unavoidable; then they are small, isolated, upstreamable where possible, and written down as program debt.

The discipline: an overlay changes *what the code reads*; it never changes *what the code does*. The moment a customization needs behaviour, it graduates to a component or a deliberate framework patch, and pretending otherwise with resource tricks produces the fragile products you have already debugged at least once.

## Walkthrough

Anatomy of an RRO (paths from the car stack, where overlays are everywhere):

```bash
# Find overlays already targeting a package in your tree
grep -rln "overlay" packages/apps/Car/ --include=AndroidManifest.xml | head
grep -rn "android:targetPackage" packages/apps/Car/SystemUI/ | head
# What is actually applied on the running system?
adb shell cmd overlay list
adb shell cmd overlay dump com.vendor.car.overlay  # substitute your overlay package
```

Change one visible string or config in a car system component via overlay: locate the base resource (`res/values`), write the overlay resource with the identical name, set target package and priority, add the overlay package to your product (Lecture 2), state whether it must be enabled by default (`PRODUCT_ENFORCEABLE_RRO_TARGETS`, static vs runtime choice matters for signing and updatability), rebuild the overlay only, and verify with `cmd overlay` plus eyes on the UI. Then check the failure mode everyone meets: two overlays, same resource, priority fight. `cmd overlay dump` shows the winner; product config decides who should win, and the fix belongs there, not in a third overlay.

Privileged system components complete the picture. A system app that needs platform permissions must be privileged (installed in a priv-app partition), allowlisted for the privileged permissions it uses, and signed appropriately (Lecture 9 enforces all of this; a missing allowlist entry is a boot-time or install-time failure with a specific log line you should learn to recognize). Customization at this layer is integration work: manifest, allowlist, overlay, product entry, as one change.

## Lab (tiered)

**Tier 1 (emulator, 1 h).** Use `cmd overlay` to inventory overlays on the running AAOS system; pick one and trace it to its source package and target resource in the tree.

**Tier 2 (Cuttlefish, 2–3 h).** Ship one overlay change end to end (a settings string or a config flag) via your product, and prove priority behaviour by introducing a deliberate conflict and resolving it in product config.

<div class="checkpoint"><strong>Checkpoint:</strong> your change survives a rebuild, <code>cmd overlay dump</code> explains it, and you can state which preference-order level you used and why the level below it was wrong.</div>

## Exercises

1. A supplier delivers a customization as a patch to `frameworks/base` that changes one timeout. Rewrite the request using preference-order levels 1–2.
2. Your overlay builds and installs but nothing changes. Give the checklist in order (target, resource name, priority, enabled state, product inclusion).
3. When is a static overlay the right choice over an RRO, in an automotive shipping context?
4. A privileged app crashes at boot with a permission complaint after you added a permission to its manifest. Name the missing artifact (Lecture 9 will grade your answer).

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. If the timeout is a `config` value, an overlay of that config; the patch is rejected unless behaviour (not value) must change, in which case it is a justified, documented framework edit.
2. Wrong `targetPackage`, resource name/type mismatch, another overlay winning on priority, overlay not enabled, package not in the product that was actually built/flashed.
3. When the customization is inseparable from the build/brand of a non-updatable component and must be present from first boot with no enable step; the cost is losing runtime updatability.
4. The privileged-permission allowlist XML entry for that app (and the correct partition placement, Lecture 9).

</details>

## Go deeper: kernel and app pointers

Overlays reach into app resources, so the resource system itself is app-layer knowledge worth one evening: the [app resources documentation](https://developer.android.com/guide/topics/resources/providing-resources) from the platform side. Nothing in this lecture needs the kernel; if a "customization" proposes a driver change to alter UI behaviour, that smell is the [kernel path](/kernel-path/)'s rule of thumb in reverse.

<div class="callout"><p><strong>Working with AI agents:</strong> agents love generating overlay XML. Constrain them to your tree: "find the base resource for X and produce the overlay with the identical name" is verifiable in one <code>grep</code>. Generated resource names that do not exist in the base package fail silently, which is the worst kind of fail.</p></div>
