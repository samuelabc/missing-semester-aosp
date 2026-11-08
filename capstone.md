---
layout: page
title: "Capstone: a vendor vehicle property, end to end"
subtitle: "One feature through every layer of the course: VHAL, CarService, your own service, SELinux, debugging, and tests."
permalink: /capstone/
---

## The brief

Add a fictional but realistic feature to AAOS: a **cabin welcome light**. When the driver door opens, an ambient light strip should show a welcome state for a few seconds. The vehicle side already knows the door state; Android does not have your light. You will create a **vendor vehicle property** carrying the welcome-light state, surface it through the property system, consume it in a small custom system service that owns the welcome logic, secure the whole path, debug it once on purpose, and test it at two layers.

No car is required. Cuttlefish and its default/emulated VHAL play the vehicle; the emulator tier covers everything except the HAL implementation step. Estimated effort: a day of focused work, or three evenings. Every step names the lecture that taught it, because that is the point: this is the previous twelve lectures with the training wheels off.

## Deliverables (all in a patch set or repo you can show)

1. **Property spec** (Lecture 7 lab, formalized): vendor-range property ID with justification, type, area model (per-zone if your design says so), access mode, change mode, default and error behaviour, and who may write it.
2. **VHAL support** (Lecture 6): the property implemented in the default/emulated VHAL path you are building against, discoverable through the property configuration query, with sane behaviour when set out of range.
3. **System consumption** (Lectures 5 and 7): a small system service that subscribes to the door/property state, owns the welcome-light decision (including timeout), exposes a narrow AIDL (`getWelcomeLightState`, `setWelcomeLightEnabled` or similar small verbs), and prints useful `dumpsys` output.
4. **Product integration** (Lectures 2 and 8): the service and any config shipped via your product definition and, if you show state in a system surface, an overlay rather than an edit. No copied binaries, no edited generated files.
5. **Security** (Lectures 5 and 9): permission enforcement in the service, service/file/property contexts, minimal SELinux policy with at least one dedicated type, zero new denials on an enforcing boot, and a one-paragraph threat note: who can fake a door event, and what stops them.
6. **Tests** (Lecture 12): one interface-level test (property contract, including a rejected out-of-range or unauthorized write) and one behaviour test through CarService, each runnable by one command, each shown to fail when you deliberately break the implementation.
7. **Field report** (Lectures 3, 4, and 10): a one-page write-up of the debugging session where you broke it (suggested: wrong area ID or missing policy) containing reproduction, stage/layer bound, root cause, and the capture that proved it.

## Suggested order of battle

Spec first, on paper (deliverable 1) → property visible from the HAL and `cmd car_service` tooling (2) → service reading it, logic stubbed (3) → product integration so a clean build contains it (4) → enforcing, policy written from collected denials (5) → tests, then break-and-fix (6) → write the field report while the pain is fresh (7). Resist wiring the UI early; a property you can drive from the shell is a property you can test.

## Rubric (self-grade honestly; each row pass/fix)

| Row | Pass looks like |
|---|---|
| Property design | Every attribute defended in one sentence; vendor range used correctly |
| Layering | Apps/services never touch the VHAL directly; CarService path respected |
| Build hygiene | Module builds only during development; change survives a clean product build |
| Security | Unauthorized caller rejected in code *and* denied/absent in policy; enforcing boot clean |
| Tests | Negative cases present; breaking the code breaks a test, demonstrably |
| Debugging evidence | Field report names stage, layer, and the proving capture |

## Stretch goals (optional)

Drive the property from a simulated door event on a timer and measure the event rate sanity (Lecture 10 Perfetto); add garage-mode/power awareness so the welcome logic respects suspend states (Lecture 7); generate a mini OTA between two capstone builds and verify the feature survives the slot switch (Lecture 11). Each is one paragraph in your report, tooling you already have.

Finishing this capstone means the course's promise has been kept at least once, by your own hands: you changed a vehicle system end to end, and you can prove every layer of it. Take that patch set into your next design review. It will hold up.
