---
layout: page
title: Resources & contributing
subtitle: Primary sources, and how to fix this course when you find it wrong.
permalink: /resources/
---

## Primary sources (read these over blog posts, including ours)

- [source.android.com](https://source.android.com/) — the AOSP documentation set. Lectures link the specific pages that matter; the site's own search is your second stop after the tree.
- [AOSP on android.googlesource.com](https://android.googlesource.com/) — the source itself. Code search at [cs.android.com](https://cs.android.com/) is the tool Lectures 1 and 5 teach against.
- [Android Automotive releases](https://source.android.com/docs/automotive/start/releases) — what changed per AAOS release; read the 26Q2 notes against this course's baseline.
- [Codenames, tags, and build numbers](https://source.android.com/docs/setup/reference/build-numbers) — the pinned-tag reference used across the course.
- [MIT Missing Semester](https://missing.csail.mit.edu/) — the model for this course, and the right place for shell/editor/Git fluency we assume.
- [Perfetto documentation](https://perfetto.dev/docs/), [AOSP testing](https://source.android.com/docs/core/tests), [OTA documentation](https://source.android.com/docs/core/ota) — the deep shelves behind Lectures 10–12.

## Contributing

This course is wrong somewhere; every AOSP course is, the day after a release. Corrections are the contribution model:

1. Open an issue or pull request in the site repository with the lecture, the command or claim, and what you observed, including your build target and baseline tag.
2. Prefer a fix against the pinned baseline over a note that "main differs"; differences from the pin belong in a version note, not the main text.
3. Lab reports count double. "Ran Lecture 6 lab on Cuttlefish, step 4 fails with X" improves the course more than any prose edit. Say which verification tier you reached.

Style follows the lectures: plain sentences, commands that were actually run or are labelled doc-verified, no claims without a path, test, or log behind them.

## Changelog

- **v1.0 (2026-11):** initial release. 12 lectures + capstone, pinned to Android 17 / AAOS 26Q2 (`android-17.0.0_r1`).
