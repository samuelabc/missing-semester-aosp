# Lecture 2 (Building a product) — source-truth table

Verification date: 2026-11-08. Pinned baseline: `android-17.0.0_r1`
(tag as confirmed for Lecture 9). Lecture 2 snippets are traced below or
marked **Fictional — acme**.

## Upstream-traced facts

| # | Claim used in lecture | Source at `android-17.0.0_r1` |
|---|---|---|
| 1 | Cuttlefish products are registered as `name:$(LOCAL_DIR)/path/aosp_cf.mk` lines in `PRODUCT_MAKEFILES`, with `COMMON_LUNCH_CHOICES` below | `device/google/cuttlefish/AndroidProducts.mk` |
| 2 | The x86_64 AAOS lunch name is `aosp_cf_x86_64_auto`, mapped to `vsoc_x86_64_only/auto/aosp_cf.mk` (not `vsoc_x86_64/auto/…` — an earlier course draft had this wrong; Lecture 9's Stage 0 grep path is corrected by this lecture) | Same file, line `aosp_cf_x86_64_auto:$(LOCAL_DIR)/vsoc_x86_64_only/auto/aosp_cf.mk` |
| 3 | That product file sets `PRODUCT_NAME := aosp_cf_x86_64_only_auto` and `PRODUCT_DEVICE := vsoc_x86_64_only` — lunch name, product name, and device are three different strings | `device/google/cuttlefish/vsoc_x86_64_only/auto/aosp_cf.mk` |
| 4 | AAOS inheritance chain for that target: `core_64_bit_only.mk` → `packages/services/Car/car_product/build/car_generic_system.mk` → `car_system_ext.mk` → `car_product.mk` → `device/google/cuttlefish/shared/auto/device_vendor.mk`, then kernel/bootloader fragments | Same file |
| 5 | `vsoc_x86_64_only/BoardConfig.mk` sets arch variables then `-include device/google/cuttlefish/shared/BoardConfig.mk`, which is where `BOARD_VENDOR_SEPOLICY_DIRS += device/google/cuttlefish/shared/sepolicy/vendor` lives | `device/google/cuttlefish/vsoc_x86_64_only/BoardConfig.mk`; `shared/BoardConfig.mk` |
| 6 | Release names usable in lunch combos are release-config files; `ap4a.textproto` and `trunk_staging.textproto` both exist at this tag (course baseline uses `ap4a`; Cuttlefish's own `COMMON_LUNCH_CHOICES` uses `trunk_staging`) | `platform/build/release/release_configs/` listing |
| 7 | Car product packages and sepolicy dirs are added with `PRODUCT_PACKAGES +=` / `PRODUCT_PRIVATE_SEPOLICY_DIRS +=` in car product makefiles | `packages/services/Car/car_product/build/car.mk` |
| 8 | `m selinux_policy` is the policy compile/neverallow-check target; per-partition `selinux_policy_vendor` also exists | `platform/system/sepolicy/Android.bp` (from Lecture 9 verification) |
| 9 | A vendor daemon's domain/service/property types and macros used again here (`init_daemon_domain`, `add_service`, `vendor_restricted_prop`) | Lecture 9 source-truth table, rows 3–11 |

## Fictional — acme (labelled as such on the page)

- `device/acme/kestrel/AndroidProducts.mk`, `kestrel_auto.mk`, and the
  grown-up `BoardConfig.mk` (reference-board form: `-include` the
  Cuttlefish board config, then add acme sepolicy). All variable names
  and `inherit-product` mechanics are upstream's; the files are ours.
- Lunch combo `kestrel_auto-ap4a-userdebug` (release segment per row 6).
- `kestrel-info` (`sh_binary` script module) as the lab's second module.
- All terminal output blocks are representative samples in the real
  tools' formats; the lecture says so wherever a learner's tree will
  differ (device name in `out/target/product/kestrel/`, timings).
- Tier 2's build-and-boot cycle was not run in the authoring
  environment (ADR-0002 labelling, same as Lecture 9).

## Corrections this lecture makes to earlier pages

- Lecture 9, Stage 0: the grep path `device/google/cuttlefish/
  vsoc_x86_64/auto/` is corrected to `vsoc_x86_64_only/auto/`, and its
  "Lecture 2 will make this a real target" note is retired — after
  this lecture, `kestrel_auto` is the lunch target and the
  Cuttlefish BoardConfig overlay line is no longer needed.
