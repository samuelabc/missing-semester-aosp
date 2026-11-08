# The Missing Semester of AOSP/AAOS

A course that teaches the hidden system-level curriculum OEM engineers customizing AOSP/AAOS for in-vehicle infotainment are assumed to know, but are rarely taught.

## Language

**OEM Software Engineer**:
An engineer at a vehicle manufacturer or Tier-1 supplier who integrates and customizes AOSP/AAOS into a production vehicle program. Sits between app developers and BSP/kernel vendors, integrating both.
_Avoid_: Android developer, IVI developer (unqualified)

**System Level**:
The layers from build and product definition through boot, framework services, HALs, platform security, OTA, debugging, and compliance. Excludes app-level UI development and kernel internals as primary subjects.
_Avoid_: Platform (unqualified), low level

**Pointer Track**:
Curated pointers from a system-level lecture into kernel or app topics, so learners know what to learn next and how it connects to customization, without those topics becoming lectures themselves.
_Avoid_: Appendix (for this concept), deep dive

**IVI**:
In-vehicle infotainment: the head-unit system running AAOS that provides media, navigation, vehicle settings, and driver/passenger interaction in the cabin.
_Avoid_: Head unit (as canonical term), infotainment app

**Hidden Curriculum**:
System-level knowledge that OEM onboarding assumes an engineer already has, but no class, vendor training, or single document systematically teaches.
_Avoid_: Tribal knowledge (the mechanism by which it currently spreads, not the knowledge itself)

**Capstone**:
The integrative final project that forces learners to combine build, service, HAL, vehicle data, security, debugging, and testing in one end-to-end customization.
_Avoid_: Final exam, demo

**Reference Baseline**:
The single pinned AOSP/AAOS release that all lecture code, paths, and labs are written and verified against.
_Avoid_: Latest (unqualified), main

**Tiered Lab**:
A lab with emulator, Cuttlefish, and optional real-bench levels of the same exercise, so learners can complete it with whatever environment they have.
_Avoid_: Hands-on (unqualified)

**Vendor Vehicle Property**:
A vehicle property defined by the OEM or vendor outside the standard property set, used to carry a vehicle-specific signal between the vehicle layer and Android.
_Avoid_: Custom signal, car property (unqualified)

**Worked Example**:
A complete, copyable set of artifacts taken from empty file to verified running result, with expected output and at least one deliberate failure and its fix. A fragment that stops before it runs is not a Worked Example.
_Avoid_: Snippet, sample (unqualified)

**Guided Lab**:
A lab written as numbered steps with a checkpoint after each step, so a learner can tell at every stage whether they are on track. An assignment that only names a deliverable ("produce a sheet") is not a Guided Lab.
_Avoid_: Hands-on (unqualified), exercise (for this concept)

**Running Example**:
The single fictional product that every lecture adds one real piece to, so the pieces accumulate into the Capstone instead of being discarded at the end of each lecture.
_Avoid_: Toy example, demo (unqualified)

**Configuration Artifact**:
A file whose contents configure a running system — policy, contexts, board makefiles and their kin. It is taught by its path, the process that reads it, the meaning of its lines, and the failure that appears when it is missing or wrong.
_Avoid_: Config (unqualified)
