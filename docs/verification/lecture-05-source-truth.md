# Lecture 5 (Binder, AIDL, and custom system services) — source-truth table

Verification date: 2026-11-08. Pinned baseline: `android-17.0.0_r1`.

## Upstream-traced facts

| # | Claim used in lecture | Source at `android-17.0.0_r1` |
|---|---|---|
| 1 | `SystemService` lifecycle: `public abstract void onStart()`, `public void onBootPhase(@BootPhase int phase)`, `protected final void publishBinderService(name, binder)`, `public final Context getContext()` | `platform/frameworks/base/services/core/java/com/android/server/SystemService.java` (lines ~374, 420, 474, 632) |
| 2 | Boot-phase constants 100/200/480/500/520/550/600/1000 (`PHASE_SYSTEM_SERVICES_READY = 500`, `PHASE_BOOT_COMPLETED = 1000`) | Same file (also Lecture 4 row 12) |
| 3 | Registration is one line: `mSystemServiceManager.startService(FooService.class)` (~220 call sites); `SystemServiceManager` also offers `startService(String)` and `startServiceFromJar(className, path)` | `platform/frameworks/base/services/java/com/android/server/SystemServer.java`; `.../SystemServiceManager.java` |
| 4 | Java `ServiceManager`: `getService`, `checkService`, `waitForService`, `addService`, `listServices`, `isDeclared` | `platform/frameworks/base/core/java/android/os/ServiceManager.java` |
| 5 | Caller identity: `Binder.getCallingUid()`, `getCallingPid()`, `clearCallingIdentity()` / `restoreCallingIdentity(token)` | `platform/frameworks/base/core/java/android/os/Binder.java` |
| 6 | `Context.enforceCallingOrSelfPermission(permission, message)` is the service-side enforcement entry point | `platform/frameworks/base/core/java/android/content/Context.java` |
| 7 | Permission checks grant root and the system process unconditionally ("Root, system server get to do everything") — why `adb root` succeeds where plain `adb shell` is denied | `platform/frameworks/base/core/java/android/app/ActivityManager.java` `checkComponentPermission` |
| 8 | `aidl_interface` Java backend: `backend.java` with `sdk_version: "module_current"` (light HAL pattern); frozen interfaces carry `versions_with_info` | `platform/hardware/interfaces/light/aidl/Android.bp` |
| 9 | Framework/car Java code consumes vendor AIDL HALs as generated Java classes (e.g. `android.hardware.automotive.vehicle.*` imported by CarService's `VehicleHal`, with `linkToDeath` death handling) | `platform/packages/services/Car/service/src/com/android/car/hal/VehicleHal.java` |
| 10 | System-service SELinux type pattern: `type <x>_service, system_server_service, service_manager_type;` | `platform/system/sepolicy/private/service.te` (many examples) |
| 11 | Publishing grant is attribute-carried: `add_service(system_server, system_server_service);` where `add_service` expands to `allow $1 $2:service_manager { add find }` + neverallow on others adding | `private/system_server.te`; `public/te_macros` |
| 12 | Plain-name service labels live in system `service_contexts` (e.g. `country_detector  u:object_r:country_detector_service:s0`) | `platform/system/sepolicy/private/service_contexts` |
| 13 | The `service` shell tool writes the interface token itself (from `getInterfaceDescriptor()`) before transacting, so `service call <name> <code> i32 …` reaches the right Stub method | `platform/frameworks/native/cmds/service/service.cpp` |
| 14 | Small framework AIDL shape (`IDeviceIdentifiersPolicyService.aidl`, `@hide`, one-purpose methods) | `platform/frameworks/base/core/java/android/os/IDeviceIdentifiersPolicyService.aidl` |
| 15 | Module edited for service code/libraries: `services.core` java_library | `platform/frameworks/base/services/core/Android.bp` |

## Fictional — acme (labelled on the page)

- `com.acme.welcome.IWelcomeLightService` AIDL, `WelcomeLightService`, the
  `welcome_light` service name, `android.permission.CONTROL_WELCOME_LIGHT`,
  and the `welcome_light_service` sepolicy type are acme platform artifacts
  written in upstream's shapes (rows 1–15). Enabling the Java backend of
  Lecture 9's `vendor.acme.hardware.welcome` interface is the one edit to a
  prior lecture's file; Lecture 6 freezes that interface.
- All `service list` / `service call` / `dumpsys` outputs are representative
  samples in the real tools' formats; the lecture says so. Tier 2 (run the
  service on Cuttlefish) was not executed in the authoring environment
  (ADR-0002 labelling).
