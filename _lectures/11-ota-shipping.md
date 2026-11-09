---
number: 11
title: "OTA, partitions, and shipping"
subtitle: "A/B slots, dynamic partitions, update_engine, verified boot, and the discipline of not bricking cars."
reading_time: "~40 min read, plus lab"
lab_time: "3–4 h"
---

<div class="lecture-map"><span class="block-label">Lecture map</span><h2>The whole lecture on one screen</h2><div class="lecture-map-grid"><div><h3>Build the map</h3><ul><li><a href="#motivation">Motivation</a> — promises made to a fleet</li><li><a href="#mental-model">Mental model</a> — three mechanisms, interlocked</li><li><a href="#the-instrument-panel-what-you-can-observe-before-touching-anything">The instrument panel: what you can observe before touching anything</a> — observe first, at fleet stakes</li></ul></div><div><h3>Walk the work</h3><ul><li><a href="#worked-example-a-the-kestrel-slot-sheet">Worked Example A: the kestrel slot sheet</a> — the slot sheet, derived</li><li><a href="#worked-example-b-an-ota-between-two-kestrel-builds">Worked Example B: an OTA between two kestrel builds</a> — the crossing, proved</li><li><a href="#worked-example-c-rehearse-the-rollback-before-the-fleet-does">Worked Example C: rehearse the rollback before the fleet does</a> — rehearse it, or discover it</li><li><a href="#worked-example-d-release-signing-and-avb-in-full">Worked Example D: release signing and AVB, in full</a> — keys, vbmeta, refusal</li><li><a href="#release-discipline-around-the-machinery">Release discipline around the machinery</a> — process shaped like the machine</li></ul></div><div><h3>Make it a habit</h3><ul><li><a href="#lab-guided">Lab (guided)</a> — sheet, crossing, drills</li><li><a href="#exercises">Exercises</a> — the launch verdict</li><li><a href="#go-deeper-kernel-and-app-pointers">Go deeper: kernel and app pointers</a> — underneath the slots</li></ul></div><p class="map-note">Lost mid-lecture? The Contents rail on the left (top on a phone) always shows where you are. Each section opens with what it teaches and closes with what you can now do.</p></div></div>

## Motivation
<div class="section-opener"><span class="block-label">In this section</span><p>Every earlier lecture ended on a bench you could walk over to. This one ends on vehicles you will never touch again, where an update is a promise made to a fleet — so the machinery is rehearsed, never improvised.</p></div>

Every earlier lecture ended on a bench: a daemon you could restart, a policy you could reload, a car you could walk over to. This one ends somewhere else — on vehicles you will never touch, in driveways and depots, where your update arrives over a metered connection, applies beside a sleeping 12 V battery, and either boots or makes the evening news. OTA is where system work becomes irrevocable, which is why it is taught last among the build topics and first in every post-mortem.

The good news: the machinery is designed for exactly this fear. Modern AAOS updates are A/B (every partition exists twice), verified (every byte the bootloader loads is signed), and rehearsed (rollback is a mechanism, not a hope). The bad news: the machinery only protects programs that understand it.

Teams brick fleets not by writing bad payloads but by misunderstanding which key signed what, by shipping a build whose rollback index forbids retreat, or by discovering — in production — that "it boots" and "the car works" are different claims and their health gate only checked the first.

By the end of this lecture you will have produced the slot sheet for the course's own product, generated a real OTA payload between two `kestrel_auto` builds, applied it to the inactive slot, proved the slot switch with your own instruments, rehearsed two kinds of rollback, and closed the last open item on Lecture 9's security map by doing release signing and verified boot properly: `BOARD_AVB_ENABLE`, vbmeta chains, rollback indexes, and the key ceremony that ties them to the builds from Lecture 2 and the app certificates from Lecture 8.

<div class="section-recap"><span class="block-label">Now you can</span><p>Say why OTA discipline is rehearsal discipline, and what a bench can prove that a fleet never forgives.</p></div>

## Mental model
<div class="section-opener"><span class="block-label">In this section</span><p>Three mechanisms interlock — A/B slots, dynamic partitions, verified boot with its rollback calendar — and every shipping disaster is one of them misunderstood.</p></div>

Three mechanisms interlock, and every shipping disaster is one of them misunderstood.

**Slots.** Partitions that matter exist in two copies, suffixed `_a` and `_b`. The running system boots one slot; the other is the spare. An update never modifies the running system — it writes the *inactive* slot, marks it active, and the bootloader tries it on the next reboot. Slot health is tracked in metadata the bootloader and the boot-control HAL share: each slot has a priority, a *tries remaining* counter the bootloader decrements on each unproven boot, and a *successful* flag.

A new slot that keeps failing to boot spends its tries and the bootloader falls back to the old slot by itself. A new slot that boots gets its successful flag set — and from that moment, automatic rollback is over. Remember the shape: **fallback is free until the success mark lands; after it, the new slot owns the car.**

**Verified boot.** Before any of that, the bootloader verifies what it is about to run. Android Verified Boot (AVB) chains signatures: the top-level `vbmeta` image vouches for some partitions directly and delegates others to *chained* vbmeta images (`vbmeta_system`, `vbmeta_vendor_dlkm`, …), each with its own key and its own **rollback index** — a number that must never go backwards. The device stores the highest rollback index it has ever seen, per index location, in tamper-evident storage the bootloader trusts.

An image signed correctly but carrying an old rollback index is refused like a forgery, because from the bootloader's chair that is what a downgrade attack looks like. Verified boot is therefore also your anti-rollback enforcement, whether you planned it that way or not.

**The state machine.** `update_engine` does the writing. A client hands it a payload (`payload.bin` plus its properties), it streams the payload into the inactive slot's partitions (on Virtual A/B devices, into copy-on-write snapshots layered over them), verifies hashes and the payload's signature, sets the active slot, and reboots you into the bootloader's judgment. After the new slot boots, `update_engine` completes its post-reboot checks and asks the boot-control HAL to mark the slot successful (in the source: `boot_control_->MarkBootSuccessfulAsync(...)` in `aosp/update_attempter_android.cc`).

On virtual A/B, the snapshot merge then folds the copy-on-write data into the real partitions; until the merge finishes, the device is mid-metamorphosis and the next update must wait.

**The health contract.** Notice what the bootloader can judge: signatures, rollback indexes, and whether boot *completes* within its tries. It cannot judge whether `CarService` works, whether your welcome light lights, or whether the car is a car. *Boot success is the bootloader's claim;

system health is yours.* A shipping program installs a health gate after every update — this course has been building one since Lecture 5 — and keeps the success mark hostage until the gate passes. That gap, between the mark the platform offers automatically and the evidence your gate demands, is where fleet incidents live.

<div class="section-recap"><span class="block-label">Now you can</span><p>Name the three mechanisms, what each one guarantees, and the disaster that follows from misunderstanding it.</p></div>

<figure class="anchor-figure" role="img" aria-label="Concept anchor: A/B slots, in one picture"><p class="anchor-title">Concept anchor — A/B slots, in one picture</p><div class="anchor-cols"><div class="anchor-col"><strong>Slot A — running</strong>the build the car booted; untouched while an update lands</div><div class="anchor-col"><strong>Slot B — updated</strong>the new build, written in the background and marked bootable</div><div class="anchor-col"><strong>Bootloader — judge</strong>tries B, verifies it, and falls back to A if B fails to prove itself</div></div><figcaption><strong>Read it as:</strong> an update never touches the system that is running the car. The bootloader is the referee, and rollback is its whistle — rehearsed in Worked Example C.</figcaption></figure>

## The instrument panel: what you can observe before touching anything
<div class="section-opener"><span class="block-label">In this section</span><p>OTA work is Lecture 10's loop with higher stakes: observe first. The panel — slots, groups, rollback indexes, fingerprints — is also your post-update verification and your rollback evidence.</p></div>

OTA work is Lecture 10's loop with higher stakes: observe first, because the observation tools are also your post-update verification and your rollback evidence. The panel (all verified against the pinned tree; outputs representative):

```bash
# update_engine is running and registered under its binder name:
adb shell service list | grep -i update
# android.os.UpdateEngineService  (system/update_engine, aosp/binder_service_android.h)

# which slot am I running, and is this a virtual A/B device?
adb shell getprop ro.boot.slot_suffix        # _a or _b
adb shell getprop ro.virtual_ab.enabled      # true on the reference target

# the build I am standing on (Lecture 10: fingerprint first, always)
adb shell getprop ro.build.fingerprint

# update_engine's own narration, while it works
adb logcat -b all -d | grep -i update_engine | tail -n 30
```

`update_engine_client` is the control surface — a thin client over that binder service. The flags that matter for this lecture: `--update` with `--payload=` (and `--headers=` carrying the payload's properties: hashes and sizes of payload and metadata), `--offset=`/`--size=` to address a payload inside a larger package, `--verify` to rehearse verification without applying, `--switch_slot=true|false` to control whether the newly written slot becomes active on reboot, `--cancel` and `--reset_status` for aborting states, `--merge` for the virtual-A/B snapshot merge, and `--follow` to stream progress instead of guessing.

Statuses flow back through the same interface as named states — downloading, verifying, finalizing, *updated-need-reboot*, and, on the unhappy path, *attempting-rollback*. You will read all of these as evidence in the Worked Examples; none of them require a rebuild to interpret, which is the point of an instrument. Two of them deserve promotion from trivia to habit.

`--verify` rehearses payload verification *without committing the device* — run it against every payload a supplier hands you before it earns an apply window; a payload that cannot verify on the bench was never going to verify in a driveway. And `--reset_status` / `--cancel` are how a wedged update state is cleared *deliberately*, with the state machine's knowledge, rather than by the field-expedient of wiping partitions and hoping the bootloader shares your optimism.

A failed update you can read — status, log tail, slot suffix, fingerprint — is Lecture 10's loop again: the evidence tells you whether you are looking at a bad payload (verification), a bad slot (fallback), or a bad gate (sick but marked), and each of those has a different owner.

<div class="checkpoint"><strong>Checkpoint:</strong> given a running car, you can state its slot, its build fingerprint, whether it is virtual A/B, and whether an update is mid-flight — four facts, four commands, before any decision is made.</div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Read the instrument panel on any build and state its slot, space, and rollback position before touching anything.</p></div>

## Worked Example A: the kestrel slot sheet
<div class="section-opener"><span class="block-label">In this section</span><p>Extract kestrel's slot sheet from the real board-config chain: 8 GiB of super, the dynamic-partition groups, five AVB rollback-index locations, and the SPL timestamp that serves as the anti-rollback clock.</p></div>

Lecture 2 ended with a warning: kestrel's `BoardConfig.mk` `-include`s Cuttlefish's board file, "everything Cuttlefish's board config asserts — partition sizes, kernel arrangements — is now asserted for kestrel… Lecture 11 returns to the partition entries with that lens." This is the return. The deliverable is a **slot sheet**: one page that states, for your product, every partition, which slot scheme it lives under, how it is verified, and what updates it.

It is the document a release review actually argues about. Follow the chain down (`device/acme/kestrel/BoardConfig.mk` → `device/google/cuttlefish/vsoc_x86_64_only/BoardConfig.mk` → `device/google/cuttlefish/shared/BoardConfig.mk`) and read the partition half at the pinned tag. It asserts (`shared/BoardConfig.mk`, verbatim where quoted):

* **A/B is on:** `AB_OTA_UPDATER := true`, and `AB_OTA_PARTITIONS` enumerates everything an OTA may write: `boot`, `init_boot`, `vendor_boot`, `system`, `system_ext`, `product`, `vendor`, `odm`, `system_dlkm`, `vendor_dlkm`, `odm_dlkm`, and the vbmeta family (`vbmeta`, `vbmeta_system`, `vbmeta_system_dlkm`, `vbmeta_vendor_dlkm`).
* **Two kinds of partition live in two kinds of place.** Standalone partitions have fixed sizes: `BOARD_BOOTIMAGE_PARTITION_SIZE := 67108864` (64 MiB, same for `vendor_boot`; `init_boot` gets 8 MiB). Everything else lives inside one 8 GiB `super` partition (`BOARD_SUPER_PARTITION_SIZE := 8589934592`) as *dynamic partitions*, in two groups with size ceilings: `google_system_dynamic_partitions` (6,845,104,128 bytes ≈ 6.375 GiB: `system`, `system_ext`, `product`, `system_dlkm`) and `google_vendor_dynamic_partitions` (1,472,200,704 bytes ≈ 1.37 GiB: `vendor`, `vendor_dlkm`, `odm`, `odm_dlkm`). There is also a `metadata` partition (`BOARD_USES_METADATA_PARTITION := true`) — where virtual A/B keeps its snapshot bookkeeping.
* **Virtual A/B is on, by product inheritance**, not by those board lines: the chain pulls in the platform's `target/product/virtual_ab_ota/launch.mk` (`PRODUCT_VIRTUAL_AB_OTA := true`, `ro.virtual_ab.enabled=true`), and Cuttlefish's `shared/device.mk` tunes it (`PRODUCT_VIRTUAL_AB_COMPRESSION_METHOD := lz4`, `PRODUCT_VIRTUAL_AB_COW_VERSION := 3`). Updates are written as copy-on-write (COW) snapshots that live in `super`'s free space and merge into the real partitions after the new slot proves itself.
* **Verified boot is on, with a chain:** `BOARD_AVB_ENABLE := true`, algorithm `SHA256_RSA4096` throughout, and *five* rollback-index locations in use — location 1 rides with `vbmeta_system` (chaining `product system system_ext`), 2 with `boot`, 3 with `init_boot`, 4 with `vendor_dlkm`, 5 with `system_dlkm`. Every one of those indexes is `$(PLATFORM_SECURITY_PATCH_TIMESTAMP)`: on this target, **the security-patch date is the anti-rollback clock**. And the keys at every one of those locations are a published test key, `external/avb/test/data/testkey_rsa4096.pem` — correct for a reference target, disqualifying for a product (Worked Example D fixes it).

Draw the sheet (this is the artifact; keep yours in the device directory next to `BoardConfig.mk`):

| Partition(s) | Where | Slotted | Verified by (rollback location) | Updated by OTA |
|---|---|---|---|---|
| `boot`, `vendor_boot` (64 MiB), `init_boot` (8 MiB) | standalone | `_a`/`_b` | chained vbmeta (loc 2, 3 for boot/init_boot) | yes |
| `system`, `system_ext`, `product`, `system_dlkm` | super, system group (≤6.375 GiB) | logical `_a`/`_b` | `vbmeta_system` (loc 1), dlkm chained (loc 5) | yes |
| `vendor`, `vendor_dlkm`, `odm`, `odm_dlkm` | super, vendor group (≤1.37 GiB) | logical `_a`/`_b` | top vbmeta + chained (loc 4) | yes |
| `vbmeta`, `vbmeta_system`, `vbmeta_system_dlkm`, `vbmeta_vendor_dlkm` | standalone | `_a`/`_b` | top vbmeta signs the chain roots | yes |
| `metadata` | standalone | no | — (system-writable state) | no |
| `userdata` | standalone | no | — (your data; survives OTA) | never |

Read the sheet like a reviewer and four questions answer themselves. *Where does COW live?* In `super`'s unallocated space — so the space math for every release is: system group + vendor group + worst-case COW (every changed block, until merge) ≤ 8 GiB; that is why group ceilings exist and why a "small" feature that grows `system` can block an update two releases later.

*Which bytes does an attacker need to forge?* A vbmeta chain root — everything else is vouched for transitively. *What makes last month's build uninstallable?* Its rollback indexes: equal SPL, fine; older SPL, refused at the bootloader regardless of signatures. *What survives an update?* `userdata` and `metadata` — which is why Lecture 8's baked-in product choices can never be patched by a data migration, and why migrations are written against the oldest fielded build, not the last one.

<div class="checkpoint"><strong>Checkpoint:</strong> from the sheet alone you can answer: if `vendor` outgrows its group, which line do you change and what do you check before changing it? (The vendor group's `..._SIZE` ceiling — after verifying `super` still has room for system group + COW headroom; the check is arithmetic on the sheet, not a build option.)</div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Derive a product's slot sheet from its board config, with a citation a colleague can re-derive without you.</p></div>

<figure class="anchor-figure" role="img" aria-label="Concept anchor: where the update lands"><p class="anchor-title">Concept anchor — where the update lands</p><div class="anchor-stack"><div class="anchor-layer"><strong>boot, vendor_boot, init_boot</strong><span>standalone partitions, slotted <code>_a</code>/<code>_b</code>, chained vbmeta</span></div><div class="anchor-layer"><strong>system group in super</strong><span><code>system</code>, <code>system_ext</code>, <code>product</code>, <code>system_dlkm</code> — logical slots inside 8 GiB</span></div><div class="anchor-layer"><strong>vbmeta chain</strong><span>rollback-index locations 1–5, with the SPL timestamp as the anti-rollback clock</span></div></div><figcaption><strong>Read it as:</strong> every partition is either slotted, verified, or both — the slot sheet above names which. An OTA writes the idle slot of each and lets the bootloader judge the result.</figcaption></figure>

## Worked Example B: an OTA between two kestrel builds
<div class="section-opener"><span class="block-label">In this section</span><p>Two builds, one payload, one slot switch: run an OTA crossing on kestrel with a deliberately boring delta, and prove the crossing with the panel at every step.</p></div>

Two builds, one payload, one slot switch, proved with the panel. The cast is Lecture 2's product; the delta between builds is deliberately boring — in OTA work, boring is a virtue.

**Build N.** From Lecture 2's tree, unchanged except that release discipline starts here: build the way you would ship it, and keep the artifacts Lecture 10 will one day demand.

```bash
source build/envsetup.sh
lunch kestrel_auto-ap4a-userdebug
m dist        # module-fast normally; dist when target-files are the deliverable
ls out/dist/ | grep target_files
# kestrel_auto-target_files-<build-id>.zip   (representative name)
```

`m dist` runs the full build and then packages *target-files*: the signed-later intermediate that contains every partition image plus the metadata the OTA tools need (partition lists, AVB arguments, the build fingerprint). Two rules attach: archive the target-files and the build's `symbols/` tree under the build's fingerprint (Lecture 10: a release crash without its symbols is an unsymbolized shrug), and record the fingerprint — `ro.build.fingerprint` is the name every later step will check against.

**Build N+1.** Change something small and *provable*: bump a welcome-stack marker. In `device/acme/kestrel/kestrel_auto.mk`, alongside Lecture 2's properties, add one line (fictional acme file, real mechanism):

```make
# OTA rehearsal marker: bumped per build so a slot switch is provable by getprop
PRODUCT_VENDOR_PROPERTIES += ro.acme.build.mark=2
```

Rebuild with `m dist` and archive again. Two target-files zips now sit on disk, differing by one property and one build fingerprint. That tiny delta is the entire test fixture — everything else in this example is machinery.

**Generate the payload.** `ota_from_target_files` (in `build/tools/releasetools/`) diff-or-copies the target-files into `payload.bin` + `payload_properties.txt`, then signs the package with the OTA package key (`tools/releasetools/ota_utils.py` signs with `OPTIONS.package_key`; on a `userdebug` course tree the default is the tree's public test key — Worked Example D replaces it for release):

```bash
# full OTA (simplest correct thing; --incremental_from=<N target-files> makes deltas)
ota_from_target_files \
  out/dist/kestrel_auto-target_files-<N+1>.zip \
  out/dist/kestrel-Nplus1-ota.zip

mkdir -p /tmp/ota-inspect && cd /tmp/ota-inspect && unzip -o ../kestrel-Nplus1-ota.zip
ls
# payload.bin  payload_properties.txt  (an A/B package is mostly payload)
cat payload_properties.txt
# FILE_HASH=…  FILE_SIZE=…  METADATA_HASH=…  METADATA_SIZE=…   (the --headers material)
```

Read the package before it ever meets a device (the habit from the v1 of this lecture, now with files): which partitions the payload touches (the sheet says: only `AB_OTA_PARTITIONS` members, each landing on the inactive slot), full vs incremental (`--incremental_from=` trades server CPU and fragility for bytes; for a first rehearsal, full), and whether a *partial* OTA would do (`--partial=` exists, and the reference board even publishes a default partial list in `BOARD_PARTIAL_OTA_UPDATE_PARTITIONS_LIST` — partial updates are how you ship a vendor-only fix without re-shipping the world, and how you regret it when the untested combination bricks; earn them later).

**Apply.** Stage the payload on the device and hand it to `update_engine`, following along:

```bash
adb push payload.bin payload_properties.txt /data/ota_package/
adb shell update_engine_client --update --follow \
  --payload=file:///data/ota_package/payload.bin \
  --headers="$(cat /data/ota_package/payload_properties.txt)"
# [INFO] … update state: DOWNLOADING → VERIFYING → FINALIZING → UPDATED_NEED_REBOOT
```

(The `file:///data/ota_package/` staging is the bench rehearsal path; production delivery downloads over HTTPS and passes an offset/size into the package — same payload, same engine.) When it reports *updated-need-reboot*, three facts are banked: the inactive slot now contains build N+1, its hashes and signature verified *during* the write (a corrupted download dies here, on the bench, not at boot), and the boot-control HAL has been told which slot is active. Nothing has been risked yet: the running car is still build N.

**Reboot and prove the switch.** This is the lecture's money step, and it is pure Lecture 10 — capture, compare, conclude:

```bash
adb shell getprop ro.boot.slot_suffix     # _a  (the slot build N runs from)
adb reboot
adb wait-for-device
adb shell getprop ro.boot.slot_suffix                    # _b
adb shell getprop ro.build.fingerprint                   # build N+1's fingerprint
adb shell getprop ro.acme.build.mark                     # 2
adb shell dumpsys welcome_light | head -5                # the feature survived the crossing
adb shell service list | grep welcome                    # both registrations present
```

Slot flipped, fingerprint changed, marker is 2, and the whole welcome chain (Lectures 5–7) answers on the new build.

Then the two quiet completions: `update_engine` finishes its post-reboot verification and marks the slot successful (the `MarkBootSuccessfulAsync` call from the Mental model), and the virtual-A/B snapshot merge folds the COW into the real partitions — check it before declaring victory, because *while a merge is pending, the device is not yet fully on slot _b*, and the next OTA must not start (the client exposes the merge via `--merge`, and the boot-control HAL reports it via `getSnapshotMergeStatus`).

Name the exact moment rollback stopped being automatic: **when the success mark landed.** Before it, a sick build spends bootloader tries; after it, slot _b is simply the truth and retreat becomes a new (signed, higher-or-equal-index) OTA. Every rehearsal and every incident review in this space is, at bottom, someone discovering which side of that line they were standing on.

<div class="checkpoint"><strong>Checkpoint:</strong> you have watched one update cross: payload verified during write, slot marker flipped at reboot, fingerprint and marker property proving the new build, instruments proving the feature, and the success mark + merge closing the door behind you. If any step's evidence is missing from your notes, the rehearsal isn't done.</div>

### When the merge is the incident

The least-rehearsed moment in virtual A/B is after apparent success: the new slot booted, the mark landed, and the snapshot merge is folding COW blocks into the real partitions in the background — work that can outlive the drive cycle that triggered it. Interrogate three properties before your first release depends on them.

*Is the car safe mid-merge?* Yes by construction: the snapshots are the truth until merge completes, so the device boots and runs from slot _b with COW layered in; a power cut mid-merge costs time, not correctness, and the merge resumes rather than restarts from zero.

*Can the next update start?* No — and this is the operational bite: an update attempted against a pending merge is refused or queued behind it, so a fleet that updates weekly but merges slowly has an effective cadence set by its slowest merge, not by your release train.

Watch the merge state (`getSnapshotMergeStatus` on the boot-control HAL; the client's `--merge`) the way Lecture 10 watches counters: a fleet report that says "updated" but means "merging for nine days" is a Lecture 10 category error wearing this lecture's clothes — *now* confused with *mechanism*.

*What if the merge itself fails?* Then the device is stuck mid-metamorphosis on a booted slot, and the honest options are the ones the state machine offers — let it retry, or accept a rollback to the old slot while the snapshots still make that possible — which is why merge health belongs in the post-update gate next to the success mark, not in a quarterly cleanup.

State the rule for your program in the release doc: **an update is done when the merge is done**, and every dashboard, ring-advance criterion, and "can we ship the next one" conversation inherits that definition.

<div class="section-recap"><span class="block-label">Now you can</span><p>Run an OTA crossing between two builds and prove each stage — payload, switch, first boot — from the panel.</p></div>

## Worked Example C: rehearse the rollback before the fleet does
<div class="section-opener"><span class="block-label">In this section</span><p>Rollback is a behaviour you rehearse on the bench or discover in the field; there is no third option. Two drills, one for each failure class the Mental model separates.</p></div>

Rollback is a behaviour you *rehearse on the bench* or *discover in the field*; there is no third option. Two drills, one for each failure class the Mental model separates. Both are described from the verified machinery (rows 6, 7, 11 of the source-truth doc); running them is Tier 2's job, because an unrun rehearsal plan is fan fiction.

**Drill 1 — the new slot cannot boot (verified boot + tries do the work).** Apply build N+1 as above, but first break one byte in the inactive slot's boot image (direct partition write on your bench target, or an N+1 build with a deliberately corrupted `boot` image in its target-files). Reboot. What the bootloader sees: the `boot` partition's bytes no longer match the hash chained from `vbmeta` (location 2's chain) — verified boot refuses the slot.

What happens next needs no human: the slot's tries burn or the slot is marked unbootable outright, and the bootloader boots slot _a, build N, the last thing known to work. Your evidence: `ro.boot.slot_suffix` still `_a`, the fingerprint is build N's, and `update_engine` reports the failed attempt in its log (the *attempting-rollback* state exists for exactly this narration).

**The lesson is the absence of lessons:** no page was woken, no procedure improvised — the mechanism kept its promise because the promise was structural, made of hashes and counters rather than someone's 3 a.m. judgment. The drill's output is a stopwatch and a log, and both go in the release file.

**Drill 2 — the new slot boots and is sick (your health gate earns its salary).** Now make N+1 *bootable but wrong*: the welcome service crash-loops, say (Lecture 10's Break 2 in production clothes). Walk the uncomfortable truth first: the bootloader is *satisfied*. Boot completed; if nobody intervenes, `update_engine`'s post-reboot flow marks the slot successful and the fleet ships the sickness — the v1 version of this lecture's Exercise 2, now with names. The bootloader cannot save you; only the health contract can. Design it concretely:

* **Who judges:** a post-boot health check owned by the program (in real AAOS programs, gated with vehicle state — a parked car in garage mode, not a driver mid-route; `packages/services/Car/service/src/com/android/car/garagemode/` is CarService's designed maintenance window).
* **Evidence it demands:** this course's panel, promoted to policy — boot completed, `CarService` alive, `dumpsys welcome_light` answering with sane counters, no fresh tombstones, the door→light chain responding to one stimulus. Exactly Lecture 10's first fifteen minutes, running as a gate instead of a human.
* **The lever it pulls on failure:** while the slot is unproven, retreat is cheap by design — your gate asks the boot-control HAL to re-activate the old slot (or mark this one unbootable via `setSlotAsUnbootable`) and reboots; the HAL surface from the Mental model (`isSlotMarkedSuccessful`, `setActiveBootSlot`) exists for precisely this conversation. The one thing the gate must never do is let the success mark land on a sick build "to see if it recovers" — after the mark, retreat costs a full new OTA with rollback indexes pointing the wrong way.

**Anti-rollback: the third failure class, rehearsed by reading.** Neither drill above was about *version*, and that is deliberate, because the version failure needs no drill — it is arithmetic from Worked Example A. All five rollback-index locations take the SPL timestamp. A build with an older security-patch level therefore carries smaller rollback indexes; once any fleet car has booted a newer build, its tamper-evident storage holds the larger numbers, and the older build is refused *even with perfect signatures* — verified boot doing counter-intelligence on your own release process.

Consequences to internalize: you cannot retreat across an SPL boundary, ever; a "quick rollback to last month's build" plan that crosses one is fiction; and the releasetools escape hatches (`ota_from_target_files --downgrade`, `--spl_downgrade`) exist for bench and for explicitly-managed downgrade programs, not as a fleet undo button — the tooling will happily *build* the package the bootloader will refuse. Release planning reads the calendar before the changelog: **your rollback window is the set of builds sharing the newest SPL you have shipped.**

<div class="checkpoint"><strong>Checkpoint:</strong> for each failure class you can name the actor that saves you — bootloader tries and AVB (won't boot), your health gate and the boot-control HAL (boots but sick), nobody (wrong side of an SPL boundary) — and which drill or document proves it before the fleet does.</div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Rehearse both rollback classes on the bench and state, for each, the evidence that declares it.</p></div>

## Worked Example D: release signing and AVB, in full
<div class="section-opener"><span class="block-label">In this section</span><p>Release signing and Android Verified Boot in full: the keys, <code>BOARD_AVB_ENABLE</code>, the vbmeta chain, and the rollback indexes — the half of shipping Lecture 9's map promised here.</p></div>

Lecture 9's map ended here: "Android Verified Boot (`BOARD_AVB_ENABLE`, vbmeta, rollback indexes) is board configuration that Lecture 11 teaches beside the OTA machinery that depends on it." Collect.

**The three key families** (confusing them is the classic supply-chain incident):

| Family | Signs | Device trusts | Where it appeared |
|---|---|---|---|
| App/platform certificates (`platform`, `shared`, `media`, `testkey`, …) | APKs and APEXes | matching certs in the build (Lecture 8's `certificate: "platform"` resolves here) | Lecture 8 |
| AVB keys (one per vbmeta chain link) | partition images via vbmeta | the key baked into vbmeta itself, chained to the top image the bootloader holds | this lecture |
| OTA package key | the `.zip` / payload metadata | the running build's trusted OTA certificates (`update_engine`'s `certificate_checker.cc` is the verifier) | this lecture |

**The uncomfortable starting fact:** on the reference target, all three families are *public test keys*. The tree ships `build/target/product/security/{testkey,platform,shared,media,…}.pk8/.x509.pem` for anyone to read (they are how `userdebug` images can be built at all), and the BoardConfig points every AVB chain link at `external/avb/test/data/testkey_rsa4096.pem`. Anything signed by them is signed by *everyone*. Fine for Cuttlefish, disqualifying for a car: verified boot with a public key verifies only that *somebody* ran the signer.

**The release ceremony, at file level.** Your program generates its own keys once, offline, under whatever custody your security team demands — application certs (`platform`, `shared`, `media`, a `releasekey` in testkey's place), one RSA-4096 AVB key (or one per chain link, if you want partition-level custody), one OTA package key. Then three moves, each a file change or a command this course has already met:

1. **BoardConfig release block.** In `device/acme/kestrel/BoardConfig.mk`, *after* the `-include` of Cuttlefish's board file (so your `:=` wins, per Lecture 2's precedence), restate the AVB wiring against program keys (fictional acme paths, real variables from `shared/BoardConfig.mk`):

```make
# Release AVB: program keys replace the reference target's published test key.
# (userdebug course builds deliberately keep the test key; release never does.)
BOARD_AVB_KEY_PATH := device/acme/kestrel/keys/release/avb.pem
BOARD_AVB_VBMETA_SYSTEM_KEY_PATH := device/acme/kestrel/keys/release/avb_system.pem
BOARD_AVB_BOOT_KEY_PATH := device/acme/kestrel/keys/release/avb_boot.pem
```

The rollback-index lines you *inherit unchanged*: still `$(PLATFORM_SECURITY_PATCH_TIMESTAMP)` — the ceremony changes who can sign, not what counts as old.

2. **Re-sign the target-files.** If the build itself was made with test keys (the common flow: one build, signed per channel), `sign_target_files_apks` rewrites a target-files zip onto release keys — `-d/--default_key_mappings <dir>` for the systematic swap, `-k/--key_mapping src=dest` for exceptions — and, crucially, it re-signs the AVB images as it goes (it invokes `avbtool` with the new `--key` and `--algorithm`). App certificates inside are re-signed in the same pass, which is why this is one tool and one review, not three.
3. **Sign the OTA package.** Generate from the *signed* target-files with `ota_from_target_files` and the release OTA key as `--package_key`; the device accepts it because its trusted OTA certificates now trace to that key — a car still running test-key trust accepts nothing you ship, which is why key transitions are planned as fleet migrations (ship trust first, require it later), not as build flags.

**Release build discipline**, briefly and without romance: release images are `user` builds from the release branch, cut from a clean tree; `userdebug` is the bench, never the fleet. Every release archives target-files, signed target-files, the OTA package, symbols, and the slot sheet (Worked Example A), all named by fingerprint.

And the review habit from Lecture 9 applies to keys as to policy: read the *audience* — every key in the tree answers "who gains the power to ship to my fleet," and the correct number of copies of that power is a security decision, not a convenience.

<div class="checkpoint"><strong>Checkpoint:</strong> you can narrate one release's key lineage end-to-end — which key signed the app, which signed vbmeta_system, which signed the OTA zip — and point at the exact line or command where each was applied. Until then, do not ship one.</div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Sign a release build and walk its vbmeta chain, naming what each rollback index refuses and when.</p></div>

## Release discipline around the machinery
<div class="section-opener"><span class="block-label">In this section</span><p>The machinery is the easy half. The programs that survive shipping add process shaped like the mechanisms: named builds, rehearsed rollbacks, evidence kept like it will be subpoenaed.</p></div>

The machinery is the easy half. The programs that survive shipping add process shaped like the mechanisms:

* **Rollout rings mirror slot logic.** Bench targets, then internal fleet, then a percentage of production, then everyone — each ring is a slot you can still abandon. A ring advances on Worked Example B's evidence (fingerprints, health gates, merge completed), never on silence.
* **Updates are scheduled by the vehicle, not the server.** Power state, parking, and consent gate when `update_engine` may work; AAOS gives you garage mode as the designed maintenance window (Lecture 7's power world owns the details). An update that drains a 12 V battery in an airport car park is a successful payload and a failed product.
* **Every rehearsal is written down with its evidence.** Drill outputs (timestamps, slot suffixes, fingerprints, the log of the fallback) are release artifacts, kept with the target-files. "We watched it roll back" is the only trustworthy sentence in this discipline, and it should be *checkable*.
* **Versioning is calendar-aware.** Because the SPL timestamp is the anti-rollback clock, release cadence, SPL bumps, and rollback windows are one conversation. (This course versions its own releases the same way it teaches: semver bumps at each approved batch — Lectures 2–7 shipped as v1.2.0, and this lecture's batch becomes v1.3.0 at the Phase 2 gate. Small numbers, same principle: a version is a promise about what can follow it.)

<div class="section-recap"><span class="block-label">Now you can</span><p>State the release disciplines that mirror the mechanisms — and recognise a program that lacks one before its fleet does.</p></div>

## Lab (guided)
<div class="section-opener"><span class="block-label">In this section</span><p>Derive the sheet, run the crossing, rehearse the drills: a sheet a colleague can re-derive from your citations, then the Tier 2 crossing with its evidence kept.</p></div>

**Tier 1 — the slot sheet, from the tree (~1 h).** Without building anything, extract the slot sheet for `kestrel_auto` from the board-config chain: every partition, its location (standalone/super + group), size or group ceiling, its AVB chain and rollback location, and whether OTA touches it. Cite the file and line for each row, and compute the COW headroom the sheet implies. Checkpoint: your sheet is derivable by a colleague from your citations alone.

**Tier 2 — the crossing and the two drills (~3–4 h; budget a half day if builds are cold).**
1. Run Worked Example B: two `m dist` builds differing by the marker property, payload generated, applied, rebooted, proved by slot suffix + fingerprint + marker + welcome-chain smoke. Checkpoint: all four proofs in your log, with the success-mark and merge-completion lines identified.
2. Drill 1: corrupt the inactive boot path, reboot, capture the fallback (slot suffix unchanged, build N serving, `update_engine`'s narration). Checkpoint: the car never ran the broken build, and you can say which mechanism (hash chain vs tries) fired.
3. Drill 2 (design + partial run): implement the sick build (welcome crash-loop or a withheld health verdict), state your gate's evidence list and lever, and demonstrate the re-activation of the good slot via the boot-control path. Checkpoint: written gate criteria that Lecture 10's runbook can execute unchanged.

**Tier 3 — paper release (45 min).** Take any real target's board config (yours, a supplier's, a BSP's) and produce the release delta: which key paths are test keys, which rollback locations are in use, what the SPL-as-index implies for your rollback window, and the archive list. Checkpoint: three findings a security review would have caught only from the files.

*Verification status: board configuration, AVB chains and rollback indexes, `update_engine` client flags and service name, boot-control HAL surface, releasetools options, and garage-mode paths checked against `android-17.0.0_r1` / official documentation (see `docs/verification/lecture-11-source-truth.md`). All command outputs are representative samples in the tools' real formats. The full build → payload → apply → rollback cycle was not executed in the authoring environment — it is the course's heaviest lab; Tier 2 exists to make it real.*

<div class="section-recap"><span class="block-label">Now you can</span><p>Produce a re-derivable slot sheet and a proved OTA crossing, with rollback evidence kept for both drills.</p></div>

## Exercises
<div class="section-opener"><span class="block-label">In this section</span><p>Exercises in shipping judgement: read a panel and refuse a launch, date a rollback from its SPL, and defend a signing decision to a release board.</p></div>

1. A power cut hits mid-apply (payload 60% streamed). Walk the next three boots and state precisely what protects the running car at each one.
2. Your OTA applies and boots, but `CarService` crash-loops. Does slot rollback save you? Distinguish the two success claims and design the missing piece with named evidence and a named lever.
3. Why must target-files and `symbols/` be archived for every release, naming the lectures that will come asking for them?
4. A supplier proposes disabling verified boot "to simplify field updates" and shipping with the tree's test keys. Write the risk paragraph for the design review.
5. Release planning wants to roll back the fleet from build 47 (SPL 2026-08) to build 46 (SPL 2026-08) after a bad week — and, in the same meeting, asks about build 45 (SPL 2026-05) "just in case." Rule on both, from Worked Example A's sheet.
6. Your system-group partitions grow by 400 MiB in release N+1 while the vendor group shrinks by 100 MiB. Using the slot sheet's numbers, state whether the OTA still fits, what to check about COW, and which alternative (partial OTA, group resize, payload diet) you would argue for in review.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. The running slot was never written: the payload streams into the inactive slot / COW snapshots only. Boot 1 (the interrupted reboot, if any): the bootloader tries the slot marked active — if the apply never completed, `update_engine` never marked the new slot active, so build N boots as if nothing happened; if marking happened but verified boot rejects the half-written slot, tries burn and the bootloader falls back (Drill 1). Either way the car's truth is unchanged. Boot 2: the update retries from a clean apply (the partial COW is discarded, not resumed byte-for-byte). Boot 3: normal. The designed behaviour is that mid-apply power loss is a non-event; a design where it isn't is not A/B, whatever the slide says.
2. Not by itself. Boot success is the bootloader's claim (tries consumed, boot completed); system health is your program's claim (`CarService`, services, the welcome chain). A booting-but-sick build will be marked successful unless your health gate intervenes. The missing piece: a post-boot gate that runs Lecture 10's first-fifteen-minutes against the new slot and, on failure, uses the boot-control HAL (`setActiveBootSlot` to the old slot, or `setSlotAsUnbootable` on the sick one) and reboots *before* the success mark lands — gated on vehicle state (parked/garage mode), with the evidence written to the release log.
3. Target-files are the only input from which payloads (full, incremental, partial, rollback builds) can be regenerated or compared; without them, an update failure in the field cannot be reproduced on the bench. Symbols (`symbols/`, keyed to the build fingerprint) are what Lecture 10 needs to turn a release tombstone into function names; without the archived tree for *that exact build*, the backtrace is addresses. Lecture 10 demands the second; this lecture's own incident work (payload forensics, rollback builds) demands the first.
4. Look for: with verified boot off and/or public test keys in place, "signed" stops meaning "ours" — anyone with the published key (which is everyone) can produce a vbmeta the bootloader trusts, so payload acceptance, rollback protection, and the whole slot machinery defend against accidents but not adversaries; a supplier's compromised build machine becomes a fleet-wide persistent implant path; VTS/CTS and customer security reviews will find it even if attackers don't. The simplification trades a one-time key ceremony for a permanent trust boundary loss, on vehicles with decade-long lives.
5. Build 46 is a legitimate retreat: same SPL (2026-08) means identical rollback indexes, so a properly signed OTA (or a slot re-activation inside the unproven window) is accepted — assuming the other discipline holds (health evidence, rings). Build 45 is refused by construction: its rollback indexes derive from SPL 2026-05, lower than the values already stored in tamper-evident storage by every car that booted build 47; the bootloader will reject it regardless of signatures, and `--downgrade`-family tooling flags do not change what the bootloader enforces. The plan that survives review: retreat to 46 if needed, and treat 45 as reachable only before 47 ships — which is why the decision was actually made at build 47's release gate.
6. New occupancy: system group 6,845,104,128 + 400 MiB ≈ 7.26 GB against its own 6.375 GiB ceiling — *the group ceiling is exceeded*, so the images do not build into the current layout regardless of `super`'s total; and even after raising the system group ceiling, check the real constraint: 8 GiB `super` must hold system group + vendor group (now ~1.27 GiB) + worst-case COW for the update itself, which for a full-system delta approaches the changed-partition footprint until merge. If the sum leaves no COW headroom, options in review order: shrink the payload (incremental `--incremental_from=` so COW carries deltas, not images), resize the groups deliberately (a board-config change with its own review — it reallocates every future release's envelope), or scope a partial OTA (`--partial=`) for the partitions that actually changed. The answer "just raise the group size" without the COW arithmetic is how releases strand cars mid-merge.

</details>

<div class="section-recap"><span class="block-label">Now you can</span><p>Read any build's panel and give the launch verdict — go, no-go, or rehearse — with the mechanism that decides it.</p></div>

## Go deeper: kernel and app pointers
<div class="section-opener"><span class="block-label">In this section</span><p>The bootloader and kernel sit underneath slot selection and the verified-boot chain; bring your slot sheet to the vendor's documentation and the kernel path, in that order.</p></div>

The bootloader and kernel sit underneath slot selection and the verified-boot chain: bring your slot sheet to the vendor's bootloader documentation and the [kernel path]({{ '/kernel-path/' | relative_url }}) step 1, and check who decrements tries, who owns the tamper-evident store, and what the boot ROM trusts before AVB starts.

Above this lecture, updatable modules (APEX) and app updates ship without waiting for a system OTA; the [app path]({{ '/app-path/' | relative_url }}) covers that split and what it means for feature planning — several features you are tempted to bake into `system` can ride the app channel and skip the machinery of this lecture entirely, at the price of the guarantees it buys.

<div class="callout"><p><strong>Working with AI agents:</strong> let agents draft slot sheets from board configs, payload-inspection checklists, rollout-ring criteria, and rollback test plans — completeness work where tirelessness is the value. Keep two things human-owned: the key ceremony (an agent that has seen your release private keys is a disclosure, not a helper) and the sentence "we watched it roll back," which no amount of confident prose substitutes for. Paste board-config <em>excerpts</em>, never key material.</p></div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Follow slot selection and verified boot below the platform, slot sheet in hand.</p></div>
