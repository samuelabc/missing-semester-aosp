# Lecture 1 — source-truth verification

Every real path and value claimed in `_lectures/01-mental-model.md`, checked
against the pinned baseline `android-17.0.0_r1` (android.googlesource.com,
`?format=TEXT`) on 2026-11-08, or carried from an earlier lecture's verified
table (cited per row). acme/kestrel names are the course's frozen fiction
(GLOSSARY.md). Command outputs in the lecture are representative.

| # | Claim in the lecture | Source |
|---|---|---|
| 1 | Vehicle properties are composed by bit algebra; `HVAC_FAN_SPEED = 0x0500 + 0x10000000 (SYSTEM) + 0x05000000 (HVAC area) + type bits`, and the car-lib mirror constant reads `public static final int HVAC_FAN_SPEED = 356517120` (0x15400500) | `platform/hardware/interfaces` → `automotive/vehicle/aidl_property/android/hardware/automotive/vehicle/VehicleProperty.aidl`; `platform/packages/services/Car` → `car-lib/src/android/car/VehiclePropertyIds.java` |
| 2 | App-facing car APIs: `CarPropertyManager` (`car-lib/src/android/car/hardware/property/`), `CarHvacManager` (`car-lib/src/android/car/hardware/hvac/CarHvacManager.java`); service side `CarPropertyService` (`service/src/com/android/car/CarPropertyService.java`); HAL contract `IVehicle`, config type `VehiclePropConfig` | Lecture 7 source-truth rows 5, 6, 9, 10 (`docs/verification/lecture-07-source-truth.md`), re-fetched where quoted |
| 3 | Emulated/reference VHAL reads property configs from JSON (`DefaultProperties.json`) under `automotive/vehicle/aidl/impl/current/` | Lecture 7 source-truth row 7 |
| 4 | Reference product anatomy: `device/google/cuttlefish/vsoc_x86_64_only/auto/aosp_cf.mk` inherits `packages/services/Car/car_product/build/{car_generic_system,car_system_ext,car_product}.mk` and `device/google/cuttlefish/shared/auto/device_vendor.mk`; `PRODUCT_DEVICE := vsoc_x86_64_only` | Lecture 2 (read verbatim there; `docs/verification/lecture-02-source-truth.md`) |
| 5 | `cmd car_service` verbs used in the lab (`get-property-value`, `inject-vhal-event`, `list-vhal-props`) | Lecture 7 source-truth row 12 |

## Fictional — acme

- The welcome chain (`welcomed`, `WelcomeLightService`, `WelcomeLightController`,
  `com.acme.welcome`, `ACME_DOOR_STATE`, …) is presented as a *preview map*:
  each name is created in the lecture its table row cites. Nothing in this
  lecture asks the learner to build or run acme code.
- The HVAC trace is upstream-only and read-only by design.
