---
number: 7
title: "AAOS: CarService, the Vehicle HAL, and vehicle properties"
subtitle: "The automotive stack itself: how a vehicle signal becomes an API, and where OEMs are supposed to customize."
---

## Motivation

This is the lecture the course exists for. Everything before it is Android; this is where Android becomes a car. Most AAOS customization requests that reach an OEM engineer reduce to one pattern: a vehicle signal must reach Android software, or Android must command the vehicle. Vehicle properties over the VHAL, mediated by CarService, are that pattern's official shape. Learn it once, properly, and half your program's tickets become recognizable.

## Mental model

One signal's biography:

**Vehicle bus / MCU → VHAL (translates raw signal ↔ vehicle property) → CarService (`VehicleHal` / property managers) → `CarPropertyManager` API → car system apps and services. Reverse path for commands, with CarService enforcing who may write what.**

A **vehicle property** is a typed value identified by a property ID, with an area (global or per-zone: seat, door, window), access mode (read, write, read-write), and change mode (static, on-change, continuous). Standard properties are defined upstream (`VehiclePropertyIds` mirrors the HAL definitions); OEM-specific signals belong in the **vendor property range**, which is the sanctioned extension point and the capstone's home.

**CarService** (`packages/services/Car`) is the automotive system service: it hosts the property service plus power, user, audio, projection, and other car managers, each behind a `Car*Manager` facade (Lecture 5's pattern at platform scale). Customization is expected at defined seams: vendor properties, OEM overlays and config (Lecture 8), car feature flags, and your own services consuming properties. Editing CarService internals is possible (you have the source) and should be your last resort, because every upstream release then becomes a merge you own.

Power and users are automotive, not phone-shaped: AAOS power states (on, suspend-to-RAM "strim", garage mode for updates), multi-user with driver/passenger separation, and driving-state UX restrictions all flow through CarService policies. You do not need all of it this week; you need to know it exists before designing a feature that assumes a phone.

## Walkthrough: follow and drive a property

```bash
# What does this car expose?
adb shell cmd car_service get-property-value 557847504 0   # example ID; discover IDs below
adb shell dumpsys car_service | grep -A2 -i "HVAC_FAN_SPEED"
# In tree: standard property definitions and their HAL source of truth
grep -rn "HVAC_FAN_SPEED" hardware/interfaces/automotive/vehicle/ packages/services/Car/ | head -n 30
```

Read the chain for one standard property (HVAC fan speed is well-trodden): HAL definition and default value handling, CarService's subscription and caching, the `CarPropertyManager` method an app calls, and the permission guarding writes. Then drive it: set the property through the tooling your target provides (emulator car controls, `cmd car_service`, or the default VHAL's test hooks), and watch the change event propagate in `logcat`/`dumpsys`. Continuous properties (speed) behave differently under load than on-change ones (gear); subscribe to both and compare event rates, because mis-chosen change modes are a real source of "the UI is janky and the logs are on fire" bugs.

Vendor properties, the OEM move: choose an ID in the vendor range with the right type/area/access/change attributes, declare it at the HAL layer (Lecture 6's contract discipline), let CarService treat it as data (standard properties get bespoke APIs; vendor properties flow through the generic property APIs by design), enforce permissions for writes, and you have extended the car without forking the platform. The capstone does exactly this, all the way.

## Lab (tiered)

**Tier 1 (emulator, 1–2 h).** Using emulator car controls or shell tooling, read three standard properties (one static, one on-change, one continuous), change HVAC fan speed, and record: property ID, area handling, permission required, and where you saw the event land.

**Tier 2 (Cuttlefish + tree, 2–3 h).** In the tree, spec (do not yet build) a vendor property for a fictional cabin welcome-light state: ID choice and justification, type, area, access/change modes, VHAL behaviour, consuming service sketch, write permission. This spec is the capstone's first deliverable; keep it.

<div class="checkpoint"><strong>Checkpoint:</strong> you can narrate a property's full round trip and defend a vendor property spec line by line. If any line is "because the example did," redo that line.</div>

## Exercises

1. A feature needs vehicle speed at 10 Hz for a cluster display. Choose change mode and justify; state the cost of choosing wrong.
2. An app team asks for direct VHAL access "for performance." Write the three-sentence refusal that offers the supported path.
3. Your vendor property write succeeds from `adb shell` but is rejected from a system app. Where is the difference decided?
4. Pick a standard property and identify which of its attributes (type/area/access/change) you could not change without breaking other consumers. Explain one.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Continuous with a sane sample rate; on-change floods or starves depending on HAL behaviour, and the wrong rate becomes Binder/CPU load visible in Lecture 10 tooling.
2. Apps consume properties through CarService/`CarPropertyManager`; VHAL access bypasses permissioning, lifecycle, and Treble contracts. The supported path costs a property definition, not a boundary violation.
3. Permission enforcement: shell's privileges vs the app's declared/granted car permissions, enforced in CarService (cross-check Lecture 9 for the SELinux layer beneath it).
4. Any is possible; the strong answers name a consumer (a settings screen, a safety restriction, a test) rather than answering abstractly.

</details>

## Go deeper: kernel and app pointers

Below the VHAL, signals arrive via kernel drivers and vehicle networks; [kernel path](/kernel-path/) step 4 names the subsystems. Above CarService, cabin features consume the APIs you now understand; [app path](/app-path/) step 3 (Car API from the consumer side) plus building one tiny car app against the emulator will make your service design measurably better.

<div class="callout"><p><strong>Working with AI agents:</strong> ask an agent to trace a named property through <em>your</em> tree and produce the file chain for you to verify, link by link. Property IDs and vendor-range rules are exactly the sort of detail agents state confidently and wrongly; the headers in <code>hardware/interfaces</code> settle it in one <code>grep</code>.</p></div>
