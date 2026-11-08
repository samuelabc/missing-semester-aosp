# Lecture 11 — source-truth verification

Every real path, variable, flag, and output format claimed in
`_lectures/11-ota-shipping.md`, checked against the pinned baseline
`android-17.0.0_r1` (android.googlesource.com, `?format=TEXT`) on 2026-11-08.
acme/kestrel files are fictional and listed at the end; all command outputs in
the lecture are representative samples in the tools' real formats. The full
build → payload → apply → rollback cycle was **not** executed in the authoring
environment; the lecture says so, and its Tier 2 lab exists to make it real.

| # | Claim in the lecture | Upstream source at `android-17.0.0_r1` |
|---|---|---|
| 1 | Reference target is A/B with dynamic partitions and full AVB: `AB_OTA_UPDATER := true`; `AB_OTA_PARTITIONS` covers `boot init_boot vendor_boot system system_ext product vendor odm *_dlkm vbmeta vbmeta_system vbmeta_*_dlkm`; `BOARD_AVB_ENABLE := true`, `BOARD_AVB_ALGORITHM := SHA256_RSA4096`, AVB key = published test key `external/avb/test/data/testkey_rsa4096.pem`; chained vbmeta for `product system system_ext` plus boot/init_boot/vendor_dlkm/system_dlkm, rollback-index locations 1–5; `BOARD_SUPER_PARTITION_SIZE := 8589934592` (8 GiB) with system group 6,845,104,128 B (product/system/system_ext/system_dlkm) and vendor group 1,472,200,704 B (odm/vendor/vendor_dlkm/odm_dlkm); `BOARD_USES_METADATA_PARTITION := true`; boot/vendor_boot images 67,108,864 B, init_boot 8,388,608 B | `device/google/cuttlefish` → `shared/BoardConfig.mk` (every quoted line read verbatim; kestrel inherits this file through Lecture 2's `-include` chain) |
| 2 | Rollback index on the reference target is the security-patch timestamp: `BOARD_AVB_*_ROLLBACK_INDEX := $(PLATFORM_SECURITY_PATCH_TIMESTAMP)` | `shared/BoardConfig.mk` (all five chained-partition blocks) |
| 3 | Virtual A/B is switched on at product level, not in BoardConfig: `PRODUCT_VIRTUAL_AB_OTA := true` + `ro.virtual_ab.enabled=true`; reference target sets compression `PRODUCT_VIRTUAL_AB_COMPRESSION_METHOD := lz4`, `PRODUCT_VIRTUAL_AB_COW_VERSION := 3`, `PRODUCT_VIRTUAL_AB_COMPRESSION_FACTOR := 65536` | `platform/build` → `target/product/virtual_ab_ota/launch.mk`; `device/google/cuttlefish` → `shared/device.mk` |
| 4 | `update_engine_client` flags: `--update`, `--payload`, `--offset`, `--size`, `--headers`, `--verify`, `--allocate`, `--metadata`, `--switch_slot=true\|false`, `--suspend`, `--resume`, `--cancel`, `--reset_status`, `--follow`, `--merge` | `platform/system/update_engine` → `aosp/update_engine_client_android.cc` (`DEFINE_*` block) |
| 5 | update_engine registers its binder service as `android.os.UpdateEngineService`; header-verification lives in `certificate_checker.cc` | `platform/system/update_engine` → `aosp/binder_service_android.h` (`ServiceName()`), `aosp/daemon_android.cc` (`RegisterService`), root listing (`certificate_checker.cc`) |
| 6 | After a successful post-update boot, update_engine asks the boot-control HAL to mark the slot successful: `boot_control_->MarkBootSuccessfulAsync(...)` | `platform/system/update_engine` → `aosp/update_attempter_android.cc` |
| 7 | Boot-control HAL surface: `getCurrentSlot`, `getActiveBootSlot`, `getNumberSlots`, `getSuffix`, `isSlotBootable`, `isSlotMarkedSuccessful`, `markBootSuccessful`, `setActiveBootSlot`, `setSlotAsUnbootable`, `getSnapshotMergeStatus`, `setSnapshotMergeStatus` | `platform/hardware/interfaces` → `boot/aidl/android/hardware/boot/IBootControl.aidl` |
| 8 | OTA generation: `ota_from_target_files` accepts `--incremental_from=`, `--downgrade`, `--override_timestamp`, `--no_signing`, `--partial=`, `--skip_postinstall`, `--disable_vabc`, `--vabc_downgrade`, `--spl_downgrade`, `--security_patch_level=`; the package is signed with `OPTIONS.package_key` | `platform/build` → `tools/releasetools/ota_from_target_files.py` (`extra_long_opts`), `tools/releasetools/ota_utils.py` (`FinalizeMetadata`/`SignOutput`) |
| 9 | Release re-signing: `sign_target_files_apks -k/--key_mapping src=dest`, `-d/--default_key_mappings <dir>`; it re-signs AVB images internally (`--avbtool`, `--key`, `--algorithm`) | `platform/build` → `tools/releasetools/sign_target_files_apks.py` |
| 10 | The build tree's keys are public test keys and must never ship: `testkey`, `platform`, `shared`, `media`, `networkstack`, `bluetooth`, `nfc`, `sdk_sandbox` (`.pk8` + `.x509.pem`) | `platform/build` → `target/product/security/` (directory listing + README) |
| 11 | AVB design: chained partitions delegate authority to other vbmeta images; every VBMeta carries a rollback index; the device keeps the highest seen rollback index per location in tamper-evident storage, per slot; `avbtool make_vbmeta_image --algorithm --key --rollback_index --rollback_index_location --chain_partition part:loc:key.bin` | `platform/external/avb` → `README.md` (chained-partition and rollback-index sections) |
| 12 | AAOS garage mode exists as a designed maintenance window in CarService | `platform/packages/services/Car` → `service/src/com/android/car/garagemode/{GarageMode.java, GarageModeController.java, GarageModeRecorder.java, GarageModeService.java}` |

## Fictional — acme

- `device/acme/kestrel/keys/release/` key paths and the release override block
  appended to Lecture 2's `BoardConfig.mk` (placement after the Cuttlefish
  `-include`, so `:=` assignments win — verified make semantics, invented
  content).
- The kestrel *slot sheet* as a document: partitions, sizes, and rollback
  locations are the reference target's real values (row 1); the sheet's
  layout, owner column, and pass/fail lines are the lecture's invention.
- Builds "N" and "N+1", their fingerprints, the `payload.bin` listing, slot
  flips `_a` → `_b`, and all `update_engine_client --follow` output:
  representative, in the real tools' formats. Target-files zip naming follows
  the build's `$(TARGET_PRODUCT)-target_files-*` convention.
- The rehearsed-rollback drills (corrupted inactive slot refused by verified
  boot; booting-but-unhealthy build kept from the success mark) are described
  from rows 6, 7, and 11, not executed; Tier 2 of the lab performs them.
