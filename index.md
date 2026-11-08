---
layout: default
description: "The Missing Semester of AOSP & AAOS: the system-level curriculum OEM engineers customizing Android Automotive are assumed to know, but nobody teaches."
---

# The Missing Semester of AOSP &amp; AAOS

Classes and vendor training teach you Android app development and Linux. Then you join an OEM or Tier-1 IVI program, and everyone assumes you already know the rest: how to define a product and build it, why the car will not boot past the boot animation, how to add a system service and a HAL, how a signal from the vehicle becomes a vehicle property, how to write SELinux policy that passes, and how to ship an OTA that does not brick a fleet.

That knowledge is rarely taught anywhere. It moves by tribal knowledge, stale internal wikis, and reading other people's product directories at 11 p.m. This course teaches it directly, at the system level, for engineers customizing AOSP and Android Automotive OS for in-vehicle infotainment.

You will spend thousands of hours inside this stack over a career. The first months should not be spent guessing how it fits together.

Inspired by MIT's [The Missing Semester of Your CS Education](https://missing.csail.mit.edu/), whose premise we borrow with respect: the most valuable curriculum is often the one nobody put on the syllabus.

## Syllabus

Lectures follow the order you actually meet these problems on a vehicle program: get the source, build a product, boot it, extend it, secure it, debug it, ship it, prove it. Each lecture is self-contained, takes an evening to read, and ends with a lab you can run without car hardware. New here? Start with [Setup &amp; prerequisites]({{ '/setup/' | relative_url }}) and Lecture 1.

<ol class="syllabus">
{% assign sorted = site.lectures | sort: "number" %}{% for lec in sorted %}
  <li><span class="no">{{ lec.number }}</span><a href="{{ lec.url | relative_url }}">{{ lec.title }}</a><span class="lab">{{ lec.lab_time | default: "lab 1–3 h" }}</span></li>
{% endfor %}
  <li><span class="no">★</span><a href="{{ '/capstone/' | relative_url }}">Capstone: a vendor vehicle property, end to end</a><span class="lab">project</span></li>
</ol>

Plus two pointer tracks for the subjects this course deliberately does not teach as lectures: the [Kernel path]({{ '/kernel-path/' | relative_url }}) (drivers, device tree, kernel customization, in the order a system engineer meets them) and the [App path]({{ '/app-path/' | relative_url }}) (system apps, car apps, and customization at the app layer).

## Who this is for

Working OEM and Tier-1 software engineers, roughly one to five years in, comfortable with Linux, Git, and reading C++ or Java, who are new or intermediate in AOSP/AAOS. App developers will find Lecture 8 and the [App path]({{ '/app-path/' | relative_url }}) useful but should not expect UI development here. Kernel engineers should start from the [Kernel path]({{ '/kernel-path/' | relative_url }}).

## How to use this course

Read a lecture, then do its lab before moving on. Labs are tiered: quick on the AAOS emulator, reference on Cuttlefish, optional notes for a real bench. Commands are written against the pinned baseline, **Android 17 / AAOS 26Q2** (`android-17.0.0_r1`), and checked against the upstream source and documentation. Where a lab step needs a full Cuttlefish build we could not run while writing, the lab says so plainly. Exercises carry checkpoints and collapsible solutions. Stuck is normal; the checkpoint tells you what "unstuck" looks like.

Every lecture also folds in how working engineers now use AI coding agents on this stack: reading a 200 GB tree, drafting policy, explaining a tombstone. Used with a build and a test, they help. Used instead of one, they produce confident nonsense at scale. The lectures show both sides.

## General information

**Staff:** written and maintained by practitioners; see [Resources &amp; contributing]({{ '/resources/' | relative_url }}).
**Hardware:** none required. A Linux workstation or cloud VM helps from Lecture 2 on; see [Setup]({{ '/setup/' | relative_url }}).
**Licence:** CC BY-NC-SA 4.0, same family as the MIT course that inspired this one.
**Version note:** AOSP now publishes source in Q2/Q4 under its trunk-stable model; this course pins one release rather than chasing `aosp-main`, and will say what changed when the pin moves.
