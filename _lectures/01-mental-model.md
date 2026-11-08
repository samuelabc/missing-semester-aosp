---
number: 1
title: "The AOSP mental model and source anatomy"
subtitle: "What Android Automotive actually is, where the code lives, and how to read a tree you will never finish reading."
reading_time: "~40 min read, plus lab"
lab_time: "2–3 h"
---

## Motivation

New OEM engineers lose their first month to disorientation, not difficulty. The tree is over 200 GB with source and history. The build has its own language. Half the directories look identical, and exactly one of them is the one your product uses. People say "just look in frameworks" as if that narrowed anything down. Meanwhile the answers are all *in the building* — in the tree itself — for anyone who can read it faster than the questions arrive.

This lecture is the map and the habit. The map: four layers, a dozen directories, one running example that will thread through the whole course. The habit, worth more than the map: never guess where something lives when code search can tell you in seconds — and never trust a document (including this one) over the tree it describes. Every later lecture assumes both. Lecture 2 will hand you a product to build; this one makes sure you know what a product *is* before you lunch it.

A note on what this lecture deliberately does not do: it creates nothing. Its two Worked Examples are reading expeditions — one up a real upstream feature (HVAC fan speed), one across the fictional product this course will build — because orientation is a reading skill before it is a writing one. By the end you will be able to take any feature name anyone says in a meeting ("the fan," "the welcome light," "seat heating") and produce the chain of files that implements it, marked with the lectures that will teach you to change each hop.

## Mental model

Think of AAOS as four layers you will touch in very different amounts:

| Layer | What it is | Where it lives | How often you change it |
|---|---|---|---|
| Vehicle & kernel | SoC, drivers, device tree (mostly vendor-owned) | `kernel/`, vendor trees | Rarely; through interfaces |
| HAL / vendor | Treble HALs, Vehicle HAL, board configuration | `hardware/`, `device/`, your `vendor/` additions | Often on a program |
| Framework & system services | `system_server`, CarService, platform services | `frameworks/`, `packages/services/Car/` | Weekly |
| Product & apps layer | Your product config, overlays, system apps | `device/<vendor>/<product>/`, `packages/apps/Car/` | Daily |

Three distinctions keep the map honest. **AOSP is not "Android" the product**: AOSP is the open-source project — the reference implementation of the middle layers plus the rules binding all four (Treble interfaces, VINTF, the CDD, CTS/VTS). What ships on a phone or a car is a *delta stack*: upstream AOSP, then your SoC vendor's BSP delta against it, then your OEM product delta against that. Most debugging, across your whole career, is establishing *which delta introduced the behaviour you are staring at* — Lecture 12 turns that sentence into a protocol. **AAOS is not a fork**: Android Automotive OS is AOSP configured and extended for vehicles, its centre of gravity the car stack in `packages/services/Car` plus the vehicle HAL contracts in `hardware/interfaces/automotive/`. And **the Google apps/services layer is not in the tree at all**: no amount of searching finds GMS in AOSP, which settles many meeting arguments before they start.

Three sentences that will carry you far, one per lecture-cluster to come. *Android is not one program; it is hundreds of processes that mostly meet over Binder* (Lectures 5–7 live inside this sentence). *Almost everything configurable is decided at build time by product makefiles and Soong modules, then refined at runtime by overlays and properties* (Lectures 2, 8, 11 are its three tenses: built, overlaid, updated). And *the tree is the documentation of last resort: when docs and behaviour disagree, the tree — plus a log — wins* (Lecture 10 is the dispute-resolution procedure). This course pins its tree to `android-17.0.0_r1` so that "the tree" is a specific, checkable object: every path in every lecture either exists at that tag or is labelled as ours.

Finally, the course's own delta, which the rest of the lectures build: a fictional car product, `device/acme/kestrel` (product `kestrel_auto`), whose welcome-light feature touches all four layers exactly once each. You will create every piece of it; the names are frozen now so the artifacts can accumulate (Worked Example B is its map).

## What "system level" means here (and what it excludes)

This course's boundary deserves one explicit paragraph, because you will feel its edges. *System level* means the platform an OEM actually shapes: product definition, boot, services and HAL contracts, vehicle integration, customization, security policy, debugging method, update machinery, and compliance proof — the layers where a car program's differentiation and its disasters both live. It excludes, deliberately, three neighbouring crafts. Kernel internals matter at their interfaces (drivers surface as HALs and device trees; the [kernel path]({{ '/kernel-path/' | relative_url }}) sequences that reading for when you need it). App development matters at its governed seams (permissions, privileged status, car APIs — Lecture 8 and the [app path]({{ '/app-path/' | relative_url }})). And the Google services layer is absent by construction, as established above. The boundary is not a judgment about importance; it is the observation that nobody teaches this middle, while both neighbours have shelves of material. When a topic pulls you across the boundary mid-lecture, the Pointer Tracks are the sanctioned crossings.

One directory tour makes the boundary concrete. `packages/services/Car` — the automotive platform in one project — contains: `car-lib/` (the API surface apps and system components compile against: `Car`, the managers, `VehiclePropertyIds`), `service/` (CarService itself: the brokers like `CarPropertyService`, power, garage mode, the shell command), `car_product/` (the product makefiles Lecture 2 inherited — the car stack as a *build input*), and `tests/` (upstream's own CarService tests, Lecture 12's template family). API, implementation, product wiring, proof: four subdirectories that are this course's four questions (what's promised, what runs, what ships, what proves it) asked of one component. Learn to give that four-part answer for any directory you are handed and the tree stops being a maze and becomes an index.

## Anatomy: reading a tree you will never finish

Get the pinned tree ([Setup]({{ '/setup/' | relative_url }}) has exact commands and machine guidance), then orient at the top level:

```bash
repo init -u https://android.googlesource.com/platform/manifest -b android-latest-release
repo sync -c -j8
ls
# art bionic bootable build cts device external frameworks hardware kernel
# libcore packages pdk prebuilts system test tools vendor   (representative)
```

Nobody reads this tree; you *interrogate* it. The dozen directories worth memorizing on day one, each with the lecture that owns it: `build/make` + `build/soong` (the build system — Lecture 2), `frameworks/base` (framework and the `system_server` services — Lectures 5, 8), `frameworks/native` (Binder userspace, SurfaceFlinger), `system/core` (`init`, `logcat`, toolbox — Lectures 4, 10), `system/sepolicy` (the policy build — Lecture 9), `hardware/interfaces` (Treble interface definitions — Lectures 6, 7), `packages/services/Car` (CarService and the car platform — Lecture 7), `packages/apps/Car` (car system apps — Lecture 8's neighbours), `device/google/cuttlefish` (the reference target every lab can run — Lectures 2, 3), `cts` and `test/` (the compliance suites — Lecture 12), and `tools/` + `development/` (the daily instruments — Lecture 3). Everything else is found by search, on demand, which brings us to the habit:

```bash
# Who defines the car power service? (class -> file, no wandering)
grep -rn "class CarPowerManagementService" packages/services/Car/service/src --include=*.java
# Which files reference one vehicle property, end to end?
grep -rn "HVAC_FAN_SPEED" hardware/interfaces/automotive/vehicle packages/services/Car/car-lib --include=*.aidl --include=*.java | head
```

Use [cs.android.com](https://cs.android.com/) when you lack a local index; the skill transfers 1:1. Cross-referencing beats directory intuition at this scale — learn your editor's "find references" and `rg` fluency here, because it compounds for your whole career (the same argument MIT's Missing Semester makes for the shell, one directory up).

Two search disciplines separate seniors from searchers. Search for *definitions* before *usages* (the class, the `<permission>` element, the AIDL method — one definition, many usages; reading usages of an undefined-in-your-head name is how afternoons evaporate), and search for *the string the system prints* when chasing behaviour: log tags, `dumpsys` section headers, and error strings are unique in the tree in a way class names are not, so the fastest route from a symptom on a screen to the file that produced it is usually the symptom's own text. Lecture 10 professionalizes this into evidence handling; the seed of it is here: every observable string is a search key the system hands you for free.

Reading a manifest is the other orientation skill. `.repo/manifests/default.xml` lists every project, its path in the tree, and its revision; `repo list | wc -l` counts the projects (hundreds — the "one tree" is a federation). When a vendor says "our drop is based on the Q2 release," the manifest plus `repo manifest -r` (which pins every project to an exact commit) is how that claim gets verified instead of nodded at. Lecture 11's release discipline starts here: a build you cannot name by manifest and fingerprint is a rumour with binaries.

### From directories to a running car: the second anatomy

The directory map is only half the anatomy; the other half is knowing where a file *goes*. Every source path has an installed destination and, often, a process that embodies it — and reading any Android system fluently means translating between the three without hesitation. The shapes (each owned by a later lecture):

| Source shape | Installed shape | Running shape |
|---|---|---|
| `frameworks/base/services/…` (Java) | `system` image, framework jars | inside `system_server` (one process, many services) |
| `packages/services/Car/service/…` | `system` image | the car process (CarService + friends) |
| `hardware/interfaces/…` (AIDL) | contract only — no binary | the seam itself; implementations live elsewhere |
| a `cc_binary` in a device tree (your `welcomed`) | `/vendor/bin/welcomed` | its own process, started by `init` (Lecture 4) |
| product makefiles + overlays (`device/acme/kestrel/…`) | spread across `system`/`vendor`/`product` images | decisions, already made by boot time (Lectures 2, 8) |
| `system/sepolicy` + device `sepolicy/` | compiled policy on `vendor`/`system` | the rules every process above is judged by (Lecture 9) |

Two consequences to internalize now. The tree's organization (by *project*) and the device's organization (by *partition* and *process*) are different projections of the same system, and fluency is switching projections: a bug in "CarService" is a file in `packages/services/Car`, a section in `dumpsys car_service`, a process in `ps`, and a delta in exactly one of upstream/BSP/product. And the images are the unit of update (Lecture 11): the `system` and `vendor` projections can be replaced independently, which is precisely why the seam between them (Treble contracts, Lecture 6) is load-bearing. When in doubt about where a thing lives, ask which projection the question is in.

### Reading a manifest, concretely

One XML file deserves a slow read on day one, because it defines what "the tree" even is. `.repo/manifests/default.xml` (representative excerpt, structure real):

```xml
<manifest>
  <remote name="aosp" fetch="https://android.googlesource.com/" />
  <default remote="aosp" revision="refs/tags/android-17.0.0_r1" sync-j="4" />
  <project path="frameworks/base" name="platform/frameworks/base" />
  <project path="packages/services/Car" name="platform/packages/services/Car" />
  <project path="device/google/cuttlefish" name="device/google/cuttlefish" />
  <!-- …hundreds more… -->
</manifest>
```

Three columns carry the whole federation: `name` (the repository), `path` (where it lands in your checkout — the two differ often enough that confusing them wastes real afternoons), and the effective `revision` (here inherited from `<default>`: the pinned tag, so every project in this course's tree is the same historical instant). `repo manifest -r` rewrites this with each project's exact commit SHA — that output, saved beside a build, is the difference between "the Q2 drop" as a claim and as a fact. Two habits follow. When a path in a document doesn't exist in your tree, check the manifest before doubting the document: the project may land at a different `path`, or your sync may predate its inclusion. And when a supplier's tree "is the same release," diff the two `repo manifest -r` outputs; the delta list *is* the BSP, enumerated — the first honest sentence in most vendor conversations.

## Worked Example A: trace HVAC fan speed to the metal (upstream, read-only)

Every AAOS feature is a chain of the same shape: an app-facing API, a service, a HAL contract, a property, hardware. Learn the shape on a feature you will never break — HVAC — by walking it with searches, top to bottom, naming the file at every hop. (Paths verified at the pinned tag; this exact grep-led walk is Tier 1 of the lab.)

**Hop 1 — the property is a number, and the number is an address.** In `hardware/interfaces/automotive/vehicle/aidl_property/android/hardware/automotive/vehicle/VehicleProperty.aidl`, upstream defines the canonical property list. The fan lives there:

```
HVAC_FAN_SPEED = 0x0500 + 0x10000000 + 0x05000000 + …
```

Read it as composition, because Lecture 7 will teach you to *write* such numbers: `0x0500` is the property's unique ID within its family; `0x10000000` is the SYSTEM group (platform-owned, as opposed to VENDOR `0x20000000` where yours will live); `0x05000000` selects the HVAC area type; the elided term is the value type. The car library mirrors the result as a Java constant — `car-lib/src/android/car/VehiclePropertyIds.java` carries `public static final int HVAC_FAN_SPEED = 356517120;` — because apps and services speak in names while the wire speaks in integers. Already the first professional lesson: *one fact, two representations, generated from the definitions* — when they disagree, the AIDL is the truth and the mirror is stale.

**Hop 2 — the HAL contract.** Below the property sits the Vehicle HAL interface (`IVehicle.aidl`, same directory family): CarService asks it for property configs (`getAllPropConfigs`), values (`getValues`/`setValues`), and subscriptions. On the reference target the implementation is the emulated VHAL, whose property configs — which properties exist, their access and change modes — are declared in JSON (`DefaultProperties.json` under `automotive/vehicle/aidl/impl/current/`). Fan speed exists on your emulator because a JSON entry says so; on a real car because the vendor's HAL implements the config against actual blower hardware. Same contract, different truth underneath: that sentence *is* Treble.

**Hop 3 — the service.** `packages/services/Car/service/src/com/android/car/CarPropertyService.java` is CarService's property broker: it owns the client registrations, enforces per-property permissions, and shuttles values between the HAL below and API clients above. It runs inside the car process, started with the rest of CarService — a privileged platform component, not an app, which is why this lecture's layer table puts it in framework territory despite the car badge. Hold one caution from Hop 2 alongside it: on the reference target the *values* are emulated — the JSON can declare any fan speed the test wants, and Tier 3 of the lab will happily show you a blower that does not exist. That is a feature for learning (the chain is real even when the wind is fake, and Lecture 7's injection verbs exploit exactly this), and a standing warning for debugging: on emulated targets, verify the chain and distrust the physics; on real cars, reverse it.

**Hop 4 — the API.** `car-lib` completes the chain: `android/car/hardware/property/CarPropertyManager.java` is the general property API (register a callback, get/set typed values), and `android/car/hardware/hvac/CarHvacManager.java` is the HVAC-shaped convenience layer above it. An HVAC app never touches the HAL, the integer, or (knowingly) CarPropertyService: it calls a manager, and four layers of contract carry the request to a fan.

Write the chain as one line, because the capstone will grade you on producing exactly this for a feature of your own:

`HVAC app → CarHvacManager/CarPropertyManager (car-lib) → CarPropertyService (CarService) → IVehicle (HAL contract) → VHAL property HVAC_FAN_SPEED (0x15400500) → blower`

<div class="checkpoint"><strong>Checkpoint:</strong> given only the words "HVAC fan speed," you can name the defining AIDL file, the service class, both API classes, and the property's integer value — and say which hop a fan-related bug report belongs to before reading its logs.</div>

One asymmetry in that chain generalizes to every vehicle feature you will ever debug, so learn it on the fan. The chain carries two directions with different physics: *commands* flow down (an app sets a target temperature — the write-side twin property, `HVAC_TEMPERATURE_SET`, same algebra) and *truth* flows up (the actual fan speed and cabin temperature are whatever the hardware reports, on the hardware's schedule). The service and API layers are deliberately asymmetric about this: a `set` is a request the HAL may take time to honour, while `get`/subscription delivers the last *reported* value, which is why Lecture 5's service design ("returns after the request is accepted, not after the LED is lit") and Lecture 7's change modes (ON_CHANGE vs continuous) are agreements about time, not just data. When a user reports "the display says 22° but the cabin is freezing," the chain gives you the differential for free: display truth comes from the reported value (up-chain), cabin truth from the actuator (below the HAL) — and the five hops tell you the four places the two can divorce.

## Worked Example B: the welcome chain — this course's vertical slice

Now the same shape, on the product you will build. The feature: when the driver door opens, a welcome light lights. Trivial as a demo; complete as a curriculum — it touches every layer exactly once, and each hop is one lecture's Worked Example. Nothing below exists yet; the table is a *promissory map*, and its last column is the lecture that redeems each row.

| Hop | Artifact (frozen name) | What it is | Created in |
|---|---|---|---|
| Product | `device/acme/kestrel/`, `kestrel_auto` | the lunchable product that assembles everything | Lecture 2 |
| Boot | `welcomed.rc` | init script starting the daemon in the right phase | Lecture 4 |
| HAL daemon | `/vendor/bin/welcomed` (domain `welcomed`) | native service implementing the contract | Lectures 9 (policy), 4 (rc) |
| Contract | `vendor.acme.hardware.welcome.IWelcomeLight/default`, frozen v1 | stable AIDL + VINTF declaration | Lecture 6 |
| Vehicle signal | `ACME_DOOR_STATE` = `0x26200C10` | vendor vehicle property (door areas) | Lecture 7 |
| Car-side decider | `WelcomeLightController` (car process) | translates door events into light decisions | Lecture 7 |
| Gatekeeper service | `welcome_light` (`WelcomeLightService` in `system_server`) | permission checks, counters, `dumpsys` | Lecture 5 |
| App | `com.acme.welcome` | privileged companion app, platform-signed | Lecture 8 |
| Policy | `device/acme/kestrel/sepolicy/vendor/` | the `.te` and contexts that let exactly the right domains talk | Lecture 9 |
| Proof | `VtsHalWelcomeLightTargetTest` + behaviour tests | contract and feature, witnessed failing | Lecture 12 |

Read the table twice. Top-down it is the feature: door property → controller → service → daemon → lamp, with the app as a second, governed client. Bottom-up it is the course: each row's "Created in" is a lecture, in dependency order (the product before the daemon can ship, the contract frozen before consumers harden, the policy written against real callers). Lectures 10 and 11 wrap the chain rather than extend it — 10 breaks it three ways on purpose, 11 ships its updates — and the capstone assembles the whole table from a blank checkout. Keep this page: when a later lecture's file seems unmotivated, find its row.

Two orienting contrasts with Worked Example A. Upstream's chain is *given* — you read it to learn the shape; the welcome chain is *yours* — same shape, but every seam is a decision you will defend (why a vendor property and not a system one; why a system service between apps and HAL; why the daemon's audience list has one entry). And upstream's names are discovered by search, while yours were frozen in advance (GLOSSARY.md) — because a course, like a product, needs its interfaces named before its teams start; Lecture 6 shows what freezing costs and buys when the names harden into contracts.

That glossary deserves one sentence of respect now, because you will lean on it for twelve lectures: it is this course's `aidl_api` snapshot — the names (`kestrel_auto`, `welcomed`, `IWelcomeLight/default`, `ACME_DOOR_STATE`, the rest) are frozen so that artifacts produced months apart in lecture-time still compose. When a name in a later lecture looks arbitrary, it is a frozen decision, not a whim; when you build the capstone, the glossary is the bill of materials' spelling checker. Products work identically: the naming *is* an interface, and it is cheapest to freeze before the second team starts spelling.

### Read the same chain backwards: the census of a running system

The chain also reads bottom-up, on a live target, and the bottom rung is a census. `adb shell service list` on any AAOS system prints the Binder phone book — every registered system service, numbered (representative excerpt):

```
Found 171 services:
0    car_service: [android.car.ICar]
1    welcome_light: [com.acme.welcome.IWelcomeLightService]   <- ours, Lecture 5
…
97   vendor.acme.hardware.welcome.IWelcomeLight/default: […]  <- ours, Lecture 6
```

Set the fictional rows aside (they are the course's future tense); the skill is reading the real ones as an org chart. Each line answers Lecture 4's question — *who survived boot and registered* — and the count itself is orientation data: a phone-class system and a car system differ visibly here (`car_service` and its kin exist on exactly one of them). `adb shell ps -A | grep -E "car|system_server"` complements the census with process reality: several of those 171 services share one process (`system_server` hosts dozens; CarService is its own), which is why "which process owns it" and "which service name answers" are different questions with different tools — `service list` for the name, `dumpsys` for the state, `ps` for the process. Lecture 3 turns this census into a daily session; for now, the habit is enough: when handed any running Android system, your first five minutes are its census, not its UI.

## Five disorientations and their cures

The traps every newcomer hits in month one, each with the habit that dissolves it. (1) **Two files, one name.** Search returns `IWelcomeLight.aidl` three times — working copy, `aidl_api/…/1/`, `aidl_api/…/current/` (Lecture 6). Cure: read the path, not the filename; snapshots are fossils, the working copy is the animal. (2) **Product, device, and lunch name are three strings** (Lecture 2's checkpoint): `kestrel_auto`, `kestrel`, `vsoc_x86_64_only` can all be "the target" in one sentence and mean different things. Cure: ask "as lunch combo, `PRODUCT_NAME`, or `PRODUCT_DEVICE`?" until it stops being necessary. (3) **The docs describe a different tag.** Source pages track the latest release; your tree is pinned. Cure: the tag on the tree outranks the date on the page — this course's verification docs exist because of this trap. (4) **Searching for what cannot be here** — a Google service, a supplier daemon, last year's path. Cure: the manifest read above; absence is checkable, not a feeling. (5) **"The car app" that is a service, the "service" that is an app** — packaging (APK vs native binary) and architecture (client vs gatekeeper) are independent axes. Cure: for any component, state its process, its Binder name if any, and its callers — three facts that fit on one line and end most taxonomy arguments.

Read the table once more as a *dependency graph*, because that is how it will fail in your hands if the order is violated. The daemon cannot ship before the product exists to package it (2 before 9); the interface cannot freeze before its one real consumer's needs are known (5's service before 6's freeze consumes the annex's unstable draft); the policy cannot be written before the callers exist to be named in it (5 and 7 before 9's audience list); the tests cannot assert contracts that haven't been stated (everything before 12). Real programs discover these edges as schedule pain — the HAL team waiting on a product skeleton, the security review with no callers to enumerate — and the course's order is simply the dependency graph made visible in advance. When your own program's plan looks different, that is fine; when it violates an edge, name the edge and the workaround, the way Lecture 11 names the moment rollback stops being free. Unnamed dependency violations are where quarters go.

## How the course is ordered (and how to read any Android system from now on)

The lectures follow the OEM lifecycle — define the product, boot it, give it services and contracts, connect the vehicle, customize, secure, debug, ship, prove — rather than the layer diagram, because that is the order in which your decisions constrain each other on a real program. But the *reading* skill this lecture installs is order-free, and it is the actual takeaway. Faced with any Android behaviour, ask three questions in sequence: **which process owns it** (Binder's world: find the service, `service list` is its phone book), **which file decided it** (build-time truth: product config, manifest, policy — grep beats memory), and **which layer's delta introduced it** (upstream, BSP, or yours — the comparison habit Lecture 12 formalizes). A question you cannot route to one of those three is not yet a technical question; it is still a meeting.

The two Pointer Tracks hang off this map without disturbing it. Kernel topics (`kernel/`, drivers, GKI) matter to this course only where they surface as interfaces — the [kernel path]({{ '/kernel-path/' | relative_url }}) sequences that reading. App topics matter where cabin apps meet the platform's governed seams — the [app path]({{ '/app-path/' | relative_url }}) does the same upward. Both are deliberately sequenced *after* the system core, because the core is what the pointers point into.

How to take the course itself, briefly. Read linearly the first time: the welcome chain accumulates, and later lectures spend artifacts earlier ones minted (a reader who skips Lecture 6's freeze will meet its `-V1-` library names as unexplained vocabulary in 9 and 12). Thereafter, read problem-first: the lectures are independently enterable through their Worked Examples, and the capstone is the intended second pass — assembly as comprehension check. Either way, keep the two Worked Examples of this lecture open beside you; every subsequent file you meet has a row in one of their tables, and orientation, once earned this way, does not need earning twice.

## The tree across time

One more reading skill, because you will inherit trees with birthdays. The pinned tag is a photograph; the tree also keeps its own sedimentary record, and three strata repay reading. The `aidl_api/` snapshots (Lecture 6) are the interface fossil record: each numbered directory is a contract as of its freeze, so `diff` between snapshot directories *is* the interface's changelog, more honest than any release note. The compatibility matrices (`hardware/interfaces/compatibility_matrices/compatibility_matrix.<year>.xml`) are the pairing record: which vendor promises each framework generation may assume, one file per year — a product's chosen matrix is its contract edition for life (Lecture 6 again; Lecture 11's anti-rollback calendar is the same idea wearing a timestamp). And `git log` inside any single project is the narrative record: `repo forall -c 'git log --oneline -3'` across a delta's projects will usually find the week a behaviour changed, which is why Lecture 10's loop starts captures with the fingerprint — time-travel begins from knowing *when* you are. Read history the way you read the live tree: by following one named thing (a property, a service, a permission) through the strata, not by browsing. The course returns to each stratum with tools; today, know they exist and that "how did this get here" is always an answerable question.

## From a sentence in a meeting to a list of files

The whole lecture in one procedure, worth practising until it is reflexive. Someone says: *"Seat heating takes ten seconds to respond."* Convert it, out loud, before touching a keyboard. *Process:* seat heat is a vehicle property like the fan (same broker, `CarPropertyService`), so the owners are the HVAC/property chain of Worked Example A with a different property name — find it (`grep -rn "SEAT" …/VehicleProperty.aidl` — upstream's seat-heat properties live beside the fan's). *File:* the write path for that property runs app → manager → service → HAL; the ten seconds hide in exactly one hop's hop-time, so the reading list is the five files of the chain, no others. *Delta:* does the reference target show the same latency with the emulated VHAL? If not, the suspicion orders itself: vendor HAL implementation first (it's the delta), service and upstream last. Three questions, and a vague complaint became a file list, a comparison, and a suspect — in the meeting, before the ticket was filed. That conversion, performed fluently, is what senior platform engineers are actually for; everything else in this course is depth charges for particular hops.

## Lab (guided)

**Tier 1 — the HVAC trace, in your tree (~45 min).** Reproduce Worked Example A without looking: starting from `grep -rn "HVAC_FAN_SPEED" hardware/interfaces/automotive/vehicle packages/services/Car`, produce the five-hop chain with a file path per hop. Checkpoints per hop: the AIDL entry (note its composed value), the emulated VHAL's JSON, `CarPropertyService`, `CarPropertyManager`, `CarHvacManager`. Then trace the write direction once: find `HVAC_TEMPERATURE_SET`'s definition and state, in two sentences, how its journey differs from the fan's (who originates it, what "success" means at the HAL, why the displayed value can legitimately lag the request). Deliverable: both one-line chains, written from memory, then verified against the tree — discrepancies are the lesson, so record them rather than fixing quietly.

**Tier 2 — the welcome map, against the course (~45 min).** Take Worked Example B's table and, for each row, find the lecture passage that creates the artifact and write its exact path as the lecture gives it (e.g. which file in `device/acme/kestrel/` Lecture 2 registers first; the service name Lecture 5 publishes). Then run the frozen-name audit: every bold name in the table should appear in `GLOSSARY.md` verbatim. Checkpoint: ten rows, ten paths, zero names that differ by so much as an underscore — you have just rehearsed the capstone's bill of materials. If a row's lecture hasn't been read yet, mark it *promissory* rather than guessing its contents; the distinction between "verified in the tree," "stated by a lecture I have read," and "promised by a table" is the epistemic hygiene the whole course runs on, and Tier 2 is where you start keeping those three piles separate on paper.

**Tier 3 — connect names to running processes (~30 min, any AAOS target).** On an emulator or Cuttlefish instance: `adb shell service list | grep -i car` and identify three car-related registrations; `adb shell dumpsys car_service | head` and find the property service's section (read the first screen slowly: upstream dumps are structured as service-by-service confessions, and recognizing *which* subsection belongs to `CarPropertyService` — versus power, versus input — is the census skill at section granularity); `adb shell cmd car_service list-vhal-props | head` (representative verb per Lecture 7) and find `HVAC_FAN_SPEED`'s integer from Tier 1 among the living properties; finally `adb shell ps -A | grep car` and state which process hosts the services you found, reconciling the census's two projections (names vs processes) in one line each. Checkpoint: one upstream property, traced from AIDL definition to a running system's own report of it, and the hosting process named — the map and the territory, reconciled.

*Verification status: property algebra, HVAC constants, API and service paths checked against `android-17.0.0_r1` or carried from Lecture 7's verified table (see `docs/verification/lecture-01-source-truth.md`). The welcome chain is the course's fictional product, presented as a preview; each artifact is created and verified in its own lecture.*

## Exercises

1. Find where `SystemServer` starts CarService. Name the file and what decides whether it starts.
2. Explain, in three sentences to an imaginary new hire, the difference between `frameworks/base` and `packages/services/Car`.
3. Using `repo forall -c 'git log --oneline -1'`, pick three projects and state what each contributes to an AAOS build.
4. A colleague says "the fan bug is in the app." Using Worked Example A's chain, list the five hops you would check, in the order this lecture's three questions imply, and the observable at each.
5. Take one claim from this lecture's tables and check it against your tree (or the pinned tag online). Report: confirmed, or differs — with the reason the difference is data, not failure.
6. Your search for `IWelcomeLight.aidl` returns three paths in a future tree. State what each one is, which you edit, and what breaks if you edit the wrong one.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. `frameworks/base/services/java/com/android/server/SystemServer.java` — CarService is started from the system server's service-start sequence, conditional on the device being automotive (the car feature/package presence check). The reading skill being graded: framework entry point first, condition second, both found by following the class name with search rather than by browsing.
2. Look for: `frameworks/base` is the generic Android framework every Android device shares (the services and APIs phones use too); `packages/services/Car` is the automotive platform layer — CarService, car-specific services and managers — layered on top and present because the product is a car. A change in the first affects every Android form factor; a change in the second is (mostly) vehicle business. Bonus precision: car *apps* live elsewhere again (`packages/apps/Car`), which is why "car code" is three addresses, not one.
3. Any three with a correct one-line contribution each (e.g. `platform/frameworks/base` — framework and `system_server`; `platform/packages/services/Car` — CarService and car APIs; `platform/hardware/interfaces` — the Treble contracts). The command prints each project's latest commit; the exercise grades whether the *contribution statement* matches the project's path, not the commit.
4. Order by the three questions: (process) is the value moving at all — observe the property on the running system (`cmd car_service get-property-value` / `list-vhal-props`, Lecture 7's verbs); (HAL truth) does the VHAL hold/emit it — the config in Hop 2's JSON or the vendor HAL; (service) does `CarPropertyService` broker it — `dumpsys car_service`'s property section; (API) does the manager deliver it — the app-facing callback path in `car-lib`; (app) does the app render it. Only after all five acquit themselves is "the app" an evidence-based sentence. Answers that start at the app layer have confused the *symptom's* address with the *cause's*.
5. Grading looks for: the claim quoted, the path or command used, and the verdict. A "differs" answer earns full marks when it names the tag/tree difference (release drift, BSP delta, product overlay) — per the lecture, that difference is the first datum of real debugging, and recording your baseline is the difference between drift and mystery.
6. The three paths are the working copy beside the interface definition (the only editable truth), `aidl_api/<package>/1/` (the frozen v1 snapshot — editing it rewrites history and the freeze hash check will convict you at build time), and `aidl_api/<package>/current/` (the managed mirror of the working copy, updated by the `update-api` tooling, not by hand). Edit the working copy; let the tooling maintain `current/`; let the freeze create snapshots. Editing a snapshot by hand produces an interface that claims a version it never froze — the exact silent-drift failure Lecture 6 exists to prevent.

</details>

## Go deeper: kernel and app pointers

Kernel side: everything under `kernel/` is interface territory for now; the [kernel path]({{ '/kernel-path/' | relative_url }}) starts with how GKI changes what "customizing the kernel" even means, and it will make most sense after Lectures 6–7 have given you contracts to look below. App side: notice `packages/apps/Car` exists but resist reading it as "apps"; those are system components wearing APK packaging, and Lecture 8 treats them that way. The [app path]({{ '/app-path/' | relative_url }}) orders the rest, from Lecture 8 onward.

<div class="callout"><p><strong>Working with AI agents:</strong> agents are good at the habit and bad at the map. Ask one to find every file referencing a property or service (that is search — then verify with <code>grep</code>, because the citation is the deliverable), but never accept a layer claim, a "this lives in frameworks" claim, without the path opened in front of you. An answer that cannot show you the file did not find anything; it guessed in a confident font. On this lecture's material especially: make the agent produce the five-hop chain with paths, and check the paths yourself — the checking is the course.</p></div>


