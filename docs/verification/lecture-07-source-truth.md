# Lecture 7 (AAOS: CarService, Vehicle HAL, vehicle properties) — source-truth table

Verification date: 2026-11-08. Pinned baseline: `android-17.0.0_r1`.

## Upstream-traced facts

| # | Claim used in lecture | Source at `android-17.0.0_r1` |
|---|---|---|
| 1 | Property ID algebra: unique id `0x0100–0xffff` + `VehiclePropertyType` + `VehiclePropertyGroup` + `VehicleArea`; "Vendors… must use VehiclePropertyGroup:VENDOR" | `platform/hardware/interfaces/automotive/vehicle/aidl_property/android/hardware/automotive/vehicle/VehicleProperty.aidl` (class doc) |
| 2 | Groups: SYSTEM `0x10000000`, VENDOR `0x20000000`, MASK `0xf0000000`; Types: BOOLEAN `0x00200000`, INT32 `0x00400000`, FLOAT `0x00600000`, MASK `0x00ff0000` | `…/VehiclePropertyGroup.aidl`, `…/VehiclePropertyType.aidl` |
| 3 | Areas: GLOBAL `0x01000000`, DOOR `0x06000000`, VENDOR `0x08000000`, MASK `0x0f000000`; door area IDs `ROW_1_LEFT = 0x1`, `ROW_1_RIGHT = 0x4`, … | `…/VehicleArea.aidl`, `…/VehicleAreaDoor.aidl` |
| 4 | `DOOR_POS = 0x0B00 + SYSTEM + DOOR + INT32` (= 373295872), `@change_mode ON_CHANGE`, access READ_WRITE (OEM may implement READ) | `…/VehicleProperty.aidl` (DOOR_POS block) |
| 5 | `IVehicle` contract: `getAllPropConfigs()`, `getPropConfigs(int[])`, `getValues`/`setValues` (callback), `subscribe(callback, SubscribeOptions[], …)`, `unsubscribe` | `platform/hardware/interfaces/automotive/vehicle/aidl/android/hardware/automotive/vehicle/IVehicle.aidl` |
| 6 | `VehiclePropConfig` fields: `prop`, `access`, `changeMode`, `areaConfigs[]`, `configArray`, sample rates | `…/vehicle/VehiclePropConfig.aidl` |
| 7 | Emulated VHAL config: fake/default impl under `impl/current` (`fake_impl`, `default_config`); JSON configs (`DefaultProperties.json`, `TestProperties.json`) declare properties with `access`, config arrays, default values; `JsonConfigLoader` parses them into prop configs | `platform/hardware/interfaces/automotive/vehicle/aidl/impl/current/…` (listings + `JsonConfigLoader.cpp`) |
| 8 | Vendor-prop permission: `Car.PERMISSION_VENDOR_EXTENSION = "android.car.permission.CAR_VENDOR_EXTENSION"` (Signature\|Privileged); `VehiclePropertyIds` constants carry `@RequiresPermission(Car.PERMISSION_VENDOR_EXTENSION)` for vendor properties | `platform/packages/services/Car/car-lib/src/android/car/Car.java`; `…/VehiclePropertyIds.java` |
| 9 | Permission resolution is service-side: `CarPropertyService.getReadPermission/getWritePermission(propId)` delegate to `PropertyHalService`; `CarServiceUtils.assertPermission` guards service entry points | `platform/packages/services/Car/service/src/com/android/car/CarPropertyService.java` (lines ~968–983 etc.) |
| 10 | Client API: `Car.PROPERTY_SERVICE = "property"`; `CarPropertyManager.registerCallback(callback, propertyId, updateRateHz)`, `getBooleanProperty/getIntProperty`, `setBooleanProperty/setIntProperty`, `CarPropertyValue` (id/area/value/status) | `car-lib/src/android/car/Car.java`; `…/hardware/property/CarPropertyManager.java` |
| 11 | Vendor-permission categories exist for customized mapping (`PERMISSION_GET_VENDOR_CATEGORY_DOOR`, …LIGHT, etc. via `SUPPORT_CUSTOMIZE_VENDOR_PERMISSION`) | `…/vehicle/VehicleVendorPermission.aidl` |
| 12 | `cmd car_service` verbs: `get-property-value`, `set-property-value`, `get-carpropertyconfig`, `list-vhal-props`, `inject-vhal-event <name-or-ID> [area] data [-t delay]`, `inject-continuous-events`, `inject-error-event` | `platform/packages/services/Car/service/src/com/android/car/CarShellCommand.java` (help text) |

## Fictional — acme (labelled on the page)

- Vendor property `ACME_DOOR_STATE` = `0x26200C10` (639634448) =
  unique `0x0C10` + VENDOR + DOOR + BOOLEAN, composed by upstream's algebra
  (rows 1–3); config READ / ON_CHANGE over the two front-door areas.
- `WelcomeLightController` (car process) is an acme component written
  against upstream's client API (row 10); its CarService integration point
  and the fake-VHAL JSON entry on Cuttlefish are presented as acme's
  bring-up path in the shapes of rows 6–7. Command outputs are
  representative; Tier 2 was not executed in the authoring environment
  (ADR-0002 labelling).
