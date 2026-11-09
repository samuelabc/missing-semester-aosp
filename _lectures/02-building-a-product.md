---
number: 2
title: "Building a product"
subtitle: "Define kestrel_auto end to end: AndroidProducts.mk, the product makefile, BoardConfig.mk, and the module builds that replace full builds."
reading_time: "~35 min read, plus lab"
lab_time: "2–3 h"
---

<div class="lecture-map"><span class="block-label">Lecture map</span><h2>The whole lecture on one screen</h2><div class="lecture-map-grid"><div><h3>Build the map</h3><ul><li><a href="#motivation">Motivation</a> — why build fluency pays</li><li><a href="#mental-model">Mental model</a> — one pipeline, config to image</li><li><a href="#file-anatomy-what-makes-a-product-a-product">File anatomy: what makes a product a product</a> — four files, four consumers</li></ul></div><div><h3>Walk the work</h3><ul><li><a href="#worked-example-kestrel_auto-from-empty-directory-to-running-daemon">Worked example: kestrel_auto, from empty directory to running daemon</a> — empty directory to running daemon</li><li><a href="#reading-build-failures-the-three-you-will-actually-meet">Reading build failures: the three you will actually meet</a> — the first failure is the real one</li></ul></div><div><h3>Make it a habit</h3><ul><li><a href="#lab-guided">Lab (guided)</a> — make the product, then prove it</li><li><a href="#exercises">Exercises</a> — test the reading, not the memory</li><li><a href="#go-deeper-kernel-and-app-pointers">Go deeper: kernel and app pointers</a> — build pointers, kernel and app</li></ul></div><p class="map-note">Lost mid-lecture? The Contents rail on the left (top on a phone) always shows where you are. Each section opens with what it teaches and closes with what you can now do.</p></div></div>

## Motivation
<div class="section-opener"><span class="block-label">In this section</span><p>Why “the build is broken” is the most expensive sentence on a program when nobody can tell a Soong error from a missing file from a wrong lunch target. This section is about reading the build instead of fearing it.</p></div>

"The build is broken" is the most expensive sentence on an OEM program when the person saying it cannot tell a Soong error from a missing file from a wrong lunch target. The second most expensive habit is quieter: engineers who only know full `m` lose a day a week to recompilation they never needed, so they batch changes, so reviews get bigger, so the build breaks more. The two problems are the same problem. Nobody taught them what a product actually is.

This lecture fixes that by building one. By the end, the course's fictional car from Lecture 9 — `device/acme/kestrel`, its daemon `welcomed`, its policy directory — stops being a set of files Lecture 9 asked you to overlay onto Cuttlefish by hand, and becomes a real, lunchable product: `kestrel_auto`. Every file is shown whole.

You will register the product, inherit the AAOS stack, wire the board configuration, add the daemon to the image with one line, prove it landed, and read the three build failures every platform engineer meets, in the order they usually arrive.

One correction this lecture makes to Lecture 9, in the open: Lecture 9's Stage 0 told you to grep `device/google/cuttlefish/vsoc_x86_64/auto/` and to add a sepolicy line to Cuttlefish's board config as a pilot shortcut. At the pinned tag the path is `vsoc_x86_64_only/auto/`, and after this lecture the shortcut is retired — `kestrel_auto` is the target, and its own `BoardConfig.mk` carries the line.

<div class="section-recap"><span class="block-label">Now you can</span><p>Tell a Soong error, a missing file, and a wrong lunch target apart — and say why that distinction is worth money on a real program.</p></div>

## Mental model
<div class="section-opener"><span class="block-label">In this section</span><p>A build is one pipeline: product configuration selects modules, Soong turns them into a build graph, and the pipeline emits images you can verify rather than assume.</p></div>

A build is one pipeline:

**Repo assembles sources → Soong parses every `Android.bp` into modules → the product configuration selects modules, files, and properties → Ninja compiles and packages → partition images land in `out/target/product/<device>/`.**

Two kinds of file feed that pipeline, and confusing them is the root of most build misery. `Android.bp` files define *what exists*: a module with a name, sources, and dependencies (`cc_binary`, `java_library`, `android_app`, `aidl_interface`, and dozens more). Product makefiles decide *what ships in this product*: `PRODUCT_PACKAGES` (modules to install), `PRODUCT_COPY_FILES` (loose files to copy), `PRODUCT_VENDOR_PROPERTIES` and friends (values baked into the image). Soong errors are about existence. Product errors are about selection. Read every failure by first asking which of the two it is.

`lunch <product>-<release>-<variant>` picks all of it at once. The product segment names an entry in some device's `AndroidProducts.mk`. The release segment names a release configuration — at the pinned tag, `build/release/release_configs/` holds `ap4a`, `trunk_staging`, and others; this course's baseline uses `ap4a`, while Cuttlefish's own registered lunch choices use `trunk_staging`, and both are real, which is why you verify the segment against your tree instead of memorizing it.

The variant is `eng` (debugging on), `userdebug` (root-able, close to production, the OEM daily driver), or `user` (what ships). When in doubt in this course: `userdebug`.

Board facts live one level below the product, in `BoardConfig.mk`: architecture, partition sizes, kernel and bootloader arrangements, and — as Lecture 9 used — the variables that pull your sepolicy directory into the policy build. The build finds the board config through `PRODUCT_DEVICE`, which is why the next section is so careful about three strings that look alike.

<div class="section-recap"><span class="block-label">Now you can</span><p>Trace a build from product configuration to running system in one line, naming what decides what at each stage.</p></div>

## File anatomy: what makes a product a product
<div class="section-opener"><span class="block-label">In this section</span><p>Four files that make a product, each read by a different consumer. This is the map for the Worked Example — what each file decides, and who reads it.</p></div>

Four files, read by four different consumers. This is the map for the worked example.

| File | Read by | You touch it when | Missing or wrong, you see |
|---|---|---|---|
| `device/<vendor>/<device>/AndroidProducts.mk` | `envsetup`/`lunch`, scanning every device directory | Once per product: it registers the product makefile under a lunchable name | `lunch` cannot find your product, and insists the combo is invalid |
| `device/<vendor>/<device>/<product>.mk` | The build's product-config phase, following `inherit-product` | Constantly: packages, copied files, properties, overlays for this product | Your module builds fine and simply never appears in the image |
| `device/<vendor>/<device>/BoardConfig.mk` | The build before Soong runs, located via `PRODUCT_DEVICE` | Board facts change: arch, partitions, kernel, sepolicy wiring | The build cannot find a board config, or builds with the wrong board's facts |
| `**/Android.bp` | Soong, across the whole tree | You create or change a module: a binary, a library, an app, an interface | "Module X not found" or a missing-dependency error naming the file and line |

The selection variables deserve a small field guide, because you will grep for all of them within a month. `PRODUCT_PACKAGES` installs modules (code, mostly). `PRODUCT_COPY_FILES` copies loose files to named destinations in an image (configuration, data, firmware blobs you did not build). `PRODUCT_VENDOR_PROPERTIES`, `PRODUCT_SYSTEM_PROPERTIES`, and `PRODUCT_PRODUCT_PROPERTIES` bake read-only defaults into the matching partition's `build.prop`; the partition in the variable name is the partition that carries the value, which decides both who can read it early in boot and which image you must rebuild to change it.

`PRODUCT_PACKAGE_OVERLAYS` and `DEVICE_PACKAGE_OVERLAYS` point at resource-overlay directories (Lecture 8's territory). And `PRODUCT_NAME`, `PRODUCT_DEVICE`, `PRODUCT_MANUFACTURER`, `PRODUCT_BRAND`, and `PRODUCT_MODEL` are the identity five: they end up in `build.prop` and fingerprints, which is why Lecture 3 can settle "which build is this" arguments with `getprop`. When you meet a `PRODUCT_*` variable this lecture has not named, do not guess from its name alone: grep the tree for where it is consumed. The build system is large, but every one of these variables has a reader, and the reader is the definition.

### The module half of the world: reading an Android.bp

Selection only makes sense once existence is concrete, so look at the one module this course owns end to end. Lecture 9's annex defined it; this lecture is where that definition gets read properly. From `device/acme/kestrel/welcomed/Android.bp`:

```
cc_binary {
    name: "welcomed",
    vendor: true,
    srcs: ["main.cpp"],
    shared_libs: [
        "vendor.acme.hardware.welcome-ndk",
        "libbinder_ndk",
        "libcutils",
        "liblog",
    ],
    init_rc: ["welcomed.rc"],
}
```

Field by field. `cc_binary` is the module type: a native executable compiled from C/C++ sources. `name` is the string every other file must match exactly — it is what `PRODUCT_PACKAGES += welcomed` refers to, what `m welcomed` builds, and what a typo breaks (Failure B). `vendor: true` routes the installed binary to the vendor partition (`/vendor/bin/welcomed`), which is also what puts Lecture 9's vendor sepolicy, rather than system sepolicy, in charge of its domain.

`srcs` are the inputs, relative to this `Android.bp`. `shared_libs` is the link graph: the daemon cannot call `AServiceManager_addService` unless `libbinder_ndk` is listed here, and Exercise 5 makes you diagnose exactly that omission. `init_rc` installs the daemon's init stanza alongside the binary, into `/vendor/etc/init/` — which is how Step 6's running process exists at all, and why Lecture 4 will treat that file as a first-class build artifact rather than a runtime afterthought.

Three habits when reading any module, yours or upstream's. Read `name` and partition fields first, because they decide where the artifact lands and which of your other files (product entry, sepolicy labels) must agree with it. Read the dependency fields second (`shared_libs`, `static_libs`, `deps`, and their kin vary by module type, but there is always such a field), because most Soong failures are one missing entry there.

Read visibility and defaults last: on large trees a module may exist and still be unavailable to you because a `visibility:` rule does not list your package, which presents as the same "not found" as a typo but fixes in a different file. Existence, it turns out, has layers too.

### Trace one package you did not write

The same two questions — does it exist, is it selected — locate any feature on a running car, including ones your team did not write. Take `CarRotaryController`, the rotary-input service in the AAOS reference stack. Selection first: `packages/services/Car/car_product/build/car_generic_system.mk` at the pinned tag contains `PRODUCT_PACKAGES += CarRotaryController \` in a short block with `RotaryIME` and `RotaryPlayground`. That file is inherited by the Cuttlefish auto product (Step 1's chain), which `kestrel_auto` inherits in turn, so the package is in your image without kestrel ever naming it. Existence second: the module is defined somewhere under `packages/` with `name: "CarRotaryController"` in an `Android.bp`;

find it rather than guessing the directory:

```bash
grep -rn 'name: "CarRotaryController"' packages/ --include=Android.bp
grep -rn "CarRotaryController" packages/services/Car/car_product/build/
ls out/target/product/kestrel/system/priv-app/ 2>/dev/null | grep -i rotary
adb shell pm list packages | grep -i rotary
```

Run those in order and watch what each proves. The first locates the recipe. The second locates every selection decision, including any product that removes or debug-gates it. The third proves installation into the image (the exact subdirectory follows the module's own privileged/app declarations, which Lecture 8 will teach you to read). The fourth proves it survived onto the running system.

A feature "missing from the car" breaks at exactly one of those four links, and each link has a different owner and a different fix. That four-link trace — definition, selection, installation, presence — is the single most reusable procedure in this course; Lectures 5 through 12 will each run it at a different layer.

The same file teaches one more selection layer for free. Below the rotary block, `car_generic_system.mk` adds a longer list under `PRODUCT_PACKAGES_DEBUG`: `curl`, `update_engine_client`, several test apps. Debug packages install only on `eng` and `userdebug` builds. So "the tool is on my bench build and missing from the release candidate" is often not a bug at all; it is this variable working as designed, and the release process working as intended.

Before filing anything about a missing binary, check which of the two variables selected it, and which variant you are looking at. Selection, it turns out, is conditional as well as additive, and the condition is in the file, not in tribal memory.

Keep one upstream reference open while you work: `device/google/cuttlefish/AndroidProducts.mk` at the pinned tag. It registers some forty products in exactly the format you are about to write, including the line this whole course is aimed at:

```make
aosp_cf_x86_64_auto:$(LOCAL_DIR)/vsoc_x86_64_only/auto/aosp_cf.mk \
```

Note the path: `vsoc_x86_64_only/auto/`. An earlier draft of this course (and Lecture 9's first version) said `vsoc_x86_64/auto/`; the tree disagrees, and the tree wins. That is the habit this lecture is really teaching. Every claim below can be checked the same way, and the lab makes you check several.

<div class="section-recap"><span class="block-label">Now you can</span><p>Name the four product files, what each one decides, and which consumer reads it.</p></div>

## Worked example: kestrel_auto, from empty directory to running daemon
<div class="section-opener"><span class="block-label">In this section</span><p>Build the course's product from an empty directory: stand on the AAOS reference product's inheritance chain, register <code>kestrel_auto</code>, and bring <code>welcomed</code> to a running daemon, checkpoint by checkpoint.</p></div>

### Step 1: read the product you are standing on

Before creating anything, read the AAOS reference product's inheritance chain, because `kestrel_auto` will stand on it. Open `device/google/cuttlefish/vsoc_x86_64_only/auto/aosp_cf.mk`. Stripped of comments, it is five inherit lines and four identity assignments:

```make
$(call inherit-product, $(SRC_TARGET_DIR)/product/core_64_bit_only.mk)
$(call inherit-product, packages/services/Car/car_product/build/car_generic_system.mk)
$(call inherit-product, packages/services/Car/car_product/build/car_system_ext.mk)
$(call inherit-product, packages/services/Car/car_product/build/car_product.mk)
$(call inherit-product, device/google/cuttlefish/shared/auto/device_vendor.mk)
$(call inherit-product, device/google/cuttlefish/vsoc_x86_64/kernel.mk)
$(call inherit-product, device/google/cuttlefish/vsoc_x86_64/bootloader.mk)

PRODUCT_NAME := aosp_cf_x86_64_only_auto
PRODUCT_DEVICE := vsoc_x86_64_only
PRODUCT_MANUFACTURER := Google
PRODUCT_MODEL := Cuttlefish x86_64 auto 64-bit only
```

Three lessons hide in that short file. First, an AAOS product is mostly inheritance: the generic system, system_ext, and product images come from `packages/services/Car/car_product/build/`, which is also where car packages and car sepolicy directories are added (`car.mk` in the same family adds `PRODUCT_PACKAGES` entries like `CarProvision` and the `PRODUCT_PRIVATE_SEPOLICY_DIRS` lines). Second, the vendor side comes last, from Cuttlefish's `device_vendor.mk` — your product's own additions belong after the inherits, so they win.

Third, and most trip-worthy: **lunch name, product name, and device are three different strings**. You lunch `aosp_cf_x86_64_auto` (the key in `AndroidProducts.mk`), the file sets `PRODUCT_NAME := aosp_cf_x86_64_only_auto`, and `PRODUCT_DEVICE := vsoc_x86_64_only` decides the output directory (`out/target/product/vsoc_x86_64_only/`) and which `BoardConfig.mk` the build reads. When a colleague says "I built the wrong thing", the confusion is almost always between two of these three.

<div class="checkpoint"><strong>Checkpoint:</strong> you can answer, from the files: if you lunch <code>aosp_cf_x86_64_auto</code>, what is <code>PRODUCT_NAME</code>, what is <code>PRODUCT_DEVICE</code>, and which file will the build read for board facts? (<code>device/google/cuttlefish/vsoc_x86_64_only/BoardConfig.mk</code> — hold that thought for Step 4.)</div>

### Step 2: register the product

Lecture 9 created `device/acme/kestrel/sepolicy/vendor/` and a stub `BoardConfig.mk`. Now the device directory becomes a product. Create `device/acme/kestrel/AndroidProducts.mk`:

```make
# acme kestrel products.
PRODUCT_MAKEFILES := \
    kestrel_auto:$(LOCAL_DIR)/kestrel_auto.mk

COMMON_LUNCH_CHOICES := \
    kestrel_auto-ap4a-userdebug
```

Two assignments, two jobs. `PRODUCT_MAKEFILES` maps the lunchable name `kestrel_auto` to the makefile that defines it; `$(LOCAL_DIR)` is the directory containing this file, which is why the path is short. `COMMON_LUNCH_CHOICES` advertises the full combo so it appears when you run `lunch` with no arguments. The release segment is `ap4a` because that is this course's pinned baseline (Setup, Lecture 9); if your tree's `build/release/release_configs/` lists different names, yours wins — the file format is the lesson, the segment is data.

### Step 3: the product makefile

Create `device/acme/kestrel/kestrel_auto.mk`:

```make
# kestrel_auto — acme's AAOS product on the Cuttlefish reference board.
# Everything inherited comes from the upstream AAOS reference product;
# kestrel's identity and additions are applied after the inherits so
# they take precedence.

$(call inherit-product, device/google/cuttlefish/vsoc_x86_64_only/auto/aosp_cf.mk)

PRODUCT_NAME := kestrel_auto
PRODUCT_DEVICE := kestrel
PRODUCT_MANUFACTURER := acme
PRODUCT_MODEL := Kestrel IVI (reference board)
PRODUCT_BRAND := acme

# The Running Example daemon (Lecture 9 built its policy; this line
# is what puts the binary in the vendor image).
PRODUCT_PACKAGES += welcomed

# A vendor property a bench engineer can check to prove which
# product is running (Lecture 3's fingerprint habit, made local).
PRODUCT_VENDOR_PROPERTIES += \
    ro.acme.kestrel.board=reference
```

Line by line, because each line has a failure mode you will meet later. The inherit pulls in the entire AAOS reference product, including its own identity assignments — which is why ours come after: in product makefiles, the last assignment to a variable wins, and inheritance is just inclusion in order. `PRODUCT_DEVICE := kestrel` is the consequential one. It moves `out/target/product/` to `out/target/product/kestrel/` and, critically, makes the build look for board facts in a device directory named `kestrel` — ours, not Cuttlefish's.

Step 4 exists because of this line. `PRODUCT_PACKAGES += welcomed` selects an existing module for installation; it defines nothing. If `welcomed` did not exist as a Soong module (Lecture 9's annex provides it), this line would fail the build rather than silently skip, which is the correct behaviour and Failure B below. `PRODUCT_VENDOR_PROPERTIES` bakes a read-only property into the vendor image; we will use it in Step 6 as a cheap proof of "this image is kestrel".

What this file deliberately does not do: copy the daemon binary with `PRODUCT_COPY_FILES`. A copied binary bypasses Soong's dependency, signing, and install-path handling, and arrives with the wrong SELinux label more often than not (Lecture 9 labelled a module-installed `/vendor/bin/welcomed`; a copied file is a new labelling problem). Rule of thumb, stated once here and enforced in every later lecture: code ships as packages, configuration and data may ship as copies.

### Step 4: BoardConfig.mk grows up

In Lecture 9 this file held one line. Replace `device/acme/kestrel/BoardConfig.mk` with its grown-up form:

```make
# Kestrel board configuration.
#
# Reference-board form: inherit the Cuttlefish board wholesale, then
# apply kestrel's facts. On real kestrel hardware, the -include line
# is replaced by this program's own arch/partition/kernel facts
# (Lecture 11 revisits the partition half of that).

-include device/google/cuttlefish/vsoc_x86_64_only/BoardConfig.mk

# Lecture 9: pull acme's sepolicy directory into the vendor policy.
BOARD_VENDOR_SEPOLICY_DIRS += device/acme/kestrel/sepolicy/vendor
```

Why this shape works is worth understanding, because every reference-board product does it. The `-include` (the dash makes a missing file non-fatal, which matters during the build's early probing) pulls in Cuttlefish's board file, which sets the x86_64 architecture variables and in turn includes `device/google/cuttlefish/shared/BoardConfig.mk` — the file that wires Cuttlefish's own sepolicy, among much else. Our one addition then appends acme's directory to the same variable, so the policy build concatenates platform, Cuttlefish, and acme policy in that order (Lecture 9 verified this variable and its ordering in `system/sepolicy/README.md`).

The risk to name out loud: everything Cuttlefish's board config asserts — partition sizes, kernel arrangements — is now asserted for kestrel. For a reference-board course product that is the point. For a shipping program it is a list of facts to re-derive, and Lecture 11 returns to the partition entries with that lens.

If you carried out Lecture 9's pilot shortcut (adding the sepolicy line to `device/google/cuttlefish/shared/BoardConfig.mk`), remove that line now. Two registrations of the same directory would concatenate acme's policy files twice; type redefinitions would fail the policy build, which is at least honest, but the fix is to keep exactly one wiring, in the board file that owns it.

<div class="checkpoint"><strong>Checkpoint:</strong> from the files alone, trace how the build finds board facts for <code>kestrel_auto</code>: product name → <code>PRODUCT_DEVICE=kestrel</code> → <code>device/acme/kestrel/BoardConfig.mk</code> → <code>-include</code> of the Cuttlefish board → shared Cuttlefish board config. If any arrow in that chain surprises you, re-read Steps 3–4 before building; the next failure mode lives exactly there.</div>

### Precedence: who wins when two files disagree

Product files disagree constantly, and the resolution rule is dull but absolute: these are makefiles, evaluated in inclusion order. A scalar assignment (`PRODUCT_NAME := …`) replaces whatever came before. A list append (`PRODUCT_PACKAGES += …`, `PRODUCT_VENDOR_PROPERTIES += …`) accumulates, and where a list carries key-value pairs — properties are the everyday case — the *later* value for a key is the one written to `build.prop`.

Since `inherit-product` is textual inclusion at the point of the call, "later" means "after the inherit line in your file, or in a file included after yours". This is why Steps 3–4 put every kestrel assignment after the inherits, and it is also the mechanism behind a classic bench mystery: a property set correctly in a product file and stubbornly wrong on the device, because a file inherited *after* yours set it again.

Watch it happen with an upstream value instead of taking the paragraph's word for it. `car_generic_system.mk` sets `PRODUCT_PRODUCT_PROPERTIES += ro.hw_timeout_multiplier=2` (a CTS timing allowance for slow car hardware). Add one line to `kestrel_auto.mk`, after the `PRODUCT_PACKAGES` line:

```make
# Experiment (precedence): override an inherited car default.
PRODUCT_PRODUCT_PROPERTIES += \
    ro.hw_timeout_multiplier=3
```

Rebuild the image (this value rides in the product image's `build.prop`, so a module build cannot move it — Failure C's taxonomy again), then read the verdict from the file the build produced, before booting anything:

```bash
grep hw_timeout_multiplier out/target/product/kestrel/product/build.prop
# ro.hw_timeout_multiplier=3
```

The grep is the lesson: `build.prop` is not generated documentation about your intentions; it *is* the decision, rendered. When a value on a running system surprises you, the search order is the inclusion order — `grep -rn "ro.hw_timeout_multiplier" packages/services/Car/car_product/build/ device/google/cuttlefish/ device/acme/kestrel/`, read the hits in the order the inherit chain evaluates them, and the last one is your culprit.

Remove the experiment line when you are done; a timing multiplier changed "to see if I could" is precisely the kind of silent delta Lecture 12's compliance testing exists to catch, and your future self reviewing this product file deserves to find only decisions that were meant.

### Step 5: lunch it, and build nothing

```bash
source build/envsetup.sh
lunch kestrel_auto-ap4a-userdebug
m nothing
```

Representative output (your paths and counts will differ; the shape is the contract):

```
PLATFORM_VERSION_CODENAME=Baklava
TARGET_PRODUCT=kestrel_auto
TARGET_BUILD_VARIANT=userdebug
TARGET_ARCH=x86_64
...
out/target/product/kestrel/
```

`TARGET_PRODUCT=kestrel_auto` confirms selection; the output directory naming `kestrel` confirms `PRODUCT_DEVICE` did what Step 3 said. `m nothing` then runs the full Soong/Kati analysis — every `Android.bp` parsed, the product configuration resolved, every `PRODUCT_PACKAGES` entry checked against a real module — while compiling almost nothing. It is the cheapest possible proof that your three files parse, your inherits resolve, and `welcomed` exists.

Run it after every product-config edit; it costs seconds to a minute against a full build's hour. If `lunch` itself refuses ("Invalid lunch combo: kestrel_auto-ap4a-userdebug"), you have met Failure A, next section, and notably you have met it before spending a build on it.

### Step 6: build the module, prove it landed, prove it runs

Build only what this lecture changed:

```bash
m welcomed selinux_policy
ls -l out/target/product/kestrel/vendor/bin/welcomed
```

`m welcomed` builds the daemon and its dependencies (the AIDL interface library from Lecture 9's annex, `libbinder_ndk`, and friends). `m selinux_policy` compiles your Lecture 9 policy with the new board wiring and runs the neverallow checks — this is the moment the retired Lecture 9 overlay would have double-registered, and the moment you find out if it did. The `ls` is not ceremony: a module can build successfully into `out/soong` staging while never being installed into a product image.

The file at `out/target/product/kestrel/vendor/bin/welcomed` is the installed artifact, with the vendor partition as its destination, because the module declares `vendor: true` (Lecture 9's annex, now load-bearing).

Then the full proof, once. Build the image and boot it the way the course has from the start (`m`, then `launch_cvd` for the reference target — budget the first full build as the slow, once-per-tree cost Setup warned about), and interrogate the running system:

```bash
adb shell getprop ro.product.device
# kestrel
adb shell getprop ro.acme.kestrel.board
# reference
adb shell ls -lZ /vendor/bin/welcomed
# -rwxr-xr-x 1 root shell u:object_r:welcomed_exec:s0 ... /vendor/bin/welcomed
adb shell ps -Z | grep welcomed
# u:r:welcomed:s0 ... /vendor/bin/welcomed
```

Four checks, four different claims from four different lectures, all verified in one sitting: the product identity is kestrel's (this lecture), the baked property arrived (this lecture), the binary carries the label Lecture 9's `file_contexts` assigned, and the process runs in the domain Lecture 9's transition created. When a future change breaks one of the four, you will know which lecture's file to open. That is not a metaphor; it is the debugging method Lecture 10 will formalize.

<div class="checkpoint"><strong>Checkpoint:</strong> you changed product-level files, built two modules and no full build until the final proof, and verified identity, property, label, and domain on a running system. If any check fails, the three failures below are ordered by likelihood — work them in order before inventing a fourth theory.</div>

### What the build actually produced

It is worth one deliberate look at `out/target/product/kestrel/`, because platform engineers navigate it from memory and nobody shows it to them. The partition directories (`system/`, `vendor/`, `product/`, and friends) mirror what will be flashed, file for file, before images are packed. Your property is not an abstraction; it is a line you can read before anything boots:

```bash
grep acme out/target/product/kestrel/vendor/build.prop
# ro.acme.kestrel.board=reference
grep -E "ro.product.(device|name)=" out/target/product/kestrel/vendor/build.prop \
    out/target/product/kestrel/system/build.prop 2>/dev/null | head
```

The `m <module>` workflow extends the same idea to iteration speed. Inside a module's directory, `mm` builds the modules defined there and `mma` builds them with their dependencies; from anywhere, `m <name>` builds one named module and what it depends on. The daily loop this enables is the economic heart of the lecture: edit `main.cpp`, `m welcomed`, push or resync the one binary to a `userdebug` target, restart the service, and you have tested a change in minutes.

The full `m` is reserved for changes that cross module boundaries, changes to the product or board files themselves, and the final clean-tree proof before anything ships. Engineers who reach for the full build as their inner loop are not being thorough; they are paying an hour to learn what a module build would have told them, and the interest compounds across a program.

Variant choice is part of the same economics, for this product concretely. Lunch `kestrel_auto-ap4a-userdebug` and the daemon can be restarted by hand, the system is root-able for the push-and-iterate loop, and Lecture 9's policy work can be done enforcing without shipping keys entering the conversation. The same product as `-user` removes those affordances on purpose; debugging it with userdebug habits ("just push the binary") fails by design, which Lecture 4 will use when it talks about services that will not start.

Build variants are not difficulty settings. They are different products sharing a name, and `ro.build.variant` is part of the fingerprint you quote in every bug report from Lecture 3 onward.

<div class="section-recap"><span class="block-label">Now you can</span><p>Create <code>kestrel_auto</code> from an empty directory, lunch it, and prove <code>welcomed</code> runs — naming the file that made each step true.</p></div>

<figure class="anchor-figure" role="img" aria-label="Concept anchor: the build pipeline"><p class="anchor-title">Concept anchor — the build pipeline</p><div class="anchor-flow"><div class="anchor-node"><strong>Product config</strong>makefiles decide what ships</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>lunch</strong>selects the product and variant</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Soong modules</strong><code>Android.bp</code> decides how each piece builds</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Images</strong>system, vendor, product — verified, not assumed</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Running system</strong>the daemon you can interrogate</div></div><figcaption><strong>Read it as:</strong> decisions flow down this pipeline; proof flows back up it. When a build surprises you, ask which stage decided the thing you are staring at.</figcaption></figure>

<figure class="anchor-figure" role="img" aria-label="Concept anchor: exists is not selected"><p class="anchor-title">Concept anchor — exists is not selected</p><div class="anchor-flow"><div class="anchor-node"><strong>Defined</strong>a module in an <code>Android.bp</code> — it exists</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Selected</strong>named in the product's <code>PRODUCT_PACKAGES</code> — it ships</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Built</strong>Soong and Ninja make it for this product</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>In the image</strong>find it in the output before you flash</div><span class="anchor-arrow" aria-hidden="true"></span><div class="anchor-node"><strong>Running</strong>the daemon or service you can interrogate</div></div><figcaption><strong>Read it as:</strong> two different questions locate any missing feature: does it exist, and is it selected? A module can pass the first and fail the second in perfect silence.</figcaption></figure>

## Reading build failures: the three you will actually meet
<div class="section-opener"><span class="block-label">In this section</span><p>The three build failures you will actually meet, and how to read them: scroll to the first real failure, read the named file and line, and ignore the hundreds of lines of consequences.</p></div>

**Failure A: lunch cannot find the product.** `lunch` prints an invalid-combo error and lists products that are not yours. Cause, in order: `AndroidProducts.mk` is missing or its `PRODUCT_MAKEFILES` path is wrong (check `$(LOCAL_DIR)` — the path is relative to the file, not the tree root);

the release segment names a release config your tree does not have (list `build/release/release_configs/`); or you are in a tree where `envsetup` was not sourced. Fix the registration, not the combo string: lunch is reporting a lookup failure, and retyping the combo cannot repair a file it never read.

**Failure B: the product names a module that does not exist.** Adding `welcomed` as `welcome` (a typo this lecture planted in an earlier draft, caught in review — it happens to everyone) stops the build during product configuration: Soong resolves `PRODUCT_PACKAGES` strictly and the build fails naming the unknown module. The error is good news delivered rudely: a copied file would have failed silently at runtime instead.

Find the real module name from its definition, not from memory: `grep -rn 'name: "welcomed"' device/acme/`. The general rule: `PRODUCT_PACKAGES` entries are module names exactly as written in an `Android.bp` `name:` field, spaces, case, and all.

**Failure C: it built, it booted, it is not there.** The daemon is missing on device, or the property reads back empty, but the build passed.

In build order: you built a different product than you booted (compare `getprop ro.product.device` and the fingerprint against `TARGET_PRODUCT` — Lecture 3's habit); you rebuilt the module but not the image or instance you are looking at (module builds stage artifacts; the running system needs the image rebuilt or the artifact pushed, Lectures 3–4 cover the push-and-restart loop); or `PRODUCT_DEVICE` points the board-config lookup (and output directory) somewhere other than where you have been inspecting — check which `out/target/product/*` directory actually changed timestamp.

Notice that "edit the generated files under `out/`" appears nowhere in this list. `out/` is regenerated; a fix placed there is a fix deleted on a schedule.

**Failure D: the module's own graph is incomplete.** Remove `libbinder_ndk` from the annex's `shared_libs` (or meet the equivalent on a real tree) and `m welcomed` compiles every file, then fails at link with an undefined reference to `AServiceManager_addService`. This failure is neither existence nor selection: the module was found, the product wanted it, and its recipe is short one ingredient.

The file to open is the module's own `Android.bp`, and the fix is a dependency entry there — one line, in the file the error's object path already names. The reason this failure deserves its own number is how often it gets mis-filed: engineers search the product makefiles for a linker problem, find nothing, and conclude the tree is broken.

The classification question from the mental model prevents that detour. Existence of the module: yes. Selection by the product: yes. Completeness of the module's declared dependencies: there is the bug.

A word on scrolling. Ninja and Soong failures print the first real error early and then hundreds of lines of consequences. Scroll to the *first* failure, read the named file and line, and classify it with this lecture's first question — existence (Soong/module graph) or selection (product/board)? Compiler errors inside a module are the exception: those are ordinary C++/Java errors wearing a long path, and the fix belongs in the source file, at the first diagnostic, not the last.

<div class="callout"><p><strong>Where to run this:</strong> Tier 1 needs only a synced tree. Tier 2's first full build is the one genuinely heavy job in this course: a Linux workstation or cloud VM with 32–64 GB RAM and roughly 300 GB of fast disk is the standard answer (Setup has the sizing), and fast cores beat many cores. Budget the first build once, in hours, and do not judge the lecture by it — every build after it in this course is a module build measured in minutes or seconds, which is the entire point of Steps 5–6.</p></div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Open a failed build, find the first real failure, and state its cause from the named file instead of scrolling the fallout.</p></div>

## Lab (guided)
<div class="section-opener"><span class="block-label">In this section</span><p>The same product at both tiers: create <code>kestrel_auto</code> and prove the build system accepts it, then prove it on a running system and add a second artifact.</p></div>

Same product at both tiers, per this course's definition: Tier 1 creates `kestrel_auto` and proves the build system accepts it; Tier 2 proves it on a running system, then adds a second module under your own control.

**Tier 1 — register and resolve (synced tree, ~1 h, no full build).**

1. Write the three files from Steps 2–4 (`AndroidProducts.mk`, `kestrel_auto.mk`, the grown `BoardConfig.mk`). Checkpoint: `lunch kestrel_auto-ap4a-userdebug` succeeds and prints `TARGET_PRODUCT=kestrel_auto`.
2. Run `m nothing`. Checkpoint: it passes, which proves Soong parsed the tree and resolved `welcomed` as a real module. If it fails, classify the failure (existence or selection) before editing anything, and write your classification next to the error.
3. Build `m welcomed selinux_policy` and run the `ls` from Step 6. Checkpoint: the daemon exists at `out/target/product/kestrel/vendor/bin/welcomed`. Note what did *not* happen: no full build, and `out/soong` staging alone would not have satisfied this checkpoint.
4. Read one inherited product file you did not write: open `packages/services/Car/car_product/build/car.mk` and find one `PRODUCT_PACKAGES` block and the `PRODUCT_PRIVATE_SEPOLICY_DIRS` lines. Checkpoint: you can state which partition image one named car package lands in, from the file that inherited it, not from the package name.

**Tier 2 — boot it, then extend it (Cuttlefish, ~2–3 h including the first full build).**

1. Complete Step 6: full build, `launch_cvd`, and the four `adb` checks. Checkpoint: all four pass; save the capture as the lab's deliverable.
2. Add a second module of your own. Create `device/acme/kestrel/tools/Android.bp`:

   ```
   sh_binary {
       name: "kestrel-info",
       src: "kestrel-info.sh",
       vendor: true,
   }
   ```

and `device/acme/kestrel/tools/kestrel-info.sh`:

   ```bash
   #!/bin/sh
   echo "product: $(getprop ro.product.device)"
   echo "daemon: $(ps -Z | grep -c "[w]elcomed") welcomed process(es)"
   ```

Add `kestrel-info` to `PRODUCT_PACKAGES` in `kestrel_auto.mk` — spelled wrong on purpose the first time (`kestrel_info`), build, and keep the Failure B error. Fix the spelling, rebuild `m kestrel-info selinux_policy`, then the image. Checkpoint: on the booted system, `adb shell kestrel-info` prints `product: kestrel` and a daemon count of at least 1; and you have both the error and the fix in your notes, because that pair is the portable skill.

3. Change `ro.acme.kestrel.board` to a new value in `kestrel_auto.mk`, rebuild the smallest target you can justify, and get the new value onto the running system. Checkpoint: `getprop` shows the new value, and your notes name the target you rebuilt and why a module build was or was not enough for a baked property.
4. Time the three build shapes on your machine — `time m nothing`, `time m welcomed`, and (from step 1) your full build — and write the three numbers at the top of your product file as a comment. Checkpoint: you can state your personal module-to-full ratio; it is the number that decides, every day from now on, whether you reach for `m welcomed` or `m`, and it is different on every machine, which is why you measured yours instead of believing this page's.

**Tier 3 — bench (optional, 30 min).** In any real product tree you have access to, identify its `AndroidProducts.mk` registration, its top product makefile, and one `PRODUCT_PACKAGES` entry whose module lives three directories away. Note one place the product inherits something its team probably no longer wants.

*Verification status: product registration, inheritance, board inclusion, release-config names, and Cuttlefish paths checked against `android-17.0.0_r1` (`docs/verification/lecture-02-source-truth.md`). The Tier 2 build-and-boot cycle was not run in the authoring environment; first full build on your machine is the verification, so keep the capture.*

<div class="section-recap"><span class="block-label">Now you can</span><p>Lunch <code>kestrel_auto</code>, pass <code>m nothing</code>, and prove your product on a running system — with a checkpoint green at every step.</p></div>

## Exercises
<div class="section-opener"><span class="block-label">In this section</span><p>Exercises that test build reading, not build memory: follow an inheritance chain, explain a lunch name, and diagnose a failure from its first error.</p></div>

1. A colleague keeps editing Cuttlefish's `aosp_cf.mk` to add acme packages "because that's the file lunch reads". Explain, in the three-strings vocabulary, what they are actually changing and where kestrel's additions belong.
2. Your `PRODUCT_VENDOR_PROPERTIES` change builds cleanly but `getprop` on the booted system shows the old value. List the causes in build order and the check that eliminates each.
3. A teammate proposes shipping `welcomed`'s configuration file and the daemon binary both via `PRODUCT_COPY_FILES` "to keep everything in one list". Accept one half, reject the other, and write the two lines you would merge instead.
4. After renaming the device directory to `device/acme/kestrel2`, `lunch` still works but the build fails looking for board configuration. Name the variable that did not follow the rename, the two places it must agree, and why lunch did not catch it.
5. `m welcomed` fails with an undefined reference to `AServiceManager_addService` in `main.cpp`. State which kind of failure this is (existence, selection, or neither), the file you open first, and the exact dependency you expect to find missing.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. They are editing the upstream reference product that `kestrel_auto` (and every other product inheriting it) stands on, so the change leaks into all of them and will be overwritten by the next sync. Lunch reads the *registration* (`AndroidProducts.mk`) to find a product makefile; the product it selects for us is `kestrel_auto`, whose makefile is where acme's selection decisions (`PRODUCT_PACKAGES`, properties) belong, after the inherit line so they take precedence.
2. In build order: wrong product lunched or booted (`ro.product.device`/fingerprint vs `TARGET_PRODUCT`); the property was baked but the image/instance under test was not rebuilt or relaunched after the edit (a module build cannot change a baked property); a later assignment in the inheritance chain overrides yours (search `PRODUCT_VENDOR_PROPERTIES` across the inherited files for the same key — last assignment wins, and yours must come after the inherit). The eliminating checks are `getprop ro.build.fingerprint`, rebuilding and relaunching deliberately, and a `grep` of the inherit chain, in that order.
3. Accept the configuration file as a copy: configuration and data are what `PRODUCT_COPY_FILES` is for (e.g. `PRODUCT_COPY_FILES += device/acme/kestrel/welcomed.conf:$(TARGET_COPY_OUT_VENDOR)/etc/welcomed.conf`, with a Lecture 9 label for its path if the daemon reads it). Reject the binary: it must ship as the Soong module so dependencies, install path, and the `welcomed_exec` label apply. The two lines: the `PRODUCT_COPY_FILES` line above, and `PRODUCT_PACKAGES += welcomed` (already in `kestrel_auto.mk`).
4. `PRODUCT_DEVICE`. It is set in `kestrel_auto.mk` (`:= kestrel`) and it names the device directory the build searches for `BoardConfig.mk`; after the rename it must read `kestrel2` (or the directory must keep the name the variable expects) — the variable and the directory name are the two places that must agree. Lunch did not catch it because lunch resolves the product registration (`AndroidProducts.mk` → product makefile), which never moved; board-config lookup happens later, at build time, through `PRODUCT_DEVICE`.
5. Neither a selection failure nor a product failure: the module exists and was selected, and its own build graph is incomplete — a missing link dependency. Open the module's definition first (`device/acme/kestrel/welcomed/Android.bp`), not the product makefile. Expect `libbinder_ndk` missing from `shared_libs`: `AServiceManager_addService` lives in the NDK Binder library, and Lecture 9's annex lists it for exactly this reason. Fix the dependency in the `Android.bp`; never paper over a link error from the product side.

</details>

<div class="section-recap"><span class="block-label">Now you can</span><p>Read a product's inheritance chain cold and predict what a build will accept before you run it.</p></div>

## Go deeper: kernel and app pointers
<div class="section-opener"><span class="block-label">In this section</span><p>Where build knowledge points next: kernel builds follow the same philosophy with different files, and app builds meet the platform at its governed seams.</p></div>

Kernel builds (Kleaf) follow the same philosophy with different files: a module graph, a product selection, and output you verify rather than assume; see step 2 of the [kernel path]({{ '/kernel-path/' | relative_url }}). On the app side, an `android_app` module plus its product entry is how a system app ships; the [app path]({{ '/app-path/' | relative_url }}) step 2 covers the permission half, and Lecture 8 now owes you the rest of that file set for `com.acme.welcome`.

<div class="callout"><p><strong>Working with AI agents:</strong> build errors are good agent food, with one discipline: paste the <em>first</em> failure, and make the agent classify it before fixing it — existence or selection, and the exact file it would open. Agents invent module types and makefile variables fluently; every variable an agent names (<code>PRODUCT_*</code> included) is guilty until <code>grep</code> in your tree proves it real. And never let an agent "fix" a product problem by editing anything under <code>out/</code>.</p></div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Follow the kernel or app build pointer that matches your next question — with this lecture's pipeline model in hand.</p></div>
