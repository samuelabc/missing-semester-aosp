# Lecture 12 — source-truth verification

Every real path, module shape, and test-suite fact claimed in
`_lectures/12-testing-compliance.md`, checked against the pinned baseline
`android-17.0.0_r1` (android.googlesource.com, `?format=TEXT`) on 2026-11-08.
acme/kestrel files are fictional and listed at the end; all test outputs in
the lecture are representative samples in the tools' real formats. No test
suite was executed in the authoring environment; Tier 2 of the lab runs them.

| # | Claim in the lecture | Upstream source at `android-17.0.0_r1` |
|---|---|---|
| 1 | AIDL HAL VTS tests live beside the interface: `hardware/interfaces/light/aidl/vts/functional/VtsHalLightTargetTest.cpp` (+ `Android.bp` with `test_suites: ["vts"]`); fixture is `testing::TestWithParam<std::string>`; `SetUp()` obtains the service (`waitForDeclaredService`) and asserts non-null; cases are `TEST_P`, including invalid-input negatives (`TestInvalidLightIdUnsupported`, `TestEffectsInvalid*`) | `platform/hardware/interfaces` → `light/aidl/vts/functional/` (directory listing + file read) |
| 2 | `CtsCarTestCases` is the automotive CTS module: `tests/tests/car/AndroidTest.xml` (suite config for "CTS Automotive test cases", component `auto`), gated to automotive devices by `DeviceFeatureModuleController` (`required-feature android.hardware.type.automotive`), installing `CtsCarTestCases.apk`; test classes under `src/android/car/cts/` | `platform/cts` → `tests/tests/car/AndroidTest.xml`, `src/android/car/cts/` listing |
| 3 | Driving-state sensor requirements are CDD-backed CTS: `android.car.cts.CarSensorManagerTest` carries `testRequiredSensorsForDrivingState`, `testMustSupportParkingBrake`, `testMustSupportNightSensor` and imports `com.android.compatibility.common.util.CddTest` (the CDD traceability annotation) | `platform/cts` → `tests/tests/car/src/android/car/cts/CarSensorManagerTest.java` |
| 4 | CarService-level test harnesses in the car tree: `tests/CarServiceTest`, `tests/CarServiceUnitTest`, `tests/vehiclehal_test`, plus test apps such as `tests/GarageModeTestApp` | `platform/packages/services/Car` → `tests/` directory listing |
| 5 | The welcome HAL's authorization negative is a policy fact, not an assumption: only `system_server` holds `find` on `hal_welcome_service` (`allow system_server hal_welcome_service:service_manager find;` + `binder_call(system_server, welcomed)`); no app domain can find the service, so no app can call the daemon directly | `_lectures/09-selinux-security.md` (verified in `docs/verification/lecture-09-source-truth.md`), `device/acme/kestrel/sepolicy/vendor/welcomed.te` (fictional file, real format) |
| 6 | Interface under test is the frozen v1: methods `getState()` (transaction 1) and `setEnabled(boolean)` (transaction 2); stubs ship as `vendor.acme.hardware.welcome-V1-ndk` / `-V1-java` | `_lectures/06-treble-hal-vintf.md`, `_lectures/09-selinux-security.md` annex (`getState(int32_t*)` implementation) |
| 7 | Behaviour-test observables: `WelcomeLightService` reports `setCalls`/`deniedCalls`/`failedCalls` and `hal=connected` via `dumpsys welcome_light`; mutating calls enforce `android.permission.CONTROL_WELCOME_LIGHT`; vehicle stimulus via `cmd car_service inject-vhal-event <propId> <area> <value>` | `_lectures/05-binder-aidl-services.md`, `_lectures/07-aaos-carservice-vhal.md` (each verified in its own source-truth doc) |

## Fictional — acme

- `device/acme/kestrel/welcomed/vts/functional/` (`VtsHalWelcomeLightTargetTest`,
  its `Android.bp`, and the test-only sepolicy file that grants the test
  domain `find` on lab builds), `device/acme/kestrel/tests/car/`
  (`WelcomeDoorLightTest`): invented modules in upstream's layouts and
  formats; no upstream names are claimed for them.
- The `CtsCarTestCases` failure excerpt (module, class, and method are real
  per rows 2–3; the failure text and timestamps are representative), the
  kestrel VHAL property-table delta it is attributed to, and all pass/fail
  transcripts: representative, not captured. Tier 2 produces the real ones.
