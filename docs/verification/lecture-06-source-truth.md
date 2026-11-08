# Lecture 6 (Treble, HALs, and VINTF) — source-truth table

Verification date: 2026-11-08. Pinned baseline: `android-17.0.0_r1`.

## Upstream-traced facts

| # | Claim used in lecture | Source at `android-17.0.0_r1` |
|---|---|---|
| 1 | Frozen `aidl_interface` shape: `stability: "vintf"`, `frozen: true`, `versions_with_info` (versions 1–3), backends incl. `java: { sdk_version: "module_current" }` and rust | `platform/hardware/interfaces/light/aidl/Android.bp` |
| 2 | Snapshot layout `aidl_api/<name>/{1,2,3,current}/…` next to the interface | `platform/hardware/interfaces/light/aidl/aidl_api/android.hardware.light/` (gitiles listing) |
| 3 | Versioned generated libraries: `<name>-V<version>-<backend>` (e.g. `android.hardware.light-V3-rust` consumed by the default implementation) | `platform/hardware/interfaces/light/aidl/default/Android.bp` |
| 4 | Implementation installs its declaration via `vintf_fragments: ["lights-default.xml"]` (with `init_rc`) on the binary module | Same file |
| 5 | AIDL device-manifest fragment shape: `<manifest version="1.0" type="device"><hal format="aidl"><name>…</name><version>2</version><fqname>ILights/default</fqname></hal></manifest>` — declares the version the binary implements, not the newest frozen | `platform/hardware/interfaces/light/aidl/default/lights-default.xml` |
| 6 | Framework compatibility matrix AIDL entries use version *ranges* (`<version>2-3</version>`) with `<interface><name>…</name><instance>default</instance></interface>`; absence of `optional` means mandatory | `platform/hardware/interfaces/compatibility_matrices/compatibility_matrix.202604.xml` (light entry) |
| 7 | Legacy HIDL matrix entries: `<hal format="hidl">`, versions like `1.0`, `7.0-1` (reading-only bridge) | `compatibility_matrices/compatibility_matrix.7.xml` |
| 8 | Freeze tooling: `m <iface>-freeze-api` creates `aidl_api/<name>/<V>/` + `.hash` and updates `versions_with_info`; `*-update-api`/`*-freeze-api` own that field (don't hand-edit); per-version libs `foo-V1-…`, ToT builds as the next version | Official docs: source.android.com/docs/core/architecture/aidl/stable-aidl (fetched 2026-11-08) |
| 9 | libvintf incompatibility headline: "Device manifest and framework compatibility matrix are incompatible: …" | `platform/system/libvintf/VintfObject.cpp` |
| 10 | On-device device manifest: `/vendor/etc/vintf/manifest.xml` plus fragments in `/vendor/etc/vintf/manifest/` (odm analogues); framework side under `/system/etc/vintf/` | `platform/system/libvintf/VintfObject.cpp` (path comments) |

## Fictional — acme (labelled on the page)

- Freezing `vendor.acme.hardware.welcome` to v1, its manifest fragment
  `vendor.acme.hardware.welcome.xml`, and the acme framework matrix
  expectation for it are acme artifacts written in upstream's shapes
  (rows 1–10). Error *detail* lines shown under the real libvintf headline
  (row 9) are representative; the lecture says so.
- Tier 2 (run the freeze + mismatch on a Cuttlefish build) was not executed
  in the authoring environment (ADR-0002 labelling).
