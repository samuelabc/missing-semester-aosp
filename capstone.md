---
layout: page
title: "Capstone: a vendor vehicle property, end to end"
subtitle: "Assemble the welcome-light stack from the twelve lectures' artifacts — and prove every layer of it."
permalink: /capstone/
---

<div class="lecture-map"><span class="block-label">Capstone map</span><h2>The capstone on one screen</h2><div class="lecture-map-grid"><div><h3>Assemble</h3><ul><li><a href="#the-brief">The brief</a> — one feature, no scaffolding</li><li><a href="#what-done-assembles-the-artifact-map">The artifact map</a> — twenty rows, checked by path</li></ul></div><div><h3>Deliver</h3><ul><li><a href="#deliverables">Deliverables</a> — seven, each with acceptance evidence</li><li><a href="#suggested-order-of-battle">Order of battle</a> — the build order that works</li></ul></div><div><h3>Prove</h3><ul><li><a href="#submission-shape">Submission shape</a> — patch set plus report</li><li><a href="#stretch-goals-optional">Stretch goals</a> — optional, after done is done</li></ul></div></div></div>

## The brief

Across the twelve lectures you built one feature in pieces: a **cabin welcome light**. When the driver door opens, an ambient light shows a welcome state; when the door closes, it goes dark. Each lecture produced its layer as an exercise — a product that builds, a daemon that boots, a frozen contract, a vehicle property, a gatekeeper service, an app, a policy, a debug session, an update, a test suite. The capstone removes the scaffolding: **assemble those artifacts into one coherent patch set against `device/acme/kestrel`, add one variation of your own, and prove the whole stack end to end.**

No car is required. Cuttlefish and its emulated VHAL play the vehicle; the emulator tier covers everything except the HAL implementation step. Estimated effort: a day of focused work, or three evenings. If you did the lectures' labs, most files already exist in your tree — the capstone's work is integration, the variation, and the proof. If you are arriving fresh, the artifact checklists below are your build order; every item names the lecture that teaches it.

## What "done" assembles: the artifact map

Your submission is a patch set (or repo) plus a short report. The patch set must contain, at these paths, the artifacts the lectures produced:

| # | Artifact (path) | Lecture |
|---|---|---|
| 1 | `device/acme/kestrel/AndroidProducts.mk` — registers `kestrel_auto` | 2 |
| 2 | `device/acme/kestrel/kestrel_auto.mk` — product definition; `PRODUCT_PACKAGES` carries every module below | 2 |
| 3 | `device/acme/kestrel/BoardConfig.mk` — board facts incl. `BOARD_VENDOR_SEPOLICY_DIRS` wiring | 2, 9 |
| 4 | `device/acme/kestrel/welcomed/Android.bp` + daemon sources — `/vendor/bin/welcomed` | 9 (annex), 2 |
| 5 | `device/acme/kestrel/welcomed/welcomed.rc` — `class hal`, interface stanza, data-dir creation | 4 |
| 6 | `device/acme/kestrel/welcomed/aidl/vendor/acme/hardware/welcome/IWelcomeLight.aidl` — the contract, frozen | 6 |
| 7 | `device/acme/kestrel/welcomed/aidl_api/vendor.acme.hardware.welcome/1/` (+ `.hash`) — the v1 snapshot | 6 |
| 8 | `device/acme/kestrel/welcomed/vendor.acme.hardware.welcome.xml` — VINTF manifest fragment declaring v1 | 6 |
| 9 | `frameworks/base/core/java/com/acme/welcome/IWelcomeLightService.aidl` — the service's narrow surface | 5 |
| 10 | `frameworks/base/services/core/java/com/android/server/welcome/WelcomeLightService.java` — gatekeeper: permission checks, counters, `dump()` | 5 |
| 11 | Permission declaration in `frameworks/base/core/res/AndroidManifest.xml` (`CONTROL_WELCOME_LIGHT`) + the `welcome_light` line in `system/sepolicy/private/service_contexts` | 5 |
| 12 | Door property registration for `ACME_DOOR_STATE` (`0x26200C10`) with its `VehiclePropConfig` (READ / ON_CHANGE, front-door areas), in the emulated VHAL's property set on the reference target | 7 |
| 13 | `WelcomeLightController` (car process, `packages/services/Car`) — door events in, light decisions out | 7 |
| 14 | `device/acme/kestrel/apps/welcome/` (`Android.bp`, `AndroidManifest.xml`; module `AcmeWelcome`, package `com.acme.welcome`) + `privapp-permissions-kestrel.xml` | 8 |
| 15 | `device/acme/kestrel/overlay/kestrel-welcome/` (module `KestrelWelcomeOverlay`) + `device/acme/kestrel/overlay/config/config.xml` enabling it | 8 |
| 16 | `device/acme/kestrel/sepolicy/vendor/` — `welcomed.te`, `service.te`, `property.te`, `file_contexts`, `service_contexts`, `property_contexts`, `genfs_contexts`, `seapp_contexts`, `mac_permissions.xml`, `keystore2_key_contexts`, `keys.conf` | 9 |
| 17 | `device/acme/kestrel/welcomed/vts/functional/` (`VtsHalWelcomeLightTargetTest.cpp`, `Android.bp`, `AndroidTest.xml`) + `device/acme/kestrel/sepolicy/vendor/vts_welcome_test.te` (test-only) | 12 |
| 18 | `device/acme/kestrel/tests/car/` — the behaviour test (door → light, denied caller) | 12 |
| 19 | Slot sheet beside `BoardConfig.mk` + the OTA rehearsal evidence (payload, slot flip, fingerprints) | 11 |
| 20 | The session/field-report captures: boot panel, injection transcript, break-and-diagnose write-up | 3, 4, 10 |

Rows 19–20 are documents and captures rather than code; they ship in your report directory, not the device tree. Everything else is a file a reviewer can open.

## Deliverables

1. **Property spec, formalized** (Lecture 7): a one-page spec for `ACME_DOOR_STATE` — ID composition by the property algebra, type, area model, access and change modes, default/error behaviour, and *who may write it* — checked against artifact 12's registration. Every attribute defended in one sentence; a spec the implementation can be audited against.
2. **The contract, frozen** (Lecture 6): artifacts 6–8 with the freeze proof — `m vendor.acme.hardware.welcome-freeze-api` output or its equivalent state, `-V1-` library names in consumers, and the manifest/matrix pairing stated in one paragraph (what the device declares, what the framework admits, why they meet).
3. **System consumption** (Lectures 5, 7): artifacts 9–11 and 13 — the service owns the decision (including door-open timeout behaviour), the car-process controller owns translation, and *no app or service touches the VHAL or the daemon except through its governed seam*. Evidence: `dumpsys welcome_light` showing `hal=connected` with counters, and a door injection (`cmd car_service inject-vhal-event 639634448 1 true`) moving `setCalls`.
4. **Product integration** (Lectures 2, 8): artifacts 1–3, 14, 15 — a clean `kestrel_auto` build contains the daemon, the app, and the enabled overlay; the welcome surface's string comes from the overlay, not an edited base file. No copied binaries, no edited generated files; `m nothing` passes and the module builds were your iteration loop.
5. **Security** (Lectures 5, 9): artifact 16 complete for the daemon's file set, at least one dedicated type of your own beyond the lectures' examples, zero new denials on an enforcing boot, the unauthorized-caller case *demonstrated* (shell denied at the permission gate, unprivileged lookup denied at the service-manager gate), and a one-paragraph threat note: who can fake a door event, what stops them, and which artifact enforces it.
6. **Tests** (Lecture 12): artifacts 17–18, each runnable by one command, each *shown failing* against a deliberately broken implementation (your report names the break and quotes the red output), including the negative cases — unauthorized caller at both gates, and the property-presence regression mindset applied to your spec from deliverable 1.
7. **Field report** (Lectures 3, 4, 10, 11): a one-page write-up in Lecture 10's five-line format — reproduction, layer bound, evidence capture, ranked suspects with the separating capture, post-fix verification — for one break you actually performed, plus your slot sheet and the OTA rehearsal summary (payload between your two builds, slot flip proved by suffix + fingerprint, and where rollback stopped being automatic).

**The variation (required, small).** Change exactly one dimension of the lectures' design and defend it: rear-door areas join the front (area model), a welcome timeout with fade (service logic), a second instance of the interface (VINTF + test parameterization), or brightness via a properly evolved v2 (Lecture 6's append-only discipline). One paragraph in the report: what changed, which artifacts it touched, which test proves it. The variation is where assembly becomes engineering — small enough to finish, real enough to argue about.

## Submission shape

Two parts. **The patch set**: your changes against the tree, organized so a reviewer can apply them in the order-of-battle sequence below (per-lecture commits or clearly separated change groups; generated files — `aidl_api` snapshots, the frozen `.hash` — committed as the tooling produced them, never hand-edited). **The report** (five pages at most): the property spec (deliverable 1), the threat note (5), the variation paragraph, the field report with its proving capture (7), the quoted red/green test evidence (6), and the OTA summary (7). Every claim in the report points at a path in the patch set or a capture beside it; a claim that points at neither is a hope, and reviewers grade hopes accordingly. Reviewers will spot-check by rebuilding from your patch set onto a clean tree — organize for that reader.

## Suggested order of battle

If assembling from lecture artifacts: inventory against the map (an hour with `ls` and the lectures open) → fill gaps in dependency order (product → daemon boot → contract → service/controller → app/overlay → policy) → clean build → enforcing proof → tests green → break one thing per layer and watch the right test/diagnosis catch it → OTA crossing → report. If building fresh: the map *is* the order; do not wire the app before the property is drivable from `cmd car_service`, and do not write policy before the callers exist to be named in it. Resist UI early; a property you can drive from the shell is a property you can test.

## Rubric (self-grade honestly; each row is checked against artifacts by path)

| Row | Pass looks like |
|---|---|
| Property design | Artifact 12 matches the deliverable-1 spec attribute-for-attribute; the ID composes by the algebra and sits in the vendor range |
| Layering | `WelcomeLightController` is the only CarService-side consumer; apps reach the light only via `welcome_light`; the daemon's only Binder client is `system_server` (artifact 16's `find` grants say so) |
| Build hygiene | `PRODUCT_PACKAGES` (artifact 2) — not `PRODUCT_COPY_FILES` — carries every binary; module builds during development; the set survives a clean product build |
| Security | Artifact 16 complete; enforcing boot shows zero new avc in `dmesg`; both unauthorized-caller demonstrations quoted; threat note names its enforcing artifact |
| Tests | Artifacts 17–18 exist at their paths, run by one command each, and the report quotes each failing against its named break |
| Debugging evidence | Field report follows the five-line format; the proving capture is included and re-derivable (command named, fingerprint on it) |
| Shipping | Slot sheet present; OTA evidence shows slot flip by suffix + fingerprint; the report names the exact moment rollback stopped being automatic |

## Stretch goals (optional)

Drive the door property from a simulated event timer and price the event rate with a Perfetto trace (Lecture 10); make the welcome logic garage-mode/power aware so it respects suspend states (Lectures 7, 11); ship the variation as the mini-OTA's payload and verify the *variation* — not just the feature — survives the slot switch (Lecture 11). Each is one paragraph in the report, tooling you already have.

Finishing this capstone means the course's promise has been kept at least once, by your own hands: you changed a vehicle system end to end, and you can prove every layer of it — by path, by command, by capture. Take that patch set into your next design review. It will hold up.

