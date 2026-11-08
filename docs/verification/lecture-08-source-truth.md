# Lecture 8 (Framework customization) — source-truth table

Verification date: 2026-11-08. Pinned baseline: `android-17.0.0_r1`.

## Upstream-traced facts

| # | Claim used in lecture | Source at `android-17.0.0_r1` |
|---|---|---|
| 1 | RRO Soong module: `runtime_resource_overlay { name, …, product_specific: true }` | `platform/frameworks/base/packages/overlays/NavigationBarModeGesturalOverlay/Android.bp` |
| 2 | Overlay manifest: `<overlay android:targetPackage="android" android:category="…" android:priority="1"/>` + `<application android:hasCode="false"/>` | Same package's `AndroidManifest.xml` |
| 3 | `cmd overlay list/enable/disable/dump`; OMS uses `idmap2`, mappings in `/data/resource-cache/`, inspect via `idmap2 dump`; enable per `--user` | Official docs: source.android.com/docs/core/runtime/rros (fetched 2026-11-08) |
| 4 | OverlayConfig (recommended Android 11+): `partition/overlay/config/config.xml` with `<config><overlay package="…" mutable="false" enabled="true"/></config>`; overlays must reside in the partition's `overlay/` dir to be configured; unlisted overlays are mutable and disabled by default | Same doc |
| 5 | A target without `<overlayable>` can only be overlaid by a preinstall on the system image or a same-signature package | Same doc |
| 6 | The signing/privilege trio in Soong: `certificate: "platform"`, `privileged: true`, `platform_apis: true` | `platform/packages/apps/Settings/Android.bp` |
| 7 | Privapp allowlist schema: `<permissions><privapp-permissions package="…"><permission name="…"/></privapp-permissions></permissions>`, files `privapp-permissions-*.xml` | `platform/frameworks/base/data/etc/privapp-permissions-platform.xml` (header comment) |
| 8 | Allowlist rules: same-partition only; permissions defined by the `android` package and by CarService must be allowlisted, OEM-defined privileged permissions auto-granted; `ro.control_privapp_permissions=log` reports `PackageManager: Privileged permission X for package Y - not in privapp-permissions allowlist`; `=enforce` + Android 9+ violations prevent boot | Official docs: source.android.com/docs/core/permissions/perms-allowlist (fetched 2026-11-08) |
| 9 | The app's policy identity already exists: `seapp_contexts` maps `com.acme.welcome` (seinfo `acme_welcome`, priv-app) to `system_app` domain | This course: Lecture 9 micro-example (checked against upstream `mac_permissions.xml`/`seapp_contexts` shapes in its own table) |

## Fictional — acme (labelled on the page)

- `AcmeWelcome` (`com.acme.welcome`), `KestrelWelcomeOverlay`
  (`com.acme.welcome.overlay.kestrel`), the welcome strings, and the
  product wiring are acme artifacts in upstream's shapes (rows 1–8).
  `certificate: "platform"` is written for Lecture 9's signer.
- All `cmd overlay` / `dumpsys package` outputs are representative samples
  in the real tools' formats; Tier 2 was not executed in the authoring
  environment (ADR-0002 labelling).
