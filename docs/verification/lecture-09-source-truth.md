# Lecture 9 (SELinux) — source-truth table

Verification date: 2026-11-08. Pinned baseline: `android-17.0.0_r1`
(tag confirmed present on android.googlesource.com for
`platform/system/sepolicy`, peeled commit `e066568e98d8…` at check time).
Every snippet in the rewritten Lecture 9 is either traced to a row below or
marked **Fictional — acme**. Nothing fictional is presented as upstream.

## Upstream-traced facts

| # | Claim used in lecture | Source at `android-17.0.0_r1` |
|---|---|---|
| 1 | Device policy lives in `device/<vendor>/<board>/sepolicy` and is linked via `BOARD_VENDOR_SEPOLICY_DIRS` set in `BoardConfig.mk`; order matters; intermediate conf at `out/target/product/<device>/obj/ETC/vendor_sepolicy.conf_intermediates/vendor_sepolicy.conf` | `platform/system/sepolicy/README.md` ("Policy Generation") |
| 2 | `SYSTEM_EXT_*_SEPOLICY_DIRS`, `PRODUCT_*_SEPOLICY_DIRS`, `BOARD_ODM_SEPOLICY_DIRS` amend other partitions; old `BOARD_PLAT_*` deprecated | `platform/system/sepolicy/README.md` (same section) — also real use in `device/google/cuttlefish/shared/BoardConfig.mk` |
| 3 | Vendor daemon template: `type hal_vehicle_default, domain;` + `hal_server_domain(...)` + `type hal_vehicle_default_exec, exec_type, vendor_file_type, file_type;` + `init_daemon_domain(hal_vehicle_default)` | `platform/system/sepolicy/vendor/hal_vehicle_default.te` |
| 4 | `init_daemon_domain(X)` expands to `domain_auto_trans(init, X_exec, X)` | `platform/system/sepolicy/public/te_macros` |
| 5 | `add_service(server, type)` grants `service_manager { add find }` to the server only, with a neverallow on other domains adding; `hal_attribute_service` wraps it with client `find` | `platform/system/sepolicy/public/te_macros`; `private/hal_vehicle.te` (`hal_attribute_service(hal_vehicle, hal_vehicle_service)`) |
| 6 | AIDL HAL services are labelled in `service_contexts`, e.g. `android.hardware.automotive.vehicle.IVehicle/default u:object_r:hal_vehicle_service:s0`, type declared as `type hal_vehicle_service, protected_service, hal_service_type, service_manager_type;` | `platform/system/sepolicy/private/service_contexts`; `public/service.te` |
| 7 | HIDL HALs are labelled in `hwservice_contexts`, e.g. `android.hardware.automotive.vehicle::IVehicle u:object_r:hal_vehicle_hwservice:s0` (87 lines total — a legacy surface) | `platform/system/sepolicy/private/hwservice_contexts` |
| 8 | Vendor service types are declared in the vendor sepolicy dir, e.g. Cuttlefish `service.te`: `type hal_wireless_charger_service, hal_service_type, protected_service, service_manager_type;` and its `service_contexts` maps `vendor.google.wireless_charger.IWirelessCharger/default` to it | `device/google/cuttlefish/shared/sepolicy/vendor/{service.te,service_contexts}` |
| 9 | Cuttlefish vendor sepolicy layout is flat `.te` + contexts files in `shared/sepolicy/vendor/`, wired by `BOARD_VENDOR_SEPOLICY_DIRS += device/google/cuttlefish/shared/sepolicy/vendor` | `device/google/cuttlefish/shared/BoardConfig.mk`; directory listing at tag |
| 10 | Vendor property types: `vendor_internal_prop(vendor_…_prop)` in the vendor dir's `property.te`, mapped in `property_contexts` (optional `exact bool`/`exact string` suffixes) | `device/google/cuttlefish/shared/sepolicy/vendor/{property.te,property_contexts}`; macro in `public/te_macros` |
| 11 | `vendor_restricted_prop` = vendor may set, coredomain may read but not set (neverallow `{ coredomain -init } …:property_service set`) | `public/te_macros` |
| 12 | `file_contexts` vendor examples label binaries `/(vendor\|system/vendor)/bin/hw/… u:object_r:hal_…_exec:s0` and data `/data/vendor/mediadrm(/.*)? u:object_r:mediadrm_vendor_data_file:s0` | `platform/system/sepolicy/vendor/file_contexts`; `device/google/cuttlefish/shared/sepolicy/vendor/file_contexts` |
| 13 | `genfs_contexts` syntax `genfscon sysfs <path> u:object_r:<type>:s0`; types carry `fs_type, sysfs_type`; `sysfs_leds` already exists upstream | `device/google/cuttlefish/shared/sepolicy/vendor/genfs_contexts`; `platform/system/sepolicy/{private,public}/file.te` (`type sysfs_leds, fs_type, sysfs_type;`) |
| 14 | `seapp_contexts` selectors/outputs, e.g. `user=system seinfo=platform domain=system_app type=system_app_data_file` | `platform/system/sepolicy/private/seapp_contexts` (header + assignments) |
| 15 | `mac_permissions.xml`: `<signer signature="@TAG"><seinfo value="…"/></signer>`, package-refined form, and `keys.conf` mapping `[@TAG] ALL : $…/name.x509.pem`; final file is stripped of comments | `platform/system/sepolicy/{private/mac_permissions.xml,private/keys.conf,vendor/keys.conf}`; `README.md` |
| 16 | Keystore 2 namespaces: file format `<namespace-id> u:object_r:<type>:s0`, ids in use upstream are 0, 1, 100–120; types declared `type vold_key, keystore2_key_type;` | `platform/system/sepolicy/private/{keystore2_key_contexts,keystore_keys.te}` |
| 17 | `vndservice_contexts` contains only `manager` and a `*` default — vendor-to-vendor services only | `platform/system/sepolicy/vendor/vndservice_contexts` |
| 18 | Policy build/check target `selinux_policy` exists (phony, triggers neverallow tests); per-partition `selinux_policy_vendor` etc. also exist | `platform/system/sepolicy/Android.bp` |
| 19 | Context outputs are built per partition (`vendor_file_contexts`, `vendor_service_contexts`, `vendor_property_contexts`, `vendor_seapp_contexts`, `vendor_keystore2_key_contexts`, `vndservice_contexts`) from the `.vendor` file sets | `platform/system/sepolicy/contexts/Android.bp` |
| 20 | Official workflow: permissive-then-refine, `getenforce`, denial analysis, do not paste `audit2allow` output blindly; `foo.te` starter template with `init_daemon_domain(foo)` | source.android.com/docs/security/features/selinux/{implement,customize,device-policy,validate,build} |

## Fictional — acme (invented for the Running Example, labelled as such on the page)

- `device/acme/kestrel/`, product `kestrel_auto`, daemon `welcomed`
  (`/vendor/bin/welcomed`), domain/types `welcomed`, `welcomed_exec`,
  `welcomed_data_file`, `welcome_light_device`, `sysfs_welcome_led`,
  `hal_welcome_service`, `vendor_welcome_prop`, `welcomed_key`.
- AIDL interface `vendor.acme.hardware.welcome.IWelcomeLight` (one getter,
  one setter) and service instance `…IWelcomeLight/default`.
- Paths `/data/vendor/welcomed`, `/dev/welcome_light`,
  `/sys/class/leds/welcome` (+ its `/devices/platform/welcome-light/…`
  target), properties `vendor.acme.welcome.*`, app `com.acme.welcome`,
  seinfo `acme_welcome`, key tag `@ACME_PLATFORM` and its `.x509.pem` path.
- Keystore namespace id `200` (chosen because upstream-listed ids stop at
  120 in row 16; lecture tells learners to grep their tree for a free id).
- All `avc: denied` lines, `ps -Z`/`ls -Z` lines and log excerpts are
  representative samples in the documented kernel audit format; the page
  says device, inode and pid values will differ and that the Tier 2 cycle
  was doc/source-verified, not run on Cuttlefish in the authoring
  environment (per `docs/adr/0002`).

## Traps resolved (plan §84)

- `BOARD_VENDOR_SEPOLICY_DIRS` is current; `BOARD_SEPOLICY_DIRS` is the
  pre-Treble name (Cuttlefish still uses it once, for a Bluetooth library
  dir — noted, not imitated).
- AIDL HAL ≠ `hwservice_contexts`: AIDL → `service_contexts` (row 6),
  HIDL → `hwservice_contexts` (row 7).
- A vendor HAL does not need the platform `hal_attribute_*` plumbing to be
  correct: Cuttlefish vendor HALs declare the domain and call
  `add_service`/`add_hwservice` directly (rows 8, and
  `hal_wireless_charger.te`/`hal_wlc.te` in the same dir). The lecture
  teaches the direct form and shows the platform wrapper as reading.
- No certificate hash is invented: `mac_permissions.xml` uses a
  `keys.conf` tag, exactly like upstream `@PLATFORM` (row 15).
