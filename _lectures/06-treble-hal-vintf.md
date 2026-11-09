---
number: 6
title: "Treble, HALs, and VINTF"
subtitle: "Freezing vendor.acme.hardware.welcome into a real contract: versioned AIDL, a device manifest that declares it, and a matrix that catches the lie at build time."
reading_time: "~40 min read, plus lab"
lab_time: "2–3 h"
---

<div class="lecture-map"><span class="block-label">Lecture map</span><h2>The whole lecture on one screen</h2><div class="lecture-map-grid"><div><h3>Build the map</h3><ul><li><a href="#motivation">Motivation</a> — the price of unstable</li><li><a href="#mental-model">Mental model</a> — two worlds, two schedules</li><li><a href="#file-anatomy-a-frozen-hal-promise">File anatomy: a frozen HAL promise</a> — seven artifacts, one promise</li></ul></div><div><h3>Walk the work</h3><ul><li><a href="#worked-example-freezing-iwelcomelight-at-version-1">Worked example: freezing IWelcomeLight at version 1</a> — freeze it, then try to break it</li><li><a href="#the-three-treble-failures-you-will-actually-meet">The three Treble failures you will actually meet</a> — which artifact is lying?</li></ul></div><div><h3>Make it a habit</h3><ul><li><a href="#lab-guided">Lab (guided)</a> — freeze, break, evolve — legally</li><li><a href="#exercises">Exercises</a> — read the promise</li><li><a href="#go-deeper-kernel-and-app-pointers">Go deeper: kernel and app pointers</a> — from the seam, both ways</li></ul></div><p class="map-note">Lost mid-lecture? The Contents rail on the left (top on a phone) always shows where you are. Each section opens with what it teaches and closes with what you can now do.</p></div></div>

## Motivation
<div class="section-opener"><span class="block-label">In this section</span><p>Lecture 5's working seam carries a quiet liability: <code>unstable: true</code>. This lecture pays that debt — freezing the interface so the two sides can evolve on different schedules without breaking each other.</p></div>

Lecture 5 ended with a working seam and a quiet liability: the interface between `system_server` and `welcomed` is `unstable: true`. That word is a development convenience with a precise meaning — the build makes no promise that tomorrow's system image and yesterday's vendor image agree on what `setEnabled(boolean)` is, which byte order it marshals in, or whether it exists. On a phone that ships as one image, you might never notice.

On a car, where the system side and the vendor side are built by different teams, on different schedules, and updated independently for a decade, "unstable" is not a warning label. It is the bug report, written in advance.

This lecture removes it. The Worked Example freezes `vendor.acme.hardware.welcome` as version 1 of a stable interface, declares it in the device manifest, states the framework's expectation in a compatibility matrix, and then reads the two build failures you get when those artifacts disagree — because VINTF's errors are the sound of Treble working, and engineers who can read them stop fearing the vendor boundary. Lecture 9 gave `welcomed` its SELinux identity and Lecture 5 gave it a client; this lecture gives it a *contract lifetime*.

<div class="section-recap"><span class="block-label">Now you can</span><p>Say what <code>unstable: true</code> costs at shipping time, and what freezing buys the two sides of the seam.</p></div>

## Mental model
<div class="section-opener"><span class="block-label">In this section</span><p>Split the world in two, permanently: the system side updates on the platform's schedule, the vendor side on the BSP's — and Treble's contracts are what let those schedules disagree safely.</p></div>

Split the world in two, permanently. The **system** side (framework, CarService, Lecture 5's service) is updated on the platform's schedule. The **vendor** side (BSP, drivers' userspace, HAL implementations like `welcomed`) ships with the silicon and updates on the vendor's. Treble's rule is that these two worlds may meet *only* through stable, versioned interfaces reached over Binder, never by linking into each other's libraries — because a library link is a promise about internals, and internals are exactly what the other side cannot schedule around.

A stable promise has four parts, and this lecture touches each. The **interface** is the AIDL, frozen into numbered snapshots; version *N*'s bytes are immutable forever, and evolution means adding version *N+1*, never editing *N*. The **implementation** is a process (here `welcomed`) that implements some version and registers it under `interface/instance`.

The **declaration** is the device manifest's claim: "this device provides `IWelcomeLight/default` at version 1." The **expectation** is the framework compatibility matrix's demand: "any device this system image runs on must provide that interface, at a version in this range, or the pairing is invalid." A checker — `libvintf`, exercised at build time by `assemble-vintf` and re-consulted at runtime — compares declaration against expectation and complains, early and in writing, when they disagree.

Version tolerance flows from ranges. The matrix at the pinned tag asks for the light HAL at `2-3`, and upstream's own example implementation declares `2` — and that pairing is *valid*, because 2 is inside the range. Read that twice; it is the whole upgrade economics of Android in miniature. The vendor can ship a v2 implementation for years while frameworks built against v3 stubs run on top, calling only what v2 knows.

Freezing is not about stopping change; it is about making change *additive and legible*, so that "which versions meet here" is a question with a mechanical answer instead of a bench experiment.

<div class="section-recap"><span class="block-label">Now you can</span><p>Draw the two worlds, place any component in its world, and name the contract that lets them meet.</p></div>

<figure class="anchor-figure" role="img" aria-label="Concept anchor: two worlds, one seam"><p class="anchor-title">Concept anchor — two worlds, one seam</p><div class="anchor-stack"><div class="anchor-layer"><strong>System world</strong><span>framework, CarService, Lecture 5's service — platform schedule</span></div><div class="anchor-layer"><strong>The seam — VINTF</strong><span>manifest declares what runs; matrix declares what is required</span></div><div class="anchor-layer"><strong>Vendor world</strong><span>BSP, HAL implementations, <code>welcomed</code> — vendor schedule</span></div></div><figcaption><strong>Read it as:</strong> the two worlds update on different schedules, permanently. The seam is not paperwork between them; it is what makes the disagreement safe.</figcaption></figure>

## File anatomy: a frozen HAL promise
<div class="section-opener"><span class="block-label">In this section</span><p>Seven artifacts carry the frozen promise for <code>welcomed</code> — the AIDL package, its snapshots, the manifest, the matrix. The Worked Example writes or edits all seven.</p></div>

Seven artifacts carry the promise for `welcomed`. The Worked Example writes or edits all seven.

| # | Artifact | Where it lives | Job | If it's wrong |
|---|---|---|---|---|
| 1 | Frozen interface snapshot | `device/acme/kestrel/welcomed/aidl_api/vendor.acme.hardware.welcome/1/…` + `.hash` | Immutable bytes of version 1; the hash is the tripwire | Any later edit to v1 fails the build's API check |
| 2 | Interface module | `welcomed/Android.bp` (`aidl_interface`) | `stability: "vintf"`, `versions_with_info`, backends; generates `…-V1-ndk` / `…-V1-java` | Unstable names, no version in the library, no contract |
| 3 | Consumer wiring | `welcomed`'s `cc_binary` + Lecture 5's `services.core` libs | Depend on the `-V1-` libraries, so a version bump is a visible build event | Linkage rot discovered at runtime, on the car |
| 4 | Manifest fragment | `welcomed/vendor.acme.hardware.welcome.xml`, installed via `vintf_fragments` | Declares name, implemented version, `fqname` to `libvintf` | The HAL works and VINTF has never heard of it |
| 5 | Matrix expectation | acme's framework compatibility matrix fragment | States the version range the system side requires | Nothing checks the pairing until an OTA mixes images |
| 6 | Current (ToT) interface | `welcomed/aidl/…/IWelcomeLight.aidl` | Where the *next* version is developed; builds as the next version's stubs until frozen | Developers edit history instead of appending to it |
| 7 | Registration + policy | `welcomed.rc` (Lecture 4), sepolicy (Lecture 9) | Unchanged by freezing: instance `default`, domain `welcomed` | — (listed so the freeze diff's smallness is visible) |

The row to study is #7's non-change. Freezing is deliberately boring at runtime: same daemon, same registration, same policy, same client code (the generated Java/C++ *package names do not change* with versioning — `vendor.acme.hardware.welcome.IWelcomeLight` in Lecture 5's imports is already the frozen shape). Everything that changes is build plumbing and declarations. Engineers who expect drama from a freeze are usually about to create some.

### Reading upstream's fossil record: the light HAL

Before freezing ours, read a promise that has survived three revisions: `hardware/interfaces/light/aidl/` at the pinned tag. Its `aidl_interface` declares `stability: "vintf"`, `frozen: true`, and `versions_with_info` for versions 1, 2, and 3; beside it, `aidl_api/android.hardware.light/` contains the snapshot directories `1/`, `2/`, `3/`, and `current/`, each a full copy of the interface as of that version. The default implementation consumes `android.hardware.light-V3-rust` — note the `-V3-` in the library name, the version worn on the outside of the artifact — yet its manifest fragment (`lights-default.xml`, installed by the module's `vintf_fragments`) declares `<version>2</version>`.

That is not sloppiness; the fragment declares what that binary actually implements, and it is one version behind the newest stubs it was built beside. Then the expectation side: the framework compatibility matrix (`hardware/interfaces/compatibility_matrices/compatibility_matrix.202604.xml`) requires `android.hardware.light` at `<version>2-3</version>` with instance `default`, no `optional` attribute — mandatory. Implementation offers 2, matrix accepts 2–3, checker approves. Three files, three different version numbers, zero contradiction: this is what a healthy contract looks like from the outside, and your job in the Worked Example is to reproduce exactly this shape at one-tenth scale.

For the legacy dialect, one reading exercise only (Lecture 9's `hwservice_contexts` section was the same bridge): older matrices such as `compatibility_matrix.7.xml` carry `<hal format="hidl">` entries whose versions are HIDL-shaped — `1.0`, `7.0-1` — major.minor with minor ranges, declared against `hwbinder` transports and `lshal`'s view of the world. New work is AIDL, full stop;

but bench hardware and long-lived vehicle programs still speak HIDL, and an engineer who can read both dialects can answer "what does this 2021 head unit promise" without guessing. Reading is a skill; writing HIDL in a new program is a proposal you should expect to defend.

### The checker, up close: two comparisons, not one

"VINTF checks compatibility" is usually said as if one comparison existed. There are two, running in opposite directions, and knowing which one is failing is half of reading any VINTF error. `libvintf`'s own headlines (from `VintfObject.cpp` at the tag) name them: *"Device manifest and framework compatibility matrix are incompatible"* and *"Framework manifest and device compatibility matrix are incompatible."* The first is this lecture's direction: the vendor's declarations (what `welcomed` and its siblings offer) are tested against the framework's expectations.

The second runs the other way: the framework's manifest — the `android.frameworks.*` services the system provides *to* vendor code, framework version facts like the VNDK and system SDK versions — is tested against the *device* compatibility matrix, the vendor's statement of what it requires from the system. A mature product maintains artifacts in both directions; a vendor daemon that calls framework services lives under the second comparison exactly as Lecture 5's service lives under the first.

Mechanically, the checks happen three times in a product's life, and each surface catches a different class of lie. At **build time**, `assemble-vintf` merges the device manifest from its sources (the product's manifest files plus every `vintf_fragments` fragment) and validates the pairing before images ship — Break B in the worked example dies here, which is the kindest place.

At **OTA time**, the update machinery re-validates the *incoming* pairing, because the whole point of the exercise is that system and vendor images with independent histories are about to be combined on a device nobody can bench-test in that exact combination. And **VTS** (Lecture 12) runs the comparison as an explicit test on the shipping device, so a pairing that was assembled by hand-waving still meets the checker before customers do.

Same two files, three gates. When a VINTF failure is reported to you, the first question is always *which gate* — the repair for a build-time assembly gap (fragment not installed) and an OTA-time pairing gap (genuinely incompatible versions) share no steps at all.

Two further expectations ride in the same files, and a contract sheet that ignores them is incomplete: the matrices also carry **kernel** requirements (version ranges and config fragments the device's kernel must satisfy) and **sepolicy version** expectations, checked through the same machinery. They are why "VINTF failure" occasionally indicts a kernel defconfig rather than anything with `hal` in its name.

You will not edit those entries for the welcome light, but you will read past them in every matrix you open, and misreading one as a HAL problem is a rite of passage best completed on paper.

### Reading a matrix like a lawyer

The matrix files reward literal reading. Upstream's directory (`hardware/interfaces/compatibility_matrices/`) holds one file per framework level — `compatibility_matrix.202404.xml`, `.202504`, `.202604`, `.202704`, and the numbered ancestors — because each platform release raises the floor of what its system image may assume about the vendor image it lands on. A product declares the level it launches at, and that level's matrix is the law for its system/vendor pairing for the product's life; later matrices govern later pairings, not yours retroactively.

This is the second half of the two-schedules argument: not only may the sides update independently, the *contract edition* under which they meet is pinned per product, so a 2025 car and a 2027 car can run the same framework generation under different, individually valid promises.

Within an entry, read in this order: `optional` (may the device omit this entirely?), the version range (the floor is the requirement; the ceiling is what this matrix edition has *verified it understands*), then `interface`/`instance` (the exact registration names).

Three pairings against a `2-3` requirement make the arithmetic concrete: a device declaring `2` passes (in range — the light HAL's own situation); a device declaring `4` *fails*, which surprises engineers who assume newer is always safer — the matrix certifies what the framework was tested to tolerate, and an unlisted major version is an unknown wire contract, not a superset; and a device declaring nothing passes only if the entry is `optional="true"`, in which case every consumer of that HAL must have Lecture 5's degraded posture, written down.

When a pairing fails, the matrix entry is the prosecution's exhibit: quote it verbatim in the bug, with the manifest's counter-claim beside it. VINTF bugs are won by whoever reads both files first.

### Instances: why everything in this course ends in `/default`

The trailing `/default` in every fqname is a namespace decision worth understanding before you meet its alternatives. One interface may be implemented by several *instances* — separately registered services under one interface name — when the platform genuinely has several of the thing. The matrix excerpt fetched for this lecture shows the pattern twice in a few lines: the remotely-provisioned-component entry lists `<instance>default</instance>` *and* `<instance>strongbox</instance>` (two hardware backends, one contract), and the media entry accepts `<regex-instance>default[0-9]*</regex-instance>` — a pattern admitting a family of numbered instances.

Rules of the road: `default` is the instance consumers hard-code when exactly one implementation is expected (every HAL in this course); named instances are for hardware multiplicity, never for versioning (versions live in the version machinery — an instance named `v2` is a smell that will outlive the embarrassment); and each instance is registered, labelled in `service_contexts`, and declared separately, because to servicemanager and to `libvintf` they are distinct promises that happen to share a contract.

When a bench unit "has the HAL but clients find nothing," instance-name mismatch — implementation registered `default`, client or manifest asking for something else — is on the shortlist beside policy, and `service list` shows you the truth in one line. The welcome light needs exactly one instance and takes `default` without ceremony; the *review* skill is knowing which of your future HALs will not be so simple (cameras, audio devices, and keymint backends are the usual plural citizens) and keeping instance discipline there from the first commit.

<div class="section-recap"><span class="block-label">Now you can</span><p>Name the seven artifacts of a frozen HAL promise and what each one promises to whom.</p></div>

## Worked example: freezing IWelcomeLight at version 1
<div class="section-opener"><span class="block-label">In this section</span><p>Freeze <code>vendor.acme.hardware.welcome.IWelcomeLight</code> at version 1: snapshot the API, declare the manifest, match the matrix — then prove the freeze by trying to break it.</p></div>

### Step 0: the starting point

Lecture 9's annex, as Lecture 5 left it (Java backend on, cpp off, ndk on):

```
aidl_interface {
    name: "vendor.acme.hardware.welcome",
    vendor_available: true,
    srcs: ["aidl/vendor/acme/hardware/welcome/*.aidl"],
    unstable: true,
    backend: { ... },
}
```

Everything unstable flows from that one word: the generated libraries are `vendor.acme.hardware.welcome-ndk` and `…-java` with no version, any edit to the `.aidl` silently redefines the contract for every consumer at their next build, and nothing anywhere records which contract a given car was built against.

### Step 1: freeze it

From the interface's directory, the freeze is a build target, not a hand edit:

```bash
m vendor.acme.hardware.welcome-freeze-api
```

Per the stable-AIDL documentation (checked for this lecture), `*-freeze-api` does three things: it copies the current interface into `aidl_api/vendor.acme.hardware.welcome/1/` with a `.hash` file fingerprinting it, it rewrites the module's `versions_with_info` to record version 1, and the `unstable` marker gives way to the stability promise. Do not hand-edit `versions_with_info`; the `*-update-api` / `*-freeze-api` targets own that field, and hand-edits are how snapshot trees and build files drift into mutual contradiction. After the freeze, `device/acme/kestrel/welcomed/Android.bp` reads:

```
aidl_interface {
    name: "vendor.acme.hardware.welcome",
    vendor_available: true,
    srcs: ["aidl/vendor/acme/hardware/welcome/*.aidl"],
    stability: "vintf",
    frozen: true,
    versions_with_info: [
        {
            version: "1",
            imports: [],
        },
    ],
    backend: {
        cpp: { enabled: false },
        java: {
            enabled: true,
            sdk_version: "module_current",
        },
        ndk: { enabled: true },
    },
}
```

Field by field: `stability: "vintf"` is the promise itself — this interface may cross the system/vendor boundary and will be checked accordingly. `versions_with_info` is the ledger of frozen versions (ours has one entry; the light HAL's has three, and `imports` records each version's dependencies *as of that version*, which is why historical snapshots stay buildable).

`frozen: true` asserts the working copy currently equals the newest snapshot — the build verifies that claim against the `.hash`, which is the enforcement mechanism behind "never edit a frozen version." And the unglamorous outcome in the tree: `aidl_api/vendor.acme.hardware.welcome/1/vendor/acme/hardware/welcome/IWelcomeLight.aidl`, its `.hash` sibling, and a `current/` snapshot tracking today's working copy.

### Step 2: absorb the rename

Freezing renames the generated libraries to carry the version — upstream's fossil record showed `android.hardware.light-V3-rust`, and ours now generates `vendor.acme.hardware.welcome-V1-ndk` and `vendor.acme.hardware.welcome-V1-java`. Two consumers referenced the unstable names, and the build now fails in both places until they are updated — which is precisely the point: a version event is supposed to be a *visible, reviewable* diff, not a silent relink. In `welcomed`'s `cc_binary`:

```
    shared_libs: [
        "vendor.acme.hardware.welcome-V1-ndk",
        "libbinder_ndk",
        "libcutils",
        "liblog",
    ],
```

and Lecture 5's `services.core` library list trades `vendor.acme.hardware.welcome-java` for `vendor.acme.hardware.welcome-V1-java`. Nothing else moves: `main.cpp`'s `BnWelcomeLight` overrides and Lecture 5's `IWelcomeLight.Stub.asInterface(binder)` are source-identical, because AIDL versioning lives in the build artifacts, not in package or class names.

Say this out loud in review at least once: *freezing changes what the linker resolves, not what the programmer wrote.* When version 2 arrives (the lab adds it), consumers choose their version by library name, and the system can contain `welcomed` built against V1 while `system_server` builds against V2 stubs — the additive-tolerance machine from the mental model, now with your own names on it.

### Step 3: declare it — the device manifest fragment

A frozen interface that nobody declares is a tree-side fact; the running system learns promises from the device manifest. Create `device/acme/kestrel/welcomed/vendor.acme.hardware.welcome.xml`, upstream's fragment shape verbatim (compare `lights-default.xml`):

```xml
<manifest version="1.0" type="device">
    <hal format="aidl">
        <name>vendor.acme.hardware.welcome</name>
        <version>1</version>
        <fqname>IWelcomeLight/default</fqname>
    </hal>
</manifest>
```

Three readings matter. `format="aidl"` selects the AIDL dialect of the promise (the HIDL dialect would carry `transport` and `interface` elements instead). `<version>1</version>` declares what *this binary implements* — when v2 is frozen but `welcomed` still implements v1, this number stays `1`, exactly as upstream's light example declares 2 beside its V3 stubs. And `<fqname>IWelcomeLight/default</fqname>` binds the declaration to the registered instance name, which is why Lecture 4's `.rc` and Lecture 9's `service_contexts` spelling of `…/default` had to match character-for-character. Install the fragment by the binary that keeps the promise, in the same `Android.bp`:

```
cc_binary {
    name: "welcomed",
    ...
    init_rc: ["welcomed.rc"],
    vintf_fragments: ["vendor.acme.hardware.welcome.xml"],
    ...
}
```

At build time `assemble-vintf` merges fragments into the vendor image's manifest; on the device, `libvintf` reads `/vendor/etc/vintf/manifest.xml` plus the fragments under `/vendor/etc/vintf/manifest/`. Fragments are the right granularity for exactly the reason this example shows: the declaration travels with the binary that keeps the promise, so removing `welcomed` from a product removes its manifest claim in the same change — a product-level `DEVICE_MANIFEST_FILE` monolith, by contrast, happily declares HALs the build no longer ships, which is Failure 2 below wearing a build-system costume.

(The same machinery supports SKU-specific manifests — `manifest_{sku}.xml` variants in libvintf's search order — for products whose hardware population genuinely differs by trim; reach for it when the SKUs differ, not before.) Declaration is a build artifact with a runtime address — both halves checkable, as Step 5 does.

### Step 4: state the expectation — the matrix

The mirror artifact lives on the system side: what the framework *requires* of any vendor image it pairs with. acme's system image carries a compatibility-matrix fragment in exactly the upstream FCM dialect (ranges, `interface`/`instance`, `optional`):

```xml
<compatibility-matrix version="1.0" type="framework">
    <hal format="aidl" optional="true">
        <name>vendor.acme.hardware.welcome</name>
        <version>1</version>
        <interface>
            <name>IWelcomeLight</name>
            <instance>default</instance>
        </interface>
    </hal>
</compatibility-matrix>
```

Every element is a decision Lecture 5 already made, now written in VINTF's language. `optional="true"` encodes the service's posture — `WelcomeLightService` degrades to "unavailable" rather than failing the boot, so the honest matrix entry cannot be mandatory; writing `optional="false"` here while the service tolerates absence would make the *checker* stricter than the *product*, and the mismatch would surface as OTA rejections the feature never asked for.

`<version>1</version>` is today a single-version range; the day v2 freezes, this becomes `1-2` on the system side and welcomed's fragment stays truthful at whatever it implements. And the `interface`/`instance` pair restates the fqname's contract from the demanding side: it is not enough that *some* `IWelcomeLight` exist — `default` must exist, because that is the instance every consumer in this course looks up.

### Step 5: build, then verify the promise at its runtime address

```bash
m welcomed services.core        # the contract and both consumers
```

The build runs the VINTF assembly check as part of producing the images; a passing build has already compared declaration to expectation once. On the booted target, verify the promise where the runtime reads it (outputs representative):

```bash
adb shell cat /vendor/etc/vintf/manifest.xml | grep -A4 "welcome"
#     <hal format="aidl">
#         <name>vendor.acme.hardware.welcome</name>
#         <version>1</version>
#         <fqname>IWelcomeLight/default</fqname>

adb shell service list | grep welcome
# ...  vendor.acme.hardware.welcome.IWelcomeLight/default: [vendor.acme.hardware.welcome.IWelcomeLight]
# ...  welcome_light: [com.acme.welcome.IWelcomeLightService]
```

Hold the two commands apart, because they answer different questions and confusing them wastes bench days. The manifest cat proves the *declaration* survived the build and shipped; `service list` proves the *process* registered at runtime (Lecture 9's policy permitting). A device can pass either and fail the other — declaration without registration is a dead daemon or a policy denial; registration without declaration is a working bench unit that the next OTA's compatibility check will reject. The promise is kept only when both lines appear.

<div class="checkpoint"><strong>Checkpoint:</strong> the tree contains the v1 snapshot and <code>.hash</code>; both consumers link <code>-V1-</code> libraries and nothing references the unstable names; the manifest fragment declares version 1 for <code>IWelcomeLight/default</code>; the matrix states the expectation with <code>optional="true"</code>; and on the target, the assembled manifest and <code>service list</code> agree. Five artifacts, five greps, one promise.</div>

Run the pairing drill until it is reflex. With the matrix stating `optional="true"` throughout and ranges as shown, four system/vendor combinations a field fleet will actually produce:

| System image (matrix range) | Vendor image (declared) | Verdict | Why |
|---|---|---|---|
| range `1` | `1` | pass | Exact match — the launch pairing |
| range `1-2` | `1` | pass | Old vendor under new system; Lecture 5's service keeps V1 stubs and full function |
| range `1-2` | `2` | pass | New vendor under new system; brightness available to consumers that moved |
| range `1` | `2` | **fail** | New vendor under old system: 2 is outside `1`, and "newer" earns nothing — the old system never certified it understands v2's wire contract |

Row 4 is the one that generates outage reports written in genuine confusion ("we only *upgraded* the vendor side"), and it is why matrix ranges are widened on the system side *before* — never after — a vendor version starts shipping to that system. Fleets live in rows 2 and 3 for most of their lives; engineering for Treble means keeping those rows boring.

### Step 6: break it twice, and read what the checker says

**Break A — edit history.** Add a method to the frozen v1 working copy in place (insert `void setBrightness(int level);` before `setEnabled`, say) and rebuild *without* freezing a new version. The build now fails its API check: the working copy's fingerprint no longer matches `aidl_api/…/1/.hash`, and the error directs you to the version discipline (representative wording; the mechanism — snapshot hash comparison — is the documented behaviour).

Two repairs exist, and choosing is the engineering: if the change is not yet shipped anywhere, `m vendor.acme.hardware.welcome-update-api` refreshes `current/` while you iterate, and the freeze happens at release;

if v1 has shipped on any car, the method belongs to a *new* version — append it (never insert: method order is the transaction numbering Lecture 5 relied on), freeze v2, and absorb the `-V2-` rename on the consumers that want it. Note that `welcomed` may keep implementing v1 for as long as the matrix range admits 1; "latest" is a build choice, not an obligation.

**Break B — declaration against expectation.** Leave the interface frozen, but make the pairing false: change the manifest fragment's `<version>1</version>` to claim the binary provides a version the matrix does not accept (or delete the fragment outright so nothing is declared) and rebuild. The VINTF assembly step now fails the image build under libvintf's real headline —

```
Device manifest and framework compatibility matrix are incompatible: ...
```

— followed by detail naming the HAL and the offending versions (the detail text is representative here; the headline and the check's location in the build are the documented machinery). Read the failure as the system doing its job *early*: the same disagreement, undetected, is an OTA that bricks the feature pairing or a boot-time rejection in the field. Suppression options exist (weakening the matrix, marking things optional without the product posture to match, disabling checks) and every one of them converts a build error into a field incident.

The correct repair is always to make one of the two artifacts truthful: declare what the binary implements, or require only what the product actually needs.

### Step 7: evolving to version 2 without breaking version 1

Sooner or later someone needs a brighter light: `setBrightness(int level)` must exist. Done under this lecture's discipline, the evolution is a sequence of small, individually reviewable moves, and it is worth walking once at full length because every stable interface you own will repeat it. (1) Edit the *working copy* only — append the method at the end of `IWelcomeLight.aidl`, after `setEnabled`.

Appending is the only legal insertion point: transaction codes are positional (Lecture 5), so a new method takes the next unused code and renumbers nothing. (2) While v2 is in development, the build compiles the working copy as the "ToT" version — consumers who ask for the unversioned development stubs get the new method; consumers pinned to `-V1-` libraries are untouched, and `m vendor.acme.hardware.welcome-update-api` keeps `aidl_api/…/current/` honest so reviewers see the pending diff as a diff.

(3) At release, `m vendor.acme.hardware.welcome-freeze-api` writes snapshot `2/` beside `1/`, fingerprints it, and extends `versions_with_info`; version 1's directory is byte-identical before and after, which the `.hash` lets anyone prove. (4) Each consumer chooses its moment: `welcomed` moves to `-V2-ndk` when it implements `setBrightness` (and its manifest fragment's `<version>` becomes `2` in the same change — declaration and implementation in one commit, so the manifest can never describe a binary that does not exist); Lecture 5's service stays on `-V1-java` until the framework actually wants brightness, then moves deliberately.

(5) The matrix widens to `1-2` on the system side, admitting both field pairings: new-system/old-vendor (service on V1 stubs, daemon on v1 — brightness simply unexposed) and old-system/new-vendor (v1 clients calling transactions 1–2 of a v2 daemon — safe, because appending never moved them). That five-row dance is the complete version-evolution skill. What it never contains: editing snapshot `1/`, renumbering, "just changing" a parameter type in place, or widening the matrix *before* a vendor image exists that satisfies the new range in the field.

Compatibility rules for the interface's contents (which types, enum additions, parcelable field rules) are spelled out in the stable-AIDL documentation; the operational rule from which they all follow is the one above — *history is immutable, the future appends.*

### The working cost of the promise

Freezing is sometimes resisted as ceremony, so price it honestly. Day to day, a frozen interface changes three habits. Interface edits stop being drive-by changes: a method addition is a deliberate act with a snapshot diff for reviewers (`aidl_api/…/current/` makes the pending contract reviewable like code, which most teams grow to like).

Backports split in two: a bug fix in the *implementation* ships freely at any time (the promise never constrained `welcomed`'s internals), while a fix that needs new interface surface queues for the next version — and learning to tell those apart at triage is most of the discipline. And cherry-picks across branches carry a new question — "does this branch's frozen set contain the version this change assumes?" — answerable mechanically from `versions_with_info` instead of from memory.

Against those costs, the alternative's price is Failure 1 below, paid in the field, at OTA scale, with no build log to read. Teams do not freeze because they love process; they freeze because they have read that failure once in production and declined to read it again.

<div class="section-recap"><span class="block-label">Now you can</span><p>Freeze an interface at v1 and prove the freeze holds when someone edits the working copy the wrong way.</p></div>

<figure class="anchor-figure" role="img" aria-label="Concept anchor: how a freeze holds"><p class="anchor-title">Concept anchor — how a freeze holds</p><div class="anchor-flow"><div class="anchor-node"><strong>Working copy</strong>the AIDL you edit</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Snapshot</strong><code>aidl_api/…/1/</code> — the frozen bytes</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Hash</strong>the tripwire over those bytes</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Build check</strong>any later edit to v1 fails the API check</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Consumers</strong>compile against <code>-V1-</code> libraries, safely</div></div><figcaption><strong>Read it as:</strong> the freeze is not a promise to be careful; it is a hash that makes carelessness fail the build. Edit the working copy without re-freezing and the tripwire fires.</figcaption></figure>

## The three Treble failures you will actually meet
<div class="section-opener"><span class="block-label">In this section</span><p>The three Treble failures you will actually meet — a manifest that promises what the device doesn't run, a matrix that asks what the framework can't give, a snapshot edited by hand — each with its tell.</p></div>

**Failure 1: unstable, shipped.** A program skips the freeze under schedule pressure. Everything works — until the first independent update: a system OTA rebuilds Lecture 5's service against a re-generated interface whose method order shifted during unrelated cleanup, while the vendor partition still ships the old daemon.

Binder calls now land on the wrong methods or fail descriptor checks, and the symptom ("welcome light broke after the system update, vendor untouched") is un-debuggable without this lecture's model, because *no file changed on the vendor side and the system side's diff looks innocent*. The freeze is what makes that class of break a build failure instead of a field campaign.

**Failure 2: the promise drifts in one artifact.** The interface is frozen properly, the daemon updated to v2, but the manifest fragment still declares 1 (or vice versa). Declaration lies are the quietest Treble bugs: everything on the bench works, because the runtime only needs the registration; the lie detonates at the next compatibility gate — `assemble-vintf` on a future build, an OTA pre-check, or VTS (Lecture 12 runs the same comparison as a test).

The debugging habit from Step 5 — declaration grep and registration grep, both, every time — exists because each artifact alone will happily confirm a lie the other would have caught.

**Failure 3: declared, frozen, and invisible at runtime.** Manifest correct, matrix satisfied, build green — and Lecture 5's service reports `hal=unavailable`. Work the layers in the order this course built them: registration (`service list` — if absent, Lecture 9's `add`/`find` grants and Lecture 4's class/start are the suspects), declaration (manifest cat — present, or Step 3's `vintf_fragments` never installed it and the green build was assembling a manifest for a *different* product), and expectation (only relevant at build/OTA gates, never to a running service's lookup).

Engineers who start at VINTF for a runtime absence waste the day; VINTF failure modes are gates, Binder/policy failure modes are runtime, and the symptom tells you which family you are in before you open a file.

<div class="section-recap"><span class="block-label">Now you can</span><p>Read a Treble failure's tell and name the artifact that is lying: manifest, matrix, or snapshot.</p></div>

## Lab (guided)
<div class="section-opener"><span class="block-label">In this section</span><p>Freeze, break, and evolve the interface on <code>kestrel_auto</code>: make the promise, violate it deliberately, then evolve it the legal way — with every claim citing a path.</p></div>

**Tier 1 — read the fossil record (~1 h, tree only).** For `android.hardware.light` at the pinned tag, produce the contract sheet: (1) the `versions_with_info` entries and what each snapshot directory proves; (2) which version the default implementation *declares*, and the file that proves it; (3) the matrix's required range and mandatory/optional posture; (4) one sentence explaining why 2, 3, and 2–3 are simultaneously true. Checkpoint: every claim cites a path, and claim (4) uses the word "range" correctly.

**Tier 2 — freeze, break, evolve on kestrel_auto (~2–3 h).**
1. Perform Step 1's freeze on the kestrel interface. Checkpoint: snapshot + `.hash` exist, `versions_with_info` records v1, and `m welcomed` builds against the `-V1-ndk` name with zero source changes in `main.cpp`.
2. Reproduce Break A (edit v1 in place). Checkpoint: you capture the API-check failure, then repair by `update-api` discipline and can state the rule that decides update-api versus a new version.
3. Reproduce Break B by declaring a version outside the matrix (restore afterward). Checkpoint: captured failure shows the libvintf headline, and you can name which artifact you made lie and why the bench runtime would *not* have caught it.
4. Evolve properly: append `void setBrightness(int level);`, freeze v2, update `welcomed` to implement and declare v2, widen the matrix to `1-2`. Checkpoint: build green; `-V1-` and `-V2-` libraries both exist; Lecture 5's service still links `-V1-java` and — the point of the exercise — still works against the v2 daemon, because v2 only appended.

**Tier 3 — bench reading (30 min).** On any real head unit (or an emulator image), open `/vendor/etc/vintf/manifest.xml` and choose one AIDL HAL: name its interface, declared version, and instance; then find the corresponding matrix expectation in the tree and state whether the pairing passes, with the range arithmetic shown. Checkpoint: your verdict is mechanical, not vibes.

*Verification status: frozen-interface shape, snapshot layout, versioned library naming, `vintf_fragments` installation, manifest/matrix dialects, freeze tooling semantics, libvintf's incompatibility headline, and on-device manifest paths checked against `android-17.0.0_r1` and the official stable-AIDL documentation (see `docs/verification/lecture-06-source-truth.md`). The kestrel interface, fragment, and matrix entries are fictional teaching artifacts in upstream's shapes; Tier 2 was not executed as a Cuttlefish build in the authoring environment.*

<div class="section-recap"><span class="block-label">Now you can</span><p>Freeze, break, and legally evolve the welcome interface, citing a path for every claim you make.</p></div>

## Exercises
<div class="section-opener"><span class="block-label">In this section</span><p>Exercises in contract reading: decode a versioned library name, judge a manifest against a device, and explain a freeze hash failure to the teammate who caused it.</p></div>

1. VINTF assembly fails after a vendor drop. Name the two artifacts you compare first, and for each side state what "too old" and "absent" mean mechanically.
2. A HAL method exists in the daemon, the interface is frozen, and `service list` shows the registration — yet Lecture 5's service stays `unavailable`. Order your checks across Lectures 4, 5, and 9 before touching VINTF, and say why VINTF is last.
3. A teammate proposes skipping the freeze and pinning both sides to "the same git SHA forever." Give the two-schedules argument in four sentences: what breaks first, and which Android mechanism exists because of it.
4. The matrix requires `2-3`, the device's newest implementation declares `2`, and a manager asks why the team is "behind." Write the three-sentence answer that ends the meeting.
5. During v2 development, a developer inserts the new method alphabetically (second position) in the working copy "for tidiness," freezes, and ships. Existing v1 clients break. Explain, in transaction terms, what the insert did, and the review rule that prevents it.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. Device manifest (fragment-merged, at `/vendor/etc/vintf/manifest.xml` on the target) versus framework compatibility matrix. Manifest-side "too old": the declared `<version>` falls below the matrix range's floor — the binary implements less than the system requires. Manifest-side "absent": no `<hal>` entry at all, usually a missing `vintf_fragments` installation rather than a missing HAL. Matrix-side reading: a range that starts above everything any shipping vendor image declares makes every pairing invalid, which is why matrix edits are reviewed like API changes.
2. Registration first (Lecture 9: does `service list` show it — already given — and does the *descriptor* match, i.e. is the running binary actually built from the frozen interface), then process/class health (Lecture 4: `init.svc.welcomed` running, not crash-looping), then the client (Lecture 5: is the service past phase 500, is `mConnectHal`'s name string character-identical to the registered fqname, do the counters show attempts), then policy (Lecture 9: a `find` denial in the log). VINTF is last because a *running* lookup never consults it: libvintf gates builds and OTAs, while runtime absence is always registration, naming, lifecycle, or policy. Reaching for the manifest first confuses the gate with the road.
3. Look for: the two partitions update on independent schedules (a security OTA cannot wait for a vendor respin; a BSP drop cannot wait for a framework train); a shared SHA pins *source*, not the *shipped pairing* — cars in the field span years of combinations; the first break is a silent wire-protocol drift after any interface-adjacent cleanup, discovered by customers; and stable AIDL + VINTF exists precisely to convert that drift into build-time, versioned, range-checked events. Bonus: "forever" does not survive a single emergency patch.
4. Sample: "The matrix asks for any version from 2 to 3; this device provides 2, which is inside the range, so the pairing is valid by design. Version 3 exists as stubs for consumers that choose it, but Treble's contract is additive tolerance, not latest-version compliance. We would be behind only if the matrix floor moved to 3, at which point the manifest — not opinion — tells us."
5. AIDL method order is the transaction numbering: v1 clients call method 2 expecting `setEnabled`'s descriptor and arguments. Inserting at position 2 renumbers every method after it, so a v1 client built against the frozen stubs now invokes a different method with the same code (or marshals arguments into the wrong shape and fails the descriptor/ parcel checks). Because the developer *froze after inserting*, v2's snapshot itself enshrines the break — the hash machinery enforces immutability, not compatibility. The review rule: interface diffs are append-only, read positionally, and any diff that shows a mid-file insertion or an edit to an existing signature is rejected unread, however tidy.

</details>

<div class="section-recap"><span class="block-label">Now you can</span><p>Judge a HAL promise against a running device and explain a freeze failure from its hash, not its noise.</p></div>

## Go deeper: kernel and app pointers
<div class="section-opener"><span class="block-label">In this section</span><p>Below the HAL sits the hardware path it drives; above it, the framework consumers the freeze protects. Both pointers start from the seam you now own.</p></div>

Below the HAL sits the hardware path it drives — for the vehicle signal source itself, the [kernel path]({{ '/kernel-path/' | relative_url }}) steps 3–4 (bus drivers, device trees) are the reading order, and Lecture 7 climbs from this lecture's frozen boundary up through CarService to the app-facing property model.

If a feature request ever suggests an app should link or call a vendor interface directly, this lecture is the refusal: apps meet the car through Lecture 7's curated properties and Lecture 5's governed services, never through the raw contract the vendor signed with the system.

<div class="callout"><p><strong>Working with AI agents:</strong> agents are fluent in AIDL and cheerful about editing frozen files, because nothing in the text of an interface says <em>immutable</em>. Brief them with the ledger instead: the snapshot path, the current version, and the rule that diffs append. Then verify two things mechanically — that no file under <code>aidl_api/…/&lt;frozen-version&gt;/</code> changed, and that the manifest's declared version matches what the implementation binary actually implements. Version questions are where agents blend unstable and frozen conventions most smoothly; the <code>.hash</code> and the manifest are the referees.</p></div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Follow the vehicle signal below the HAL and the consumers above it, from the seam outward.</p></div>
