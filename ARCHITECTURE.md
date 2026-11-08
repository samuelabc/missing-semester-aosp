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
| Lecture depth | ~45–60 min read, 1 lab (1–3h), 4–6 exercises, checkpoints + collapsible solutions |
| Labs | Tiered: AAOS emulator → Cuttlefish (reference) → optional bench; module builds, no full build per lab |
| Lab verification | Commands/paths verified against pinned source + official docs, scripts syntax-checked, site e2e-tested; labs labelled doc-verified where a full Cuttlefish run was not done in the authoring environment |
| AI | Agentic/AI workflows folded into every lecture + capstone; no dedicated AI lecture |
| Capstone | New vendor VehicleProperty end-to-end: VHAL → CarProperty → custom system service → SELinux → VTS-style test |
| Prerequisites | Linux, Git, C++/Java basics; setup content in Lecture 1; tiered machine specs (laptop for emulator; Linux workstation/cloud VM, 32GB+ RAM guidance, for Cuttlefish builds) |
| Pages | Home (syllabus) · About/Motivation · Setup & Prerequisites · 12 Lectures · Capstone · Kernel Path · App Path · Glossary · Resources/Contributing |
| Licence | CC BY-NC-SA (site/content), matching MIT |

## Syllabus (approved)

1. The AOSP Mental Model & Source Anatomy
2. Building a Product (Soong, `lunch`, product config)
3. The AOSP Command-Line Environment (`adb`, `fastboot`, `repo`)
4. Boot & Init
5. Binder, AIDL & Custom System Services
6. Treble, HALs & VINTF
7. AAOS: CarService, Vehicle HAL & Vehicle Properties
8. Framework Customization (RRO, config, privileged system components)
9. SELinux & Platform Security
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

## Implementation notes

- Theme: `_layouts/` + `assets/css/main.css`, single column 46rem measure, one accent colour, no JS beyond the solution-toggle label.
- Lectures are a Jekyll collection (`_lectures/`, `number` front matter drives syllabus order and prev/next).
- Known content caveats are labelled inline per the verification decision (labs not run as full Cuttlefish builds in the authoring environment say so).
