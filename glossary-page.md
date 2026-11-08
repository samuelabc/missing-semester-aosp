---
layout: page
title: Glossary
subtitle: The words this course uses precisely, so that reviews at work can use them the same way.
permalink: /glossary/
---

**OEM software engineer.** An engineer at a vehicle manufacturer or Tier-1 who integrates and customizes AOSP/AAOS into a production vehicle program. Sits between app developers and BSP/kernel vendors, integrating both. Not "Android developer" without qualification.

**System level.** Build and product definition, boot, framework services, HALs, platform security, OTA, debugging, compliance. The app UI layer and kernel internals sit outside it, reachable through the pointer paths.

**IVI.** In-vehicle infotainment: the head-unit system running AAOS for media, navigation, vehicle settings, and cabin interaction.

**Hidden curriculum.** System knowledge OEM onboarding assumes you have and no single source teaches: the subject of this course.

**Pointer track.** Curated onward reading inside a lecture (or on the kernel/app path pages) for topics this course deliberately does not teach as lectures.

**Reference baseline.** The one pinned AOSP/AAOS release (Android 17 / AAOS 26Q2) that all code, paths, and labs target.

**Tiered lab.** One exercise at emulator, Cuttlefish, and optional bench levels.

**Vendor vehicle property.** A vehicle property defined by an OEM/vendor outside the standard set, carrying a vehicle-specific signal between the vehicle layer and Android. The capstone builds one.

**Product.** In AOSP, the named buildable configuration of a device: its makefiles, overlays, and module list. "The product" on a vehicle program means your specific head-unit build, not Android in general.

**BSP.** Board support package: the vendor's SoC/kernel/HAL drop you integrate. Upstream is the reference; the BSP is a delta on it, and half of debugging is telling the two apart.
