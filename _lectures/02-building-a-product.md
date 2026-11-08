---
number: 2
title: "Building a product"
subtitle: "Soong, lunch, product configuration, and how to stop doing full builds."
---

## Motivation

"The build is broken" is the most expensive sentence in an OEM program when the person saying it cannot tell a Soong error from a missing file from a wrong lunch target. Builds also eat hours: engineers who only know `make -j` lose a day a week to recompilation they never needed. This lecture makes you dangerous: pick a target, change a product, build the smallest thing that proves the change, read the error when it is not.

## Mental model

A build is one pipeline (REPL for understanding it): **Repo assembles sources → Soong parses `Android.bp` into modules → the product configuration selects modules, files, and overlays → Ninja compiles and packages → images land in `out/target/product/<product>/`.**

Soong's unit is the module: a named target in an `Android.bp` file (`cc_binary`, `java_library`, `android_app`, `aidl_interface`, and dozens more). It replaces most of Make for defining *what* exists. Makefiles remain for *which product*: `device/<vendor>/<product>/` holds `AndroidProducts.mk`, product makefiles (`PRODUCT_PACKAGES`, `PRODUCT_COPY_FILES`, `PRODUCT_PROPERTY_OVERRIDES`), and `BoardConfig.mk` (partition sizes, kernel, bootloader facts).

`lunch <product>-<release>-<variant>` chooses the product and build variant: `eng` (debugging on, for development), `userdebug` (root-able, close to production, the OEM daily driver), `user` (what ships). When in doubt during this course: `userdebug`.

## Walkthrough

```bash
source build/envsetup.sh
lunch aosp_cf_x86_64_auto-ap4a-userdebug   # Cuttlefish AAOS reference target (verify name in device/google/cuttlefish)
m nothing                                  # smoke test: build system alive, nothing built
```

Read your own product before changing anything:

```bash
# What makes this product this product?
cat device/google/cuttlefish/AndroidProducts.mk
grep -rn "PRODUCT_PACKAGES +=" device/google/cuttlefish/vsoc_x86_64/auto/*.mk
# Why is a module in the image? Ask the build, do not guess.
m CarService           # build one module and its deps (in general: m <module-name>)
mm                    # build modules in this directory (after cd into it)
mma                   # same, plus dependencies
```

Add a package to a product: find the product makefile your target inherits, add the module name to `PRODUCT_PACKAGES`, rebuild the module, and confirm it landed (`ls out/target/product/*/system/app/` or `adb shell pm list packages` after flashing/booting). Add a file with `PRODUCT_COPY_FILES` and state out loud why a file copy is right here instead of a module (config and data, yes; code, almost never).

Reading errors is a skill with a method: Soong errors name the `Android.bp` and the rule (`module X missing dependency Y` means add the dep to `deps`/`static_libs`, not edit generated files under `out/soong`). Ninja errors are compiler errors with a long memory; scroll to the *first* failure, not the last line. Never edit anything under `out/`; it is regenerated and your fix will vanish, a rite of passage you can skip.

Kill the full-build habit. Full `m` is for releases and for proving a clean tree. Daily work is `m <module>`, push or sync the artifact, restart the affected service (`adb root && adb remount`, or `adb sync` where supported), and reserve full builds for changes that cross module boundaries.

<div class="callout"><p><strong>Cloud builds:</strong> if your machine is short on RAM, a cloud VM (32–64 GB RAM, 300 GB disk, fast cores beats fancy cores) is the standard answer. Lecture sizing is in <a href="/setup/">Setup</a>. First sync and first build are slow everywhere; budget them once, not per lab.</p></div>

## Lab (tiered)

**Tier 1 (no build, 30 min).** On any machine with a synced tree, run `lunch` on the AAOS Cuttlefish target, then `m nothing`. Open its product makefiles and list the inherited chain from target to `PRODUCT_PACKAGES` for one car app.

**Tier 2 (Cuttlefish, 2–3 h).** Build one existing module (`m CarService` or a small native module), change one visible string or property default in your product config, rebuild only that module, and get the change onto a running Cuttlefish instance. Time each step; the gap between module build and full build is the lesson.

*Verification status: commands and target naming checked against the pinned baseline documentation; a full Cuttlefish build was not run in the authoring environment, so treat exact target names as verify-on-first-sync.*

<div class="checkpoint"><strong>Checkpoint:</strong> you changed something at product level, proved it on a running system, and never ran a full <code>m</code>. If you did run one, note what forced it; that list is short and worth knowing.</div>

## Exercises

1. Explain the difference between `Android.bp` and a product makefile to a colleague who keeps editing the wrong one.
2. Your change to `PRODUCT_PROPERTY_OVERRIDES` did not appear on device. List three causes in build order, before touching the device.
3. `m` fails with a missing dependency in an `Android.bp` you did not touch. What do you check before concluding the tree is broken?
4. Convert a hypothetical `PRODUCT_COPY_FILES` entry for a Java library into the right mechanism, and say why.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. `Android.bp` defines that a module exists and how it compiles; product makefiles decide whether it ships in this product.
2. Wrong product/`lunch` combo, the property is overridden later in inheritance, or you never rebuilt/reflashed the partition that carries it.
3. Your sync state (`repo status`), whether the dep exists under another name/visibility rule (`visibility:` in Soong), and whether a colleague's cherry-pick broke the manifest assumptions.
4. Ship it as a package/module (`PRODUCT_PACKAGES` with a `java_library`/`android_app`); copied jars bypass Soong's dependency, dex, and signing handling.

</details>

## Go deeper: kernel and app pointers

Kernel builds (Kleaf) follow the same philosophy with different files; see step 2 of the [kernel path](/kernel-path/). On the app side, an `android_app` module plus privileged-permission allowlists is how system apps ship; the [app path](/app-path/) step 2 covers the permission half, and Lecture 8 the overlay half.

<div class="callout"><p><strong>Working with AI agents:</strong> build errors are good agent food: paste the <em>first</em> Soong/Ninja failure and ask for the module graph explanation, then verify the named files exist. Agents hallucinate module types and makefile variables with total confidence, so treat every suggested variable as guilty until <code>grep</code> proves it real.</p></div>
