---
layout: page
title: About
subtitle: Why this course exists, and what it refuses to be.
permalink: /about/
---

## The gap

Ask a room of IVI engineers how they learned to customize AOSP and you hear the same story with different part numbers. Someone handed them a vendor drop, a wiki page from two Android versions ago, and a product directory copied from the last program. They learned Soong by breaking builds, SELinux by collecting denials, and the vehicle HAL by finding one property that already worked and cloning it.

None of this is secret. It is documented, in pieces, across source.android.com, the AOSP tree itself, and a decade of talks. What does not exist is a path: an ordered, opinionated walk from "I can read Linux and Java" to "I can change this system and defend the change in review." Documentation answers questions. It does not tell you which questions a working engineer asks in week one, month three, or the week before start of production.

MIT's Missing Semester made the same point about shell, editors, and Git, and its authors put the motivation well: students spend hundreds of hours with those tools, so fluency pays for itself. The IVI version is starker. A system engineer lives inside `repo`, Soong, `adb`, Binder, and sepolicy for an entire program, often three to five years. A slow build-debug loop is not an annoyance at that scale. It is a measurable slice of a vehicle program's schedule.

## What we took from the MIT course

Four things. Name the hidden curriculum instead of pretending it is obvious. Teach workflows, not surveys; every lecture ends in something you did, not something you saw. Keep the site plain and fast, with the syllabus as the homepage, because the notes are the product. And fold new tooling into each topic as it arrives, the way the 2026 MIT edition folds AI tools into every lecture instead of quarantining them in one.

## What had to change

The labs. A shell exercise runs anywhere in seconds. An AOSP build wants a Linux machine, a few hundred gigabytes, and patience, so every lab here is tiered (emulator first, Cuttlefish as reference, bench notes optional) and built around module builds rather than full images.

The fog. Much production IVI knowledge sits behind NDAs in BSP documents. A public course cannot teach your SoC, so it teaches upstream AOSP/AAOS and the method of reading any vendor tree against it: where vendors put things, what they usually break, and how to tell upstream behaviour from vendor behaviour when the car misbehaves.

The length. Twelve lectures, not a semester. Working engineers do not have a semester.

## What this course is not

Not app development: the app layer appears only where it touches the system, with a [pointer path]({{ '/app-path/' | relative_url }}) for the rest. Not kernel development: same treatment, [kernel path]({{ '/kernel-path/' | relative_url }}). Not certification prep, though Lecture 12 covers what CTS, VTS, and the CDD actually demand of the changes you make in the other eleven.

If you finish the twelve lectures and the capstone, you will not be an expert. You will be something more useful on a program: an engineer who knows where things live, why they are built that way, and how to change them without guessing.
