---
number: 12
title: "Testing, CTS/VTS, and compliance"
subtitle: "Proving the system you customized still deserves to be called Android, and is ready for the capstone."
---

## Motivation

Every previous lecture changed something. This one answers: how do you know the change works, keeps working, and did not quietly forfeit Android compatibility? On vehicle programs the honest answer is a test story in layers (your tests, VTS for your HALs, CTS for the platform promise, CDD as the contract behind them), run early enough that failures are information instead of schedule emergencies.

## Mental model

Four names, four different promises. The **CDD** (Compatibility Definition Document) is the written contract for calling a system Android: must/should requirements per release. **CTS** is the test suite that samples that contract on a running device; passing CTS is a shipping gate for anyone who wants Google's ecosystem, and its failures are read as "which promise did my customization break." **VTS** tests the vendor side against the Treble contracts of Lecture 6: your HAL claims an interface version, VTS holds it to the claim. **Your own tests** (unit, service, property-level, bench soak) cover what no suite knows: your product's behaviour.

The workflow shift this lecture demands: write the test when you write the feature, at the lowest layer that can see the failure. A vehicle property gets a VTS-style interface test and a CarService-level test (capstone). A service gets Binder-level tests for permissions (Lecture 5's checks, automated). Policy gets the enforcing, zero-denial run of Lecture 9 treated as a test, because it is one. Trade Federation is the harness that runs the big suites; learn enough of it to run one module, read one result, and reproduce one failure locally, rather than treating CTS as weather that happens to a program near milestones.

## Walkthrough: run small, read precisely

```bash
# Build and run a single test module (suite/module names per pinned baseline)
atest YourTestModule                      # developer-fast loop; substitute your test module
# TradeFed style, for CTS/VTS modules (from the suite's own setup; cts-tradefed / vts-tradefed)
#   run cts -m <ModuleName> -t <test>        # one module, one test: the unit of sanity
# Read a failure in order: test name -> assertion/expected vs actual -> device logs captured
#   alongside -> stage/layer bound (Lecture 10) -> is this my delta or upstream behaviour?
```

Failure literacy is the real content. A CTS failure after your overlay change (Lecture 8) usually means the overlay changed behaviour a test depends on; the fix is rarely "adjust the test." A VTS failure on your HAL is a contract breach (Lecture 6) with a version number attached. A flaky test demands evidence before the word "flaky" is allowed: rerun the single test on a clean target, keep both results, and remember that cars soak for weeks, so intermittency is a product property, not a test inconvenience.

Close the loop with process: presubmit/CI that runs module builds, your tests, policy checks, and a boot smoke on Cuttlefish per change is what separates programs that fear integration from programs that schedule it. You now know every piece such a pipeline needs, because the previous eleven lectures are its stages.

## Lab (tiered)

**Tier 1 (emulator/tree, 1–2 h).** Choose one upstream requirement touching your Lecture 7 property work (CDD section or an existing VTS/CTS module), find the test that enforces it, and state what your vendor property must do to stay out of its way.

**Tier 2 (Cuttlefish, 3 h).** Write and run two tests for a Lecture 5/7 artifact: one interface-level (property or service contract, including a permission-denied case) and one behaviour-level through CarService. Break the implementation once, deliberately, and record each test catching it (or rewrite the test until it does; a test that cannot fail is a screensaver).

<div class="checkpoint"><strong>Checkpoint:</strong> each test demonstrably fails when the feature is broken, passes when it is not, and runs by one command a colleague can copy. You are ready for the capstone.</div>

## Exercises

1. Map a recent customization you know (or Lecture 8's overlay) to the layer that should test it first, and the suite that will eventually judge it.
2. A CTS module fails only on your product, passes on the reference target. State your first three comparisons, in order.
3. Why is "VTS passed" not evidence that a vehicle feature works? Name the layer that supplies the missing evidence (capstone territory).
4. Draft the presubmit pipeline for this course's capstone change: stages, in order, each named by the lecture that taught it.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Lowest layer that sees the failure (resource/config test or service test), judged later by CTS for platform behaviour and by your product tests for intent.
2. Product delta (overlays/config/packages) vs reference, build fingerprints/variants (Lecture 3), then the test's captured device logs bounded by stage/layer (Lecture 10).
3. VTS proves the HAL honours its interface contract; feature truth needs CarService-level and consumer-level behaviour tests above it (Lectures 7 and the capstone).
4. Any sane order starting build (2) → boot smoke (4) → service/property tests (5, 7) → policy/enforcing check (9) → suite module (12), with OTA/rollback reserved for release pipelines (11).

</details>

## Go deeper: kernel and app pointers

Kernel compliance (GKI/KMI tests, VTS kernel areas) extends this lecture downward; [kernel path]({{ '/kernel-path/' | relative_url }}) step 6 marks the entry. App compatibility (CTS proper, app testing practices) extends it upward through the [app path]({{ '/app-path/' | relative_url }}) step 6. Both are the same lesson at different layers: a promise, a suite, and your delta under examination.

<div class="callout"><p><strong>Working with AI agents:</strong> agents write test skeletons and read TradeFed failure XML willingly. The discipline is yours: demand the negative case (permission denied, property absent, wrong area ID), because agent-written happy-path tests pass right up to the moment the car does not.</p></div>

---

**Next:** the [Capstone]({{ '/capstone/' | relative_url }}) puts all twelve lectures into one change: a vendor vehicle property, from VHAL to test, with your name on every layer.
