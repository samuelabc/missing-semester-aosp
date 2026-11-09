---
number: 12
title: "Testing, CTS/VTS, and compliance"
subtitle: "Proving the system you customized still deserves to be called Android — interface tests, behaviour tests, and reading a CTS failure like evidence."
reading_time: "~40 min read, plus lab"
lab_time: "2–3 h"
---

<div class="lecture-map"><span class="block-label">Lecture map</span><h2>The whole lecture on one screen</h2><div class="lecture-map-grid"><div><h3>Build the map</h3><ul><li><a href="#motivation">Motivation</a> — judged by strangers</li><li><a href="#mental-model">Mental model</a> — four promises, four layers</li></ul></div><div><h3>Walk the work</h3><ul><li><a href="#worked-example-a-a-vts-style-interface-test-for-iwelcomelight">Worked Example A: a VTS-style interface test for IWelcomeLight</a> — the contract, witnessed</li><li><a href="#worked-example-b-a-carservice-level-behaviour-test">Worked Example B: a CarService-level behaviour test</a> — behaviour, not presence</li><li><a href="#worked-example-c-reading-one-cts-failure-to-a-named-product-delta">Worked Example C: reading one CTS failure to a named product delta</a> — failure to delta, named</li><li><a href="#assembling-presubmit-the-previous-eleven-lectures-staged">Assembling presubmit: the previous eleven lectures, staged</a> — the course, as a pipeline</li></ul></div><div><h3>Make it a habit</h3><ul><li><a href="#lab-guided">Lab (guided)</a> — requirement to file, verified</li><li><a href="#exercises">Exercises</a> — which promise, which layer</li><li><a href="#go-deeper-kernel-and-app-pointers">Go deeper: kernel and app pointers</a> — judged at every layer</li></ul></div><p class="map-note">Lost mid-lecture? The Contents rail on the left (top on a phone) always shows where you are. Each section opens with what it teaches and closes with what you can now do.</p></div></div>

## Motivation
<div class="section-opener"><span class="block-label">In this section</span><p>Eleven lectures changed something; this lecture is where each change meets a judge it did not write. Compliance is not a phase at the end — it is the previous lectures, read by strangers.</p></div>

Eleven lectures changed something: a product definition, a boot script, a service, a frozen interface, a vehicle property, an overlay, a security policy, a build's keys.

This lecture answers the only remaining question: *how do you know the change works, keeps working, and did not quietly forfeit the right to call the result Android?* On vehicle programs the honest answer is a test story in layers — your tests beside your feature, VTS holding your HALs to Lecture 6's contracts, CTS holding the whole product to the platform's promise — run early enough that a failure is information instead of a schedule emergency rediscovered at a milestone gate.

It is also the capstone's doorway. Everything the capstone asks you to assemble — property, HAL, service, policy, product — this lecture teaches you to *prove*: a test that demonstrably fails when the feature breaks, a suite result you can read down to the failing assertion, and an attribution habit that blames your delta before it blames the test. Teams that have this habit ship customizations with confidence. Teams that don't, fear them — and start quietly avoiding the customizations their product exists to make.

<div class="section-recap"><span class="block-label">Now you can</span><p>Say why compliance starts in Lecture 1's habits, and what it means that the judges are strangers to your program.</p></div>

## Mental model
<div class="section-opener"><span class="block-label">In this section</span><p>Four names, four different promises — kept separate, because most compliance pain is a promise tested at the wrong layer. This section separates them before any suite runs.</p></div>

Four names, four different promises. Keep them separate; most compliance pain is a promise tested at the wrong layer.

* **The CDD** (Compatibility Definition Document) is the written contract: what a system must do to call itself Android, per release. It is prose with *must* in it.
* **CTS** (Compatibility Test Suite) samples that contract on a running device: hundreds of modules (`CtsCarTestCases` for automotive among them), each a set of tests over public platform behaviour, many annotated with the CDD section they enforce. CTS is a shipping gate for the Google ecosystem; read a CTS failure as *which promise did my product break*.
* **VTS** (Vendor Test Suite) tests the other side of the Treble seam from Lecture 6: your vendor image claims interfaces at versions; VTS holds the claim to its interface contract — HAL present, declared in VINTF, methods behaving per the frozen AIDL.
* **Your tests** cover what no suite knows: that *your* feature does *your* intended thing in *your* car — the door opens, the light lights.

A landscape note so the names stop blurring: CTS judges the platform promise automatically; its manual companion (CTS Verifier) covers the residue automation cannot judge — things a human must look at or plug in. Google's own app-ecosystem suites sit beyond that and are a licensing conversation, not an engineering one; for an AAOS program the load-bearing gates are the ones above: your tests, VTS, CTS (with `CtsCarTestCases` as the automotive slice), and the CDD behind them.

When a supplier says "CTS passed," the professional follow-up is never "good" — it is "which modules, on which build variant, at which fingerprint," the three coordinates this lecture's result-reading protocol starts from.

Two rules organize the work. **Write the test at the lowest layer that can see the failure.** A HAL contract breach belongs in an interface test beside the HAL (running in seconds-minutes on one service), not discovered by CTS days later through four layers of indirection. A behaviour that emerges across processes (door property → controller → service → daemon) belongs in a behaviour test that drives the real chain, because no interface test can see it.

**Every test must be witnessed failing.** A test that has never been red is a screensaver with assertions; the labs below make you break the implementation on purpose and watch — the same controlled-burn discipline as Lecture 10's three breaks, now automated so the burn re-runs on every build.

And a workflow shift: the suites are not weather that happens to a program near milestones. Trade Federation is the harness; `atest` (the developer runner in `tools/asuite/atest`) is the fast loop. Learn to run one module, read one result file, and reproduce one failure locally, and compliance stops being a department and becomes a habit.

### Reading a result file like evidence

Before the examples, the literacy they all depend on: a suite run produces artifacts, and reading them in the wrong order wastes the run. A TradeFed invocation ends in a results directory whose centre is `test_result.xml`: a tree of modules, test cases, and per-test verdicts, each failure carrying its stack/assertion text, with the device's logs captured alongside (logcat slices per module, screenshots and bugreports where the harness took them).

Read a failure in this order: **verdict class first** — a `FAIL` (an assertion judged the device) is evidence; an `ERROR` (the harness, the host, the device connection broke) is an incident in your lab, not your product, and conflating the two classes burns engineering days on infrastructure wearing a product costume. **Assertion second** — the expected-versus-actual line is the claim; everything else is context.

**Captured device logs third** — bounded by Lecture 10 (what was the fingerprint, which layer, what did the panel say at that minute). **Only then** reproduction: the single test, re-run locally, because a failure you cannot reproduce at module scope is not yet a bug — it is a distribution, and distributions get measured (rerun counts, clean-target control runs), not vibes.

The word "flaky" is banned until that measurement exists; cars soak for weeks, so intermittency you dismiss in a test is a field behaviour you have chosen not to understand.

<div class="section-recap"><span class="block-label">Now you can</span><p>Separate the four promises and name the layer each one is tested at — before anyone runs a suite.</p></div>

## Worked Example A: a VTS-style interface test for IWelcomeLight
<div class="section-opener"><span class="block-label">In this section</span><p>Write the VTS-style interface test for <code>IWelcomeLight</code> — including the unauthorized-caller negative that Lecture 9's policy promises — and read its verdicts the way a judge does.</p></div>

**Target:** the frozen v1 contract from Lecture 6 — `getState()` (transaction 1) and `setEnabled(boolean)` (transaction 2) on `vendor.acme.hardware.welcome.IWelcomeLight/default`. **Template:** upstream's own layout, verified at the pinned tag: a HAL's VTS test lives beside its interface, e.g. `hardware/interfaces/light/aidl/vts/functional/VtsHalLightTargetTest.cpp` with an `Android.bp` carrying `test_suites: ["vts"]`, a `testing::TestWithParam<std::string>` fixture, service lookup in `SetUp()`, and `TEST_P` cases per behaviour — including, note, a family of *invalid-input* negatives. Ours mirrors it in the acme tree (fictional module, real shape):

`device/acme/kestrel/welcomed/vts/functional/Android.bp`:

```bp
cc_test {
    name: "VtsHalWelcomeLightTargetTest",
    srcs: ["VtsHalWelcomeLightTargetTest.cpp"],
    static_libs: [
        "vendor.acme.hardware.welcome-V1-ndk",
        "libgtest",
    ],
    shared_libs: [
        "libbinder_ndk",
        "libbase",
    ],
    test_suites: ["vts"],
}
```

`device/acme/kestrel/welcomed/vts/functional/VtsHalWelcomeLightTargetTest.cpp`:

```cpp
#include <aidl/vendor/acme/hardware/welcome/IWelcomeLight.h>
#include <android/binder_manager.h>
#include <android-base/logging.h>
#include <gtest/gtest.h>

using aidl::vendor::acme::hardware::welcome::IWelcomeLight;
using ndk::SpAIBinder;

class WelcomeLight : public testing::TestWithParam<std::string> {
  protected:
    void SetUp() override {
        const std::string name = std::string(IWelcomeLight::descriptor) + "/default";
        // Declared-in-VINTF instances are waited for, exactly as Lecture 6's
        // manifest fragment promises; a missing daemon fails here, loudly.
        service_ = IWelcomeLight::fromBinder(
                SpAIBinder(AServiceManager_waitForService(name.c_str())));
        ASSERT_NE(service_, nullptr) << "IWelcomeLight/default not available";
    }
    std::shared_ptr<IWelcomeLight> service_;
};

TEST_P(WelcomeLight, GetStateIsAState) {
    int32_t state = -1;
    ASSERT_TRUE(service_->getState(&state).isOk());
    EXPECT_TRUE(state == 0 || state == 1) << "undocumented state " << state;
}

TEST_P(WelcomeLight, SetEnabledRoundTrips) {
    int32_t state = -1;
    ASSERT_TRUE(service_->setEnabled(true).isOk());
    ASSERT_TRUE(service_->getState(&state).isOk());
    EXPECT_EQ(state, 1);
    ASSERT_TRUE(service_->setEnabled(false).isOk());
    ASSERT_TRUE(service_->getState(&state).isOk());
    EXPECT_EQ(state, 0);
}

TEST_P(WelcomeLight, SetEnabledIsIdempotent) {
    ASSERT_TRUE(service_->setEnabled(true).isOk());
    ASSERT_TRUE(service_->setEnabled(true).isOk());
    int32_t state = -1;
    ASSERT_TRUE(service_->getState(&state).isOk());
    EXPECT_EQ(state, 1);
    ASSERT_TRUE(service_->setEnabled(false).isOk());
}
```

Read the fixture like the upstream one. The parameter is the instance name (parameterized because one binary should test every declared instance of an interface — here only `default` exists, and Part 2 of the lab adds nothing by inventing a second one).

*Instantiation is elided*: upstream generates the instance list from the VINTF manifest via its test main; ours names `default` — the point to carry away is that the test binds to the *declared* instance, so Lecture 6's manifest fragment is an input to this test, not paperwork beside it. State values `0/1` are Lecture 5's documented integers (off/on), asserted as a set rather than a magic number where the contract allows growth.

### How VTS runs it, and what else it quietly checks

Two mechanics of the upstream shape are worth making explicit, because both become your problems at version 2. First: **the test's parameters come from the device, not the test.** The upstream fixture includes `<aidl/Vintf.h>` because the test main enumerates the instances the device's VINTF manifest actually declares and parameterizes the suite over them.

Practical consequence: declare a second instance of your HAL (or forget to declare the first) and the *test set itself* changes — a manifest edit in Lecture 6's fragment alters what runs here, which is why this lecture reads the manifest as a test input. On kestrel the enumeration finds exactly `default`, matching the fragment you wrote.

Second: **versioned suites accumulate.** When Lecture 6's Step 7 evolution lands (`-V2-` stubs, manifest declaring version 2, matrix accepting 1–2), yesterday's V1 test module does not retire — it keeps judging the v1 contract that fielded system images may still call, alongside the new v2 module; a device whose matrix range is `1-2` owes the world *both*.

This is the runtime shadow of Lecture 6's "the matrix range is the promise": tests are how the promise gets audited per version, and a program that deletes last version's suite at freeze time has chosen to stop auditing last version's cars. Budget accordingly: each frozen version is a small, permanent test annuity — one more reason append-only evolution (Lecture 6) beats the tidy breaking change.

**Reading suite-level reds.** Two failure shapes in this module mean something other than "the HAL misbehaves," and recognizing them saves a day. If the suite parameterizes to *zero* instances, or `SetUp`'s lookup assertion fires for every case at once, the declaration chain is broken — daemon unregistered, VINTF fragment missing, or the wrong partition image flashed — and Lecture 6's pairing drill (declaration vs expectation) is the debugging tool, not the test's assertions.

If only the *newest* cases fail after an interface edit, you are looking at version drift: the device declares a version the test binary wasn't built for (the `-V1-`/`-V2-` annuity above), and comparing the manifest's declared version against the module's linked stubs settles it before anyone opens the daemon.

Rule of thumb for interface suites: *all cases red together = the contract's plumbing; some cases red = the contract's semantics.* The two readings point at different lectures' files, and choosing wrong is how interface teams debug sepolicy for what turns out to be a method bug.

### The negative case Lecture 9 promised

Upstream's invalid-input negatives test that the HAL refuses nonsense. Ours has a sharper one available, because Lecture 9 made authorization a *policy fact*: exactly one domain in the universe holds `find` on `hal_welcome_service` — `system_server`. No app domain can find the service; Lecture 9 stated the consequence ("The system service in `system_server` is the gatekeeper"), and this is where that sentence becomes a regression test rather than a design claim. The case, stated as a test plan because its two halves run in different contexts:

* **Unauthorized lookup must fail.** From any context without the grant — an ordinary app (a minimal unprivileged test app calling `ServiceManager.getService("vendor.acme.hardware.welcome.IWelcomeLight/default")`), or `shell` on a policy build without test grants — the lookup returns nothing, and the log carries Lecture 10's old friend: `avc: denied { find } … scontext=u:r:untrusted_app:… tclass=service_manager`. The denial is the *pass condition*. On the day a well-meaning policy change adds a broad grant (or an `audit2allow`-generated line slips review), this test goes red while everything else stays green — which is precisely the incident it exists to prevent.
* **The positive cases need a granted domain — and earn it honestly.** A pushed VTS binary runs in `shell`'s domain, which Lecture 9 deliberately granted nothing. The lab answer is *test-only policy*: a sepolicy file compiled only into test builds grants the test's domain its `find` + `binder_call`, e.g. `device/acme/kestrel/sepolicy/vendor/vts_welcome_test.te` (fictional file, real mechanism — the same `BOARD_VENDOR_SEPOLICY_DIRS` wiring from Lectures 2/9, included by a test product rather than `kestrel_auto` proper):

```
# TEST-ONLY: never in a product image. Lets the VTS binary reach the HAL
# it exists to test; the unauthorized-lookup case proves it is absent in
# production policy by running the same lookup where this file is not.
allow shell hal_welcome_service:service_manager find;
binder_call(shell, welcomed)
```

Two disciplines make this safe rather than corrosive. The grant is *audience-narrow and build-scoped*: it names one domain, one service, and lives in a file whose absence from release builds is itself checked (grep the release image's compiled policy, or simply run the unauthorized-lookup case against a `user` build in the lab and watch it pass-as-denied). And the production rule never moves: in `kestrel_auto`'s shipping policy the audience list stays exactly Lecture 9's — the test scaffolding adapts to the design, never the reverse. A team that loosens production policy "so the tests can reach it" has inverted the relationship;

the suites serve the policy, not vice versa.

The module also needs its TradeFed face: an `AndroidTest.xml` beside the binary whose essential lines declare the suite tag and the runner (representative, in the shape of every VTS module's):

```xml
<configuration description="Runs VtsHalWelcomeLightTargetTest">
    <option name="test-suite-tag" value="vts"/>
    <target_preparer class="com.android.tradefed.targetprep.PushFilePreparer"/>
    <test class="com.android.tradefed.testtype.VtsMultiDeviceTest"/>
</configuration>
```

The tag is the citizenship: it decides which suite runs claim the module, which is why this lecture keeps saying *module* where developers say *test* — suites are scheduled, filtered, and waived per module, and your one-command developer loop (`atest VtsHalWelcomeLightTargetTest`) is the same module wearing its fast face. Keep both invocation paths working from the day the module is born; a test that only runs inside the full suite will be run rarely, late, and under protest — the three conditions under which test suites stop preventing anything.

### Run it, then make it fail

```bash
m VtsHalWelcomeLightTargetTest
atest VtsHalWelcomeLightTargetTest        # representative, userdebug Cuttlefish
# WelcomeLight.GetStateIsAState/default            OK
# WelcomeLight.SetEnabledRoundTrips/default        OK
# WelcomeLight.SetEnabledIsIdempotent/default      OK
```

Now the witnessed failure (Mental model, rule 2). Break the implementation in the cheapest honest way: in `welcomed`'s handler, invert the state mapping (store `enabled ? 0 : 1`) and rebuild only the daemon (Lecture 2's module build). `SetEnabledRoundTrips` goes red while `GetStateIsAState` stays green — evidence you have located the bug to semantics, not availability — then revert and watch green return.

Two more breaks worth the minutes: remove Lecture 9's `find` grant to `system_server` and notice this test still passes while the *system* breaks (the interface test cannot see its consumer — the layering rule in one image, and the reason Worked Example B exists); and run the unauthorized-lookup case against a build where someone added the test policy to the product by mistake, and watch the *negative* fail. Three tests, three distinct reds, each naming the layer that owns it.

<div class="checkpoint"><strong>Checkpoint:</strong> one command runs the module; each case has been seen failing for its own reason (semantics inverted, contract unavailable, authorization leaked); the unauthorized-lookup case passes-as-denied on a production-policy build and the positive cases pass on the test-policy build — and you can say, in one sentence each, why those are different builds.</div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Write an interface test that proves the contract, including the caller who must be refused.</p></div>

## Worked Example B: a CarService-level behaviour test
<div class="section-opener"><span class="block-label">In this section</span><p>One level up: a CarService behaviour test that asserts on Lecture 5's own counters, proving the feature behaves — not merely that the interface exists.</p></div>

**Gap to close:** the interface test proves the daemon honours the AIDL. It cannot prove the *feature*: door opens (a vehicle property from Lecture 7) → the car-side controller notices → `WelcomeLightService` (Lecture 5) decides → the daemon lights the lamp, with permission checks on the mutations. Upstream's shape for this layer is the car tree's own harnesses — `packages/services/Car/tests/CarServiceTest`, `CarServiceUnitTest`, and `vehiclehal_test` verified at the pinned tag — instrumented tests that drive the real CarService on a real target.

Ours is a compact member of that family (fictional module in `device/acme/kestrel/tests/car/`, `WelcomeDoorLightTest`, platform-signed so it may use the car APIs and read the service the way the product does):

```java
@Test
public void doorOpenLightsWelcomeLamp() throws Exception {
    int setCallsBefore = welcomeLightDumpCounter("setCalls=");

    // Stimulus: Lecture 7's verified injection, driver door area opens.
    executeShellCommand("cmd car_service inject-vhal-event 639634448 1 true");

    // Behaviour: within a generous deadline, the chain reacts end to end.
    pollUntil(() -> halState() == 1, "light did not turn on after door opened");
    assertTrue("service must have taken the mutating path",
            welcomeLightDumpCounter("setCalls=") > setCallsBefore);

    executeShellCommand("cmd car_service inject-vhal-event 639634448 1 false");
    pollUntil(() -> halState() == 0, "light did not turn off after door closed");
}

@Test
public void unprivilegedCallerIsDenied() throws Exception {
    // This test runs without CONTROL_WELCOME_LIGHT: the mutating call must
    // throw SecurityException, and Lecture 5's counter must confess it.
    int deniedBefore = welcomeLightDumpCounter("deniedCalls=");
    try {
        welcomeLightService().setLightEnabled(true);
        fail("setLightEnabled without the permission must throw");
    } catch (SecurityException expected) {
        // the callee-side check fired; Lecture 9's map, enforced in Lecture 5
    }
    assertTrue(welcomeLightDumpCounter("deniedCalls=") > deniedBefore);
}
```

Three reading notes. First, the *counters are the test's microscope*: Lecture 5 built `setCalls`/`deniedCalls`/`failedCalls` as debugging instruments; here they become assertions that separate "the chain reacted" from "the chain reacted *through the governed path*" — a light that lights via some side door fails this test even though the lamp is on, which is exactly the discrimination a behaviour test owes you (and the same counters Lecture 11's health gate consumed; one instrument, three lectures of work).

Second, the assertions are *poll-until with deadlines*, never sleeps: Binder chains and property callbacks are asynchronous by design (Lectures 5, 7), and a behaviour test that sleeps-and-hopes teaches flakiness as a lifestyle; a test that waits on an observable condition is fast when the system is fast and patient only when it must be.

Third, the denied-caller case exists in *both* this lecture's examples at two different layers — service-manager find (SELinux, Example A) and framework permission (Example B) — because Lecture 9's design deliberately put a gatekeeper at each seam, and each gate gets its own test at its own layer. If a failure in either case tempts you to "fix" it by widening a grant, re-read the checkpoint above; the tests are the policy's immune system.

A fourth note belongs to the craft rather than the code: **hermetic state.** The daemon has memory (Lecture 9's state file restores the last light state across restarts), which means behaviour tests run against history unless they reset it.

Discipline: `SetUp` drives the system to a *known* state through the same public seams the test then exercises (`setEnabled(false)`, door closed, counters read as baselines rather than assumed zero — which is why the cases above diff counters instead of asserting absolutes), and a test that cannot establish its starting state says so loudly instead of averaging over mystery. Half of all "flaky" automotive tests are state leaking between cases on a stateful bench;

the other half are sleeps where polls belong (note two). Neither survives this lecture's reading protocol, which is the point of having one.

<div class="section-recap"><span class="block-label">Now you can</span><p>Assert on a feature's behaviour through its service's counters, so the test convicts behaviour, not presence.</p></div>

## Worked Example C: reading one CTS failure to a named product delta
<div class="section-opener"><span class="block-label">In this section</span><p>One real <code>CtsCarTestCases</code> failure read all the way down: from suite verdict to test, from test to behaviour, from behaviour to the named Lecture 7 product delta that caused it.</p></div>

The suites will now judge everything at once, so learn the reading protocol on one failure. Representative event (module, class, and method real per the source-truth rows; the failure text is a sample): a CTS run against a `kestrel_auto` **user** build (CTS judges the shipping variant; a `userdebug` run is a different experiment) reports:

```
CtsCarTestCases  android.car.cts.CarSensorManagerTest#testMustSupportParkingBrake  FAIL
java.lang.AssertionError: required driving-state sensor PARKING_BRAKE is not supported
```

**Read in order** (Lecture 10's loop, suite dialect). *What promise?* `CarSensorManagerTest` enforces a CDD-backed automotive requirement (the class imports the `@CddTest` traceability annotation): a car must expose the driving-state inputs — parking brake among them — because UX restrictions and safety features consume them. So this is not "a sensor": it is the CDD looking at your vehicle-property layer. *Bound the layer.* The assertion is about property *presence/support*, upstream of CarService logic: the vehicle HAL either registers and emits that property or the stack honestly reports it unsupported.

*Compare against the reference, in order:* (1) same CTS version and build fingerprints recorded for both runs — a mismatch here invalidates everything downstream; (2) the same test on the reference target (`aosp_cf_x86_64_only_auto`), where it passes — the failure is a *kestrel delta*, not an upstream behaviour; (3) the smallest differing artifact that can produce it: Lecture 7's VHAL property configuration, the file where kestrel declared `ACME_DOOR_STATE`'s `VehiclePropConfig`.

Diffing it against the reference property set finds the named delta: the standard parking-brake property's config is absent from kestrel's registration (dropped when the acme property table was authored), so CarService truthfully reports the sensor unsupported and CTS truthfully fails.

**Attribution: one file, one missing registration, introduced by the feature work in Lecture 7.** The fix is the property config's restoration — not a test adjustment, not an expectation edit — and the *regression test you add* (the real deliverable) is a presence check for the standard driving-state properties beside Example B, so the next property-table edit meets this failure in your lab in minutes instead of at a CTS gate in weeks. Its shape (a third case in `WelcomeDoorLightTest`'s family, or a sibling module aimed at Lecture 7's file):

```java
@Test
public void standardDrivingStatePropertiesRemainRegistered() {
    // The class of failure CtsCarTestCases caught at the gate, caught here
    // per change: every contract property Lecture 7's table must keep,
    // present with a sane config — not merely our vendor additions.
    for (int propId : REQUIRED_DRIVING_STATE_PROPERTIES) {
        assertNotNull("property " + propId + " lost its VehiclePropConfig",
                carPropertyManager().getCarPropertyConfig(propId));
    }
}
```

Note what this test *is*: the CTS assertion's intent, re-expressed at the lowest layer that can see the failure (Mental model, rule 1) — a property-config diff now fails in presubmit, in the change that makes it, beside the file that caused it. Note also what it is not: a copy of CTS. CTS remains the judge of record; your test exists so the judge's verdict stops being news.

Every CTS failure your program ever attributes to its own delta deserves exactly this treatment, and the backlog of them — filed in Lecture 10's format, each with its regression test — becomes, over a program's life, the most honest map of where your customization actually touches the platform's promises.

The generalizable protocol, worth the wall space: fingerprint first; reference comparison second; smallest differing artifact third; fix the delta, never the expectation; mine the failure into your own test backlog (Lecture 10's bug-writeup format files it: reproduction, bound, evidence, the separating capture). A CTS failure treated this way is the compatibility contract doing you a favour at the last moment it still can.

### The second failure you will meet: the one that is not yours

Attribution cuts both ways, and the protocol's first comparison exists for the mirror-image case: a failure that *is* upstream-shaped.

Symptoms that should route you there: the same module fails on the reference target too; failures arrive in dozens across unrelated modules at once (an epidemic pattern — real product deltas fail *narrowly*, because one file can only break so many promises); or the failure correlates with the CTS build rather than the device build (a CTS downloaded for a neighbouring platform release will cheerfully judge your cars against promises they never made — the suite and the platform share a release for a reason).

Handle it with the same discipline, not reflexive innocence: reproduce on the reference, read the CDD language the test cites (sometimes the test is stricter than the contract — a known, fileable upstream bug class), and if you conclude the delta is upstream, the deliverable is a *documented waiver with evidence*, not a shrug: both fingerprints, both result excerpts, the CDD sentence, and the upstream issue.

Programs drown in compliance not from failing tests but from undifferentiated failure piles where real deltas hide among lab noise; classification is the skill, and it is why verdict class (FAIL vs ERROR) and reference runs precede all debugging. Note what never appears in either branch: editing the expectation to make the report green. The day that becomes normal, your suite stops measuring Android and starts measuring your willingness to edit suites.

<div class="checkpoint"><strong>Checkpoint:</strong> for the failure above you can state the promise (CDD via CTS), the bound (property layer), the three comparisons in order, the named delta file, and the regression test the incident bought — without using the word "flaky."</div>

### Waivers: how a known failure is allowed to exist

Sooner or later a release decision meets a red test that is understood, attributed, and not fixable on the schedule — an upstream case stricter than the CDD sentence it cites, a lab limitation with a bench fix in flight.

The waiver is the instrument, and it is a *document*, not a mood: the failing module and method, both builds' fingerprints, the reference-run evidence, the CDD reading, the named owner, and — the clause everyone forgets — an **expiry** tied to a release or a date, after which the waiver stops applying and the failure becomes a release blocker again by default.

Waivers live where release decisions are reviewed (they are Lecture 11 documents: they describe what a fleet is about to run), and they are enumerated at every shipping gate, out loud, by count and by age. The failure mode this prevents is archaeological: the "known issue" that outlived three programs because it was recorded in a spreadsheet nobody's gate read.

Your own tests play by the same law internally — a disabled case carries the bug ID from the mining discipline, or it is not disabled, merely deleted-with-extra-steps. This is compliance's unglamorous core: not that everything is green, but that every red is *accounted*.

<div class="section-recap"><span class="block-label">Now you can</span><p>Read a suite failure down its chain to a named product delta you own — no hand-waving at any link.</p></div>

<figure class="anchor-figure" role="img" aria-label="Concept anchor: from change to verdict"><p class="anchor-title">Concept anchor — from change to verdict</p><div class="anchor-flow"><div class="anchor-node"><strong>Interface test</strong>VTS-style: the contract, including its refusals</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Behaviour test</strong>the feature, asserted through its counters</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Suite verdict</strong>CTS reads the whole product at once</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Named delta</strong>upstream, BSP, or yours — the failure's owner</div></div><figcaption><strong>Read it as:</strong> every verdict is read down this chain to a named delta. A failure you cannot walk to a file is a failure you do not understand yet.</figcaption></figure>

## Assembling presubmit: the previous eleven lectures, staged
<div class="section-opener"><span class="block-label">In this section</span><p>A test story that runs only when someone remembers is a resolution, not a pipeline. Presubmit here is literally the course's table of contents, each stage cheap because the previous one passed.</p></div>

A test story that runs only when someone remembers is a New Year's resolution. The presubmit/CI pipeline this course implies is literally its table of contents, each stage cheap beside the one after it, each named by the lecture that built the instrument. Assemble it for kestrel in your lab notes as you read: the stage list below is the capstone's definition of done wearing a CI costume, and every entry names the artifact that proves it ran.

1. **Build & product sanity** (Lecture 2): `m nothing`, then module builds for touched modules; product configuration errors die in seconds.
2. **Boot smoke** (Lecture 4): Cuttlefish boots, the stage-evidence table completes, `welcomed` reaches `ready`.
3. **Interface tests** (Lectures 6, 12A): the VTS-style module + frozen-API hash checks; contract breaches fail before anyone flashes a car.
4. **Behaviour tests** (Lectures 5, 7, 12B): door→light, denied-caller, property-config presence — the feature as users meet it.
5. **Policy gate** (Lecture 9): enforcing boot, zero unexpected avc, unauthorized-lookup negative green-as-denied.
6. **Debug-instrument sanity** (Lecture 10): the panel answers (`dumpsys` counters sane, no fresh tombstones) — your health gate, rehearsed per change.
7. **Suite slices on schedule, not per change** (Lectures 11, 12C): nightly module runs (starting `CtsCarTestCases`), weekly full CTS/VTS; OTA crossing rehearsed at release cadence, not per commit.

The principle doing the work: **shift each failure to the cheapest stage that can see it**, and let the expensive suites confirm rather than discover. A program whose first CTS run is at the compliance milestone has chosen the most expensive possible test infrastructure: the schedule itself. Two economics corollaries.

Runtime is a budget you spend where it buys evidence: a module that takes forty minutes runs nightly or weekly, sliced by risk (the modules touching your deltas first), while the full suite is a release-cadence event — anyone proposing full CTS per change has not priced a bench farm. And quarantined tests are debt with interest: a test disabled "until it is stable," without a bug in Lecture 10's five-line format attached, is a promise you have stopped auditing while continuing to make it.

The ledger that keeps this honest is boring and total: every red test is either a product bug, a test bug, a lab incident, or a filed waiver — one of four, written down, never a fifth called "known flaky."

<div class="section-recap"><span class="block-label">Now you can</span><p>Stage the previous eleven lectures as presubmit, cheapest first, and say what each stage refuses to let through.</p></div>

## Lab (guided)
<div class="section-opener"><span class="block-label">In this section</span><p>Build the four-row chain yourself: requirement, test, failure, delta — a chain a reviewer can verify, ending in a file you own.</p></div>

**Tier 1 — requirement archaeology (~1 h, tree only).** Pick the CDD-backed requirement behind Worked Example C (driving-state sensors) and trace it downward: CDD statement → the CTS test that enforces it (`CarSensorManagerTest`, verified above) → the property/config a product must register to satisfy it → the Lecture 7 file where kestrel's version lives. Checkpoint: a four-row chain a reviewer can verify, ending in a file you own. While you are in the CDD, read one *should*-level requirement near your *must* and write the sentence your program would give a reviewer about it: compliance literacy is mostly knowing which verb you are looking at before someone less friendly tells you.

**Tier 2 — write, run, break (~2–3 h, Cuttlefish).**
1. Implement Worked Example A (module + three cases + the test-only policy), run it green. Checkpoint: `atest` output saved with the build fingerprint.
2. Witness each failure: invert the state mapping (semantics red), remove the `system_server` `find` grant (interface green, *system* red — then say which of your tests *should* have caught it and why none did), and run the unauthorized-lookup case against a `user` build (denial = pass). Checkpoint: three reds, three named layers.
3. Implement Worked Example B's two cases; break the chain once (stop `welcomed`, or mis-declare the door property's change mode) and record which assertion fires first. Checkpoint: the firing assertion names the hop that broke.
4. Mine one failure — yours from steps 2–3, or Worked Example C's — into Lecture 10's five-line bug format, and add the regression test it implies. Checkpoint: bug file + test committed together.

**Tier 3 — suite reading (45 min).** Run one CTS module (`CtsCarTestCases` on the emulator-class automotive target, or read a provided result) and produce the reading: failing test → promise → layer bound → the first comparison you would run. Stop at the bound; the deliverable is the reading, not the fix.

*Verification status: VTS test layout and fixture shape, CTS module configuration and test classes, CDD annotation, and CarService test harnesses checked against `android-17.0.0_r1` (see `docs/verification/lecture-12-source-truth.md`); authorization facts from Lecture 9's verified policy. All outputs are representative samples in the tools' real formats; no suite was executed in the authoring environment — Tier 2 exists to make them real.*

<div class="section-recap"><span class="block-label">Now you can</span><p>Produce a four-row chain from a requirement to a file you own, verifiable by a reviewer without you in the room.</p></div>

## Exercises
<div class="section-opener"><span class="block-label">In this section</span><p>Exercises in compliance judgement: assign a failure to its layer, defend a negative test, and read a <code>should</code>-level requirement the way an auditor will.</p></div>

1. Map Lecture 8's RRO overlay (`KestrelWelcomeOverlay`) to the lowest test layer that can see it break, and the suite that will eventually judge it. Name both, and the signal each produces.
2. A CTS module fails only on `kestrel_auto`, passes on the reference target. State your first three comparisons, in order, and what each rules out.
3. Why is "VTS passed" not evidence that the welcome feature works? Name the layer that supplies the missing evidence and one observable it asserts on.
4. A colleague proposes granting `untrusted_app` `find` on `hal_welcome_service` "temporarily, to debug the companion app." Write the review: what it breaks (name the test that goes red), and the two legitimate paths to the same debugging ability.
5. Draft the presubmit stages for a capstone-scale change (new vehicle property → HAL → service → app), each stage justified by the failure it is cheapest at catching.
6. Lecture 6's v2 freeze lands (matrix range now 1–2). A teammate proposes deleting the V1 test module "since the device declares v2 now." Rule on it: which cars does each module protect, and what runs where?

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Lowest layer: a resource-resolution check at build/boot (the overlay applies, the string resolves, `dumpsys`-level or Settings-UI assertion that `welcome_settings_title` renders the kestrel value) — a behaviour/resource test beside the product (Lecture 12's own-tests layer). Eventual judge: CTS where it touches platform behaviour (a wrong overlay that alters a *system* resource can surface as unrelated CTS failures — the classic overlay blast radius), with CDD as the contract behind them. The signal differs by design: your test says "my intended string, in my intended place"; CTS says "nothing the platform promised changed."
2. (1) Build identity: same CTS version, both runs' fingerprints/variants recorded (user vs userdebug alone manufactures failures) — rules out comparing different experiments. (2) Reference run of the single failing test — rules out upstream behaviour and confirms a product delta exists. (3) Smallest differing artifact along the failing assertion's layer chain (Lecture 12C's Example: the VHAL property config; for an overlay suspicion, the RRO/product files) — converts "our build is haunted" into a named file. Only then logs, and only inside the bounded layer.
3. VTS proves the daemon honours the frozen AIDL contract — presence, signatures, semantics of two methods. The feature is a four-process behaviour (property → CarService controller → system service → daemon) with authorization at two seams; a daemon passing every interface case can sit behind a broken controller, a missing permission grant, or an unregistered vehicle property. The missing evidence is the behaviour layer (Worked Example B): e.g., the door-injection test asserting `setCalls` advances and `getState` returns 1 — observables no interface test can see.
4. The grant inverts Lecture 9's core design ("no app can find this service; `system_server` is the gatekeeper") and silently voids its proof: Worked Example A's unauthorized-lookup case goes red — which is the system working. Even "temporarily," it ships in policy compiled into an image, trains the next reviewer to expect app access, and bypasses Lecture 5's permission checks and counters (the app now talks to the daemon with no `deniedCalls` ever recording it). Legitimate paths: debug through the governed seam — `dumpsys welcome_light` + the service's own API as the platform-signed companion (Lecture 8), which is the app path the design intends; or, for daemon-level poking, the test-only policy of Worked Example A on a lab build, which keeps the production audience list exact. Both preserve the property the design exists for: every caller enumerable from one `.te` file.
5. Look for the pipeline logic of the Assembling section applied with names: module builds + `m nothing` (2) → boot smoke with stage table (4) → frozen-API check + interface module (6, 12A) → behaviour tests incl. denied-caller and property presence (5, 7, 12B) → enforcing zero-avc boot with the unauthorized-lookup negative (9) → panel sanity (10) → scheduled CTS/VTS module slices (12C), OTA rehearsal deferred to release cadence (11). Order justified by cost-per-failure-caught, with every stage runnable from artifacts earlier stages produced.
6. Reject. The suites audit contracts, and two contracts are now fielded: v1 for every system image built against `-V1-` stubs (Lecture 6's range means either side may still meet a v1 partner), v2 for the new pairing. The v2 module runs against devices declaring version 2; the V1 module keeps running wherever a v1 declaration can still be fielded — which, given independent system/vendor updates and cars in the field for a decade, is effectively the product's life. Deleting it stops auditing the older fleet at exactly the moment its components age out of everyone's attention. The cheap correct move is the opposite of deletion: keep both modules in the scheduled suite slices, and let the *matrix range* — not enthusiasm — decide when v1's annuity ends (when the range floor rises past 1, v1 clients can no longer legally pair, and the module retires with the contract).

</details>

<div class="section-recap"><span class="block-label">Now you can</span><p>Assign any compliance failure to its promise and its layer, and name the lecture that owns the fix.</p></div>

## Go deeper: kernel and app pointers
<div class="section-opener"><span class="block-label">In this section</span><p>Compliance extends in both directions: kernel-side promises below the HAL and app-side obligations above it, each judged by the same discipline at its own layer.</p></div>

Compliance extends in both directions from this lecture. Downward, kernel-side promises (GKI/KMI, VTS kernel areas) are Lecture 6's contract discipline applied below the HAL; the [kernel path]({{ '/kernel-path/' | relative_url }}) step 6 marks the entry. Upward, app compatibility and app-side testing (CTS proper, your cabin apps' own suites) extend the same promise-suite-delta reading through the [app path]({{ '/app-path/' | relative_url }}) step 6. The capstone now stands in front of you with no unexamined layer left: property, HAL, service, app, policy, product, update, and proof.

<div class="callout"><p><strong>Working with AI agents:</strong> agents write test skeletons and parse TradeFed result XML tirelessly — use them for both. Keep two things human-owned, as in every lecture: the witnessed failure (run the break yourself; an agent's claim that a test "would fail" is the screensaver in a new costume) and the attribution (an agent will happily blame the suite; the protocol — fingerprint, reference, smallest differing artifact — is yours to enforce). Demand the negative case by name: permission denied, service unfindable, property absent. Agent-written suites default to happy paths, and cars are not happy paths.</p></div>

---

**Next:** the [Capstone]({{ '/capstone/' | relative_url }}) puts all twelve lectures into one change: a vendor vehicle property, from VHAL to test, with your name on every layer.

<div class="section-recap"><span class="block-label">Now you can</span><p>Follow compliance below the HAL and above the framework, naming the promise at each layer as you cross it.</p></div>
