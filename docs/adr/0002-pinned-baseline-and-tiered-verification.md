# Pinned Android baseline, tiered labs, doc-verified labelling

Status: accepted (2026-11-08)

All content pins one AOSP/AAOS release (initially Android 17 / AAOS 26Q2, `android-17.0.0_r1`) rather than tracking `aosp-main` or teaching multiple versions, so that paths and commands stay reproducible. Labs are tiered (emulator, Cuttlefish, optional bench) and verified against the pinned source and official documentation; where a full Cuttlefish build was not run in the authoring environment, the lab says so. The rejected alternative (requiring a full local build of every lab before publishing) was ocean-scale in time and hardware and would have delayed v1 without changing the course's design.
