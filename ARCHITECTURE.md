# Architecture & Project Context

## What this is

**The Missing Semester of AOSP & AAOS** — a public, English-only course site for OEM software engineers customizing AOSP/AAOS for in-vehicle infotainment (IVI) at the system level. Modelled on MIT's [The Missing Semester of Your CS Education](https://missing.csail.mit.edu/): it teaches the hidden curriculum learners are assumed to know but nobody teaches.

## Settled decisions (Grill Rounds 1–4, 2026-11-08)

| Area | Decision |
|---|---|
| Thesis | Hidden system-level curriculum for OEM IVI engineers, not an AOSP tutorial |
| Audience | OEM engineers, ~1–5 yrs, solid Linux + C++/Java, new/intermediate to AOSP/AAOS |
| Boundary | System level core; kernel & app topics only as Pointer Tracks |
| Reference baseline | Pinned latest stable AOSP/AAOS (at design time: Android 17 / AAOS 26Q2, API 37; pin exact tag at build time) |
| Stack | Jekyll + GitHub Pages, custom theme faithfully echoing the MIT site + one automotive accent |
| Syllabus | 12 lectures, OEM lifecycle order (see below) |
| Lecture template | Motivation → Mental model → Walkthrough → Lab → Exercises → Go deeper (kernel/app pointers) → AI/agentic tip |
| Lecture depth | Course-grade standard (ADR-0003, audit 2026-11-08): at least one complete Worked Example (every file in full, line-by-line, expected output, break-it/fix-it cases), Guided Lab with per-step checkpoints, hands-on exercises with complete solutions; ~35–45 min read (6,000–7,500 words), lab 2–3 h. All 12 lectures rewritten to this standard (pilot Lecture 9 at v1.1.0; Phases 1–3 at v1.2.0/v1.3.0/v1.4.0) |
| Running Example | One fictional product threaded through all lectures so artifacts accumulate into the Capstone: `device/acme/kestrel/` (product `kestrel_auto`), native daemon `/vendor/bin/welcomed` implementing AIDL HAL-style `vendor.acme.hardware.welcome.IWelcomeLight/default`, data `/data/vendor/welcomed`, light nodes `/dev/welcome_light` + sysfs LED, properties `vendor.acme.welcome.*`, companion app `com.acme.welcome`. Names frozen verbatim (GLOSSARY.md) |
| Labs | Tiered: AAOS emulator → Cuttlefish (reference) → optional bench; module builds, no full build per lab |
| Lab verification | Commands/paths verified against pinned source + official docs, scripts syntax-checked, site e2e-tested; labs labelled doc-verified where a full Cuttlefish run was not done in the authoring environment |
| AI | Agentic/AI workflows folded into every lecture + capstone; no dedicated AI lecture |
| Capstone | Assemble the Running Example's artifacts (twenty-row artifact map by lecture) + one required small variation; seven deliverables with acceptance evidence; rubric checks artifacts by path |
| Prerequisites | Linux, Git, C++/Java basics; setup content in Lecture 1; tiered machine specs (laptop for emulator; Linux workstation/cloud VM, 32GB+ RAM guidance, for Cuttlefish builds) |
| Pages | Home (syllabus) · About/Motivation · Setup & Prerequisites · 12 Lectures · Capstone · Kernel Path · App Path · Glossary · Resources/Contributing |
| Licence | CC BY-NC-SA (site/content), matching MIT |
| Readability | ADR-0004 (2026-11-09, grill rounds 1–4): warm editorial system + light text surgery; Contents Rail, lecture map, Section Opener/Recap per H2, Concept Anchors only where an idea is a shape, narrative paragraphs ≤~90 words with original wording preserved; guardrail "no decoration without direction" supersedes restraint in PRODUCT.md; acceptance is the lost test (mid-lecture orientation in 10 s). Owner passed the Lecture 1 pilot's lost test on 2026-11-09; rolled out to all 12 lectures + home/capstone/setup maps + device-following dark mode the same day (release v1.5.0) |

## Syllabus (approved)

1. The AOSP Mental Model & Source Anatomy
2. Building a Product (Soong, `lunch`, product config)
3. The AOSP Command-Line Environment (`adb`, `fastboot`, `repo`)
4. Boot & Init
5. Binder, AIDL & Custom System Services
6. Treble, HALs & VINTF
7. AAOS: CarService, Vehicle HAL & Vehicle Properties
8. Framework Customization (RRO, config, privileged system components)
9. SELinux & Platform Security (pilot rewrite: SELinux in depth; signing/verified boot depth moved to Lectures 8/11 in the rollout)
10. Debugging & Profiling (`logcat`, `dumpsys`, bugreport, Perfetto, tombstones)
11. OTA, Partitions & Shipping
12. Testing, CTS/VTS & Compliance → Capstone

## Non-goals (v1)

- Video production, translations, blog/FAQ/community pages
- App-level UI development and kernel internals as primary subjects (Pointer Tracks only)
- OEM/SoC-proprietary content; upstream AOSP/AAOS only
- Auto-graded quizzes; exercises are self-graded with checkpoints

## Why MIT's model works (design rationale)

Names a hidden curriculum; sells lifetime ROI over credits; short/intensive/bounded; workflow-and-exercise led; content-first zero-marketing site; folds current tooling (AI) into every topic; openly licensed so it spreads. Our adaptations for AOSP: pinned baseline, tiered labs to survive build weight, upstream-only to survive proprietary fog, lifecycle order instead of layer order.

## Status

v1.0 built and verified (2026-11-08): Jekyll build clean, all 16 published bash blocks pass `bash -n`, internal-link crawl (20 URLs) clean, browser e2e on desktop/mobile home, Lecture 7 (incl. solution toggle), capstone, and 404 journeys captured in `screenshots/`. Deployed: public repo https://github.com/samuelabc/missing-semester-aosp (initially created private; GitHub free plan cannot serve Pages from private repos, owner chose public), live at https://samuelabc.github.io/missing-semester-aosp/ via `.github/workflows/pages.yml`; live crawl of 20 URLs passes. Note `url`/`baseurl` in `_config.yml` are set for that subpath and internal links must go through `relative_url`. Terms in `GLOSSARY.md`; decisions in `docs/adr/`.

Content audit + pilot (2026-11-08, ADR-0003): the v1 lectures were audited as overview essays, not a course (1–2 code blocks, no expected outputs, labs as assignments). Lecture 9 was rewritten as the gold-standard pilot: SELinux only, a denial-driven Worked Example securing `welcomed` file by file, anchored micro-examples for the remaining policy files, and a Guided Lab (Tier 1 tree-only writing, Tier 2 Cuttlefish enforcing run, Tier 3 bench reading). Claim-by-claim verification against `android-17.0.0_r1` is in `docs/verification/lecture-09-source-truth.md`. Owner approved the pilot on 2026-11-08; shipped as v1.1.0. Interim debt recorded at pilot time — privileged-app allowlist depth (Lecture 8) and signing/verified-boot file depth (Lectures 8/11), which Lecture 9 links to as a map — is **closed** as of the Phase 2 rollout below.

Rollout Phase 1 (2026-11-08, `docs/course-grade-rollout-plan.md`, owner-approved per lecture at review gates): Lectures 2, 4, 5, 6, 7 rewritten to the ADR-0003 standard, each with a claim-by-claim table in `docs/verification/lecture-0X-source-truth.md` against `android-17.0.0_r1` and browser proof in `screenshots/10–14`. The Running Example is now real end to end: Lecture 2 makes `kestrel_auto` a lunch target shipping `welcomed`; Lecture 4 writes `welcomed.rc` properly and the boot-stage evidence method; Lecture 5 adds `WelcomeLightService` in `system_server` (AIDL, `CONTROL_WELCOME_LIGHT` permission checks, `dump()` counters); Lecture 6 freezes `vendor.acme.hardware.welcome` at v1 with the manifest/matrix pair; Lecture 7 closes the chain with vendor property `ACME_DOOR_STATE` (`0x26200C10`) → CarProperty → car-process `WelcomeLightController` → light. Combined gate: 35/35 site bash blocks `bash -n`-clean, Jekyll build clean, 261 internal links with 0 broken. Owner approved the Phase 1 release on 2026-11-08; shipped as v1.2.0.

Rollout Phase 2 (2026-11-08, `docs/course-grade-rollout-plan.md`, owner-approved per lecture at review gates): Lectures 8, 10, 11, 12 rewritten to the ADR-0003 standard, each with a claim-by-claim table in `docs/verification/lecture-0X-source-truth.md` against `android-17.0.0_r1` and browser proof in `screenshots/15–18`. Lecture 8 ships `com.acme.welcome` completely (platform certificate, two distinct permission mechanisms, same-partition privapp allowlist XML) plus the `KestrelWelcomeOverlay` RRO worked example — closing Lecture 9's signing half. Lecture 10 breaks `welcomed` three ways (SELinux `find` refusal, native crash with tombstone + manual symbolization, single-lane Binder stall) and diagnoses each with its five-step loop, a Perfetto property-change storm, and a first-fifteen-minutes runbook. Lecture 11 extracts the kestrel slot sheet from the real board-config chain (8 GiB super, dynamic-partition groups, five AVB rollback-index locations, SPL timestamp as anti-rollback clock), runs an OTA crossing between two `kestrel_auto` builds, rehearses both rollback classes, and does release signing/`BOARD_AVB_ENABLE`/vbmeta in full — closing Lecture 9's verified-boot half. Lecture 12 writes the VTS-style `IWelcomeLight` interface test (including the unauthorized-caller negative Lecture 9's policy promises), a CarService behaviour test asserting on Lecture 5's counters, and reads one real `CtsCarTestCases` failure down to a named Lecture 7 product delta. Combined gate: 43/43 site bash blocks `bash -n`-clean, Jekyll build clean, 261 internal link occurrences with 0 broken, all Phase 2 lectures 6,004–6,178 words. Owner approved the Phase 2 release on 2026-11-08; shipped as v1.3.0.

Rollout Phase 3 (2026-11-08, `docs/course-grade-rollout-plan.md`, owner-approved per lecture at review gates): Lectures 1 and 3 rewritten to the ADR-0003 standard, each with a claim-by-claim table in `docs/verification/lecture-0X-source-truth.md` against `android-17.0.0_r1` and browser proof in `screenshots/19–20`. Lecture 1 traces the real HVAC fan-speed property upstream (AIDL ID algebra → `VehiclePropertyIds` mirror → emulated-VHAL default → `CarPropertyService`/`CarHvacManager`) before mapping the course's welcome chain as a ten-row promissory note the later lectures redeem. Lecture 3 narrates one morning session with the running stack (daily-twenty table, repo identity ladder, denied-vs-allowed `service call welcome_light` under the Lecture 5 counters, composed session captures and a fossil script) — and silently corrects the v1 lab's wrong HVAC property ID (557847504 → 356517120). The capstone is rewired from "invent a feature" to "assemble the lectures' artifacts": a twenty-row artifact map names the exact paths each lecture produced, seven deliverables each carry acceptance evidence, and the rubric checks artifacts by path; a paper-e2e cross-check verified all 21 capstone-named paths appear in their cited lectures (21/21, 0 unresolved). Combined gate: 57/57 site bash blocks `bash -n`-clean, Jekyll build clean, 266 internal link occurrences with 0 broken, all twelve lectures 6,001–7,519 words (Lecture 2's 5,873 pre-approved in Phase 1). Owner approved the Phase 3 release on 2026-11-08; shipped as v1.4.0. **The ADR-0003 rollout is complete** — every lecture and the capstone now meet the course-grade standard.

Readability pilot (2026-11-09, ADR-0004): Lecture 1 rebuilt to the readability standard — lecture map, 13 Section Openers + 13 Section Recaps (one pair per `h2`), 4 Concept Anchors (four-layer stack, source→installed→running shapes, fan chain, welcome chain), the one 123-word catalogue sentence converted to a bullet list, and every narrative paragraph split to ≤90 words at sentence boundaries with wording preserved (0 remaining over the limit; 98.7% word-identical after stripping the new components). Gate: Jekyll build clean, bash blocks `bash -n`-clean, Lecture 1 internal links 0 broken, contrast ≥4.5:1 on all text pairs, Impeccable detector clean, browser proof in `screenshots/23–27` (desktop top, desktop mid-lecture with rail highlighting Worked Example A at 40% progress, diagram/table, phone mid-lecture with sticky contents bar, print media). Owner passed the pilot's lost test the same day.

Readability rollout (2026-11-09, v1.5.0, after the owner's pilot approval): Lectures 2–12 received the full standard — lecture map, an Opener/Recap pair per `h2` (counts audited equal in the built HTML for all 12 lectures), one central Concept Anchor each (build pipeline, three machines, boot relay, Binder call, Treble seam stack, door-to-light chain, customization preference stack, denial loop, three-break evidence shapes, A/B slots, change-to-verdict chain), and paragraph surgery (no narrative paragraph over 102 words site-wide; the few 91–102-word remainders are single catalogue sentences). Home gained a course-on-one-screen map; capstone and setup gained their own maps; dark mode follows the device via `prefers-color-scheme` with audited dark contrast (≥8:1 body/muted/accent). Enhancement pass (same release, owner's "enhance thoroughly"): second table-grounded Concept Anchors in Lectures 2, 5, 6, 9, 11 (anchor figures now carry `role="img"` with their title as label); honest reading times (Lecture 1 ~45 min, Lecture 9 ~50 min at their new word counts); `reading.js` also adds section permalinks (¶ on heading hover/focus), copy buttons on code blocks, solutions that open only for printing, `aria-current` on the active rail link, and the phone rail bar naming the current section. Combined gate: clean Jekyll build from scratch, 0 broken lecture-map links across all pages, all bash blocks clean, detector clean, browser proof in `screenshots/28–32` (Lecture 7 desktop mid-lecture, Lecture 9 dark, Lecture 11 phone, Lecture 5 enhanced desktop + phone). Glossary page inherits the type/colour system without a map — it is a single alphabetical reference, and a map would be decoration without direction.

## Implementation notes

- Theme: `_layouts/` + `assets/css/main.css` + `assets/js/reading.js`. Pages keep a 46rem measure; lectures use a two-column shell (15.5rem sticky Contents Rail built by `reading.js` from the page's own `h2`s, with scrollspy + progress, collapsing to a sticky contents bar under 960px; the page reads fully if the script never runs) beside a 42rem serif-display article. Warm editorial tokens (paper, deepened green accent, sand for recaps), system fonts only, labelled block sign system (`.section-opener`, `.section-recap`, `.checkpoint`, `.callout`, `.lecture-map`, `.anchor-figure` with chain/stack/column diagram shapes), print stylesheet (rail/chrome hidden, black on white), reduced-motion respected. As of the 2026-11-09 rollout, content surgery (opener/recap coverage, ≤90-word paragraphs, anchors) covers all 12 lectures; the stylesheet also carries the device-following dark token set.
- Lectures are a Jekyll collection (`_lectures/`, `number` front matter drives syllabus order and prev/next).
- Known content caveats are labelled inline per the verification decision (labs not run as full Cuttlefish builds in the authoring environment say so).
