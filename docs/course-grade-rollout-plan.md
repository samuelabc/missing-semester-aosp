# Course-grade rollout plan (draft — awaiting separate approval)

Status: draft, 2026-11-08. Pilot (Lecture 9, SELinux) approved by owner and
shipped as v1.1.0. This plan rolls the ADR-0003 standard — one Worked
Example, Guided Lab, Running Example artifacts that accumulate — to the
remaining lectures. **No lecture in this plan is started until the owner
approves this draft.** Each lecture then gets the same acceptance gate as
the pilot: source-truth table in `docs/verification/`, `bash -n` on all
code blocks, type/label/file consistency cross-check, clean Jekyll build,
link crawl, browser e2e with screenshots in `screenshots/`, owner review
before the next lecture begins.

## Ground rules (inherited from the pilot, not re-negotiable per lecture)

- Running Example cast is frozen (GLOSSARY.md): `device/acme/kestrel`,
  `kestrel_auto`, `/vendor/bin/welcomed`, `vendor.acme.hardware.welcome.
  IWelcomeLight/default`, `vendor.acme.welcome.*`, `com.acme.welcome`.
- Source-true verification against the pinned tag (`android-17.0.0_r1`)
  before writing; fictional files labelled fictional; Tier 2 cycles that
  were not run on Cuttlefish say so.
- One page per lecture, ~6,000–7,500 words, honest `reading_time` /
  `lab_time` front matter; 4–6 hands-on exercises with complete solutions.
- Lecture 9 is the reference implementation. When a rollout lecture and
  Lecture 9 disagree, Lecture 9 wins until the owner rules otherwise.

## Order and per-lecture scope (dependency order)

### Phase 1 — make the Running Example real (Lectures 2, 4, 5, 6, 7)

1. **Lecture 2 — Building a product.** Worked Example: create the real
   `kestrel_auto` product (`AndroidProducts.mk`, product makefiles,
   `BoardConfig.mk` as begun in Lecture 9), add `welcomed` via
   `PRODUCT_PACKAGES`, build module-only and prove the change on
   Cuttlefish. Retires Lecture 9's Cuttlefish-overlay instructions;
   Lecture 9 gets a one-line correction pointing here. Guided Lab: add a
   second module to the product and trace why it did/didn't land.
2. **Lecture 4 — Boot and init.** Worked Example: `welcomed.rc` written
   properly (service stanza, `class hal`, `post-fs-data` data dir,
   restart behaviour), boot-timeline reconstruction from logs with the
   daemon's start marked. The stand-in `.rc` from Lecture 9's annex is
   replaced by reference. Guided Lab: add a late-start oneshot and prove
   ordering from `init.svc.*` properties.
3. **Lecture 5 — Binder, AIDL, custom system services.** Worked Example:
   the system-side welcome-light service (in `system_server`'s world as
   Lecture 9 assumed): AIDL surface, permission checks on every mutating
   call, `dump()` output, calling `IWelcomeLight` through the policy
   Lecture 9 granted. Guided Lab: add one method end-to-end (AIDL →
   service → `dumpsys` proof) including the denied-caller case.
4. **Lecture 6 — Treble, HALs, VINTF.** Worked Example: freeze
   `vendor.acme.hardware.welcome` (replace `unstable: true` with
   versioned `versions_with_info`), write the VINTF manifest fragment
   and compatibility-matrix expectation, read the resulting build
   failure when they disagree. Lecture 9's AIDL-vs-HIDL section is the
   bridge; HIDL stays reading-only.
5. **Lecture 7 — AAOS, CarService, Vehicle HAL, vehicle properties.**
   Worked Example: the vendor vehicle property for door state, from
   HAL definition through `CarPropertyManager` to the welcome-light
   service deciding to light. This completes the capstone's signal
   chain with named files at every hop. Guided Lab Tier 1 on the
   emulator (property archaeology with real IDs), Tier 2 driving the
   property on Cuttlefish.

### Phase 2 — customize, debug, ship, prove (Lectures 8, 10, 11, 12)

6. **Lecture 8 — Framework customization.** Worked Examples: an RRO
   changing a welcome-settings string end-to-end, and the privileged
   `com.acme.welcome` app shipped completely (manifest, priv-app
   allowlist XML — the interim debt Lecture 9 recorded — signing
   `certificate:` in `Android.bp`). Closes the signing half of the
   Lecture 9 map.
7. **Lecture 10 — Debugging and profiling.** Worked Example: break
   `welcomed` three ways (policy denial, crash with tombstone,
   Binder-thread stall), diagnose each with the lecture's loop, one
   Perfetto trace of a property-change storm through the welcome path.
   All captures generated from the Running Example so earlier lectures'
   artifacts are the evidence.
8. **Lecture 11 — OTA, partitions, shipping.** Worked Examples: A/B
   partition and slot sheet for the reference target, OTA payload
   between two kestrel builds with a rehearsed rollback, release
   signing and `BOARD_AVB_ENABLE`/vbmeta board configuration in full —
   closing the verified-boot half of the Lecture 9 map.
9. **Lecture 12 — Testing, CTS/VTS, compliance.** Worked Example:
   VTS-style interface test for `IWelcomeLight` (including the
   unauthorized-caller negative case Lecture 9's policy promises),
   CarService-level behaviour test, one CTS module failure read and
   attributed to a named product delta.

### Phase 3 — orient and integrate (Lectures 1, 3, capstone)

10. **Lecture 1 — Mental model and source anatomy.** Lighter touch by
    design (it is an orientation lecture): the vertical trace exercise
    becomes a Guided Lab tracing HVAC and then the welcome-light chain
    using the now-real cast. No new artifacts; every path it names is
    one the learner will create later.
11. **Lecture 3 — Command-line environment.** The daily-twenty becomes
    a worked session against a running Cuttlefish with the welcome
    stack as its subject (`service list`, `dumpsys`, property reads),
    each command with shown output. Shortest rewrite in the plan.
12. **Capstone.** Rewire deliverables to name the files each rewritten
    lecture actually produced (the Lecture 9 alignment in v1.1.0 is the
    template), so a learner arriving from Lecture 12 assembles the
    patch set instead of inventing it. Rubric rows unchanged in intent,
    reworded to check artifacts by path.

## What "done" means for the rollout

- All 12 lectures meet ADR-0003; `ARCHITECTURE.md` interim-debt notes
  (Lectures 8/11) removed as those lectures land.
- The capstone is completable from lecture artifacts alone, verified by
  walking it once against the rewritten lectures (paper e2e) plus the
  Tier 2 captures each lecture saved.
- Version: minor bump per approved lecture batch (Phase 1 → 1.2.0,
  Phase 2 → 1.3.0, Phase 3 → 1.4.0), each with screenshots and a fresh
  link crawl.
- Out of scope throughout: visual redesign, video, auto-grading,
  requiring full Cuttlefish builds to publish (ADR-0002).
