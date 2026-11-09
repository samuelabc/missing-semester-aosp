---
number: 8
title: "Framework customization"
subtitle: "Ship the welcome app like a platform component — privileged, platform-signed, allowlisted — then retitle its settings screen per product with an overlay that never touches its code."
reading_time: "~40 min read, plus lab"
lab_time: "2–3 h"
---

<div class="lecture-map"><span class="block-label">Lecture map</span><h2>The whole lecture on one screen</h2><div class="lecture-map-grid"><div><h3>Build the map</h3><ul><li><a href="#motivation">Motivation</a> — cheapest today, or cheapest forever?</li><li><a href="#mental-model">Mental model</a> — configure, overlay, fork — in that order</li><li><a href="#file-anatomy-the-two-artifacts">File anatomy: the two artifacts</a> — two artifacts, one partition rule</li></ul></div><div><h3>Walk the work</h3><ul><li><a href="#worked-example-a-ship-comacmewelcome-as-a-platform-component">Worked example A: ship `com.acme.welcome` as a platform component</a> — the platform component, shipped</li><li><a href="#worked-example-b-retitle-the-settings-screen-with-an-rro">Worked example B: retitle the settings screen with an RRO</a> — one product's title, nobody else's</li><li><a href="#the-three-customization-failures-you-will-actually-meet">The three customization failures you will actually meet</a> — three failures, three tells</li></ul></div><div><h3>Make it a habit</h3><ul><li><a href="#lab-guided">Lab (guided)</a> — six artifacts, six defences</li><li><a href="#exercises">Exercises</a> — rank it before you build it</li><li><a href="#go-deeper-kernel-and-app-pointers">Go deeper: kernel and app pointers</a> — the seams, at the right level</li></ul></div><p class="map-note">Lost mid-lecture? The Contents rail on the left (top on a phone) always shows where you are. Each section opens with what it teaches and closes with what you can now do.</p></div></div>

## Motivation
<div class="section-opener"><span class="block-label">In this section</span><p>Customization is where a product stops being Android and starts being yours — and where the cheapest change today becomes the most expensive one at the next release if it was made at the wrong level.</p></div>

Lectures 5–7 built the welcome light's machinery, but the feature still has no face: nothing a user can open, no settings surface, no per-product personality. Two platform mechanisms close that gap, and both are the kind that programs chronically under-teach. The **privileged system app** is how OEM software joins the platform — installed in a priv-app partition, signed with the platform certificate, allowlisted permission by permission, and assigned its SELinux domain by Lecture 9's seinfo chain.

**Runtime resource overlays (RROs)** are how one shipped artifact becomes many products — strings, colours, and configuration values swapped per vehicle without forking the app.

This lecture ships both, completely. First `com.acme.welcome` as a platform component: manifest, `Android.bp` with its signing and privilege declarations, the activity that calls Lecture 5's service, and the privileged-permission allowlist XML — the artifact whose absence is a *non-booting device* under enforcement, and the interim debt Lecture 9 explicitly left on this lecture's desk. Then a small overlay that changes the app's settings title for kestrel, shipped through product config, with the priority fight every overlay author eventually has. When both are done, the welcome chain has a user-visible surface and every lecture so far has a file in the final product.

<div class="section-recap"><span class="block-label">Now you can</span><p>Say why customization has a cost order, and what the wrong level charges you at upgrade time.</p></div>

## Mental model
<div class="section-opener"><span class="block-label">In this section</span><p>Customization has a preference order, cheapest-maintenance first: configure before you overlay, overlay before you fork. This section ranks the levers so the Worked Examples can spend them deliberately.</p></div>

Customization has a preference order, cheapest-maintenance first:

1. **Configuration values** — `config_*` booleans, integers, and strings the framework already reads, overlaid or set per product.
2. **Runtime resource overlays (RROs)** — a code-less package whose resources replace a target package's at runtime, enabled and prioritized by product configuration.
3. **Product/static overlays** — build-time resource replacement (`PRODUCT_PACKAGE_OVERLAYS` and friends) for what must be fused into the base artifact.
4. **New platform components** — your own privileged apps and services (Lectures 5–7) consuming governed APIs.
5. **Framework edits** — occasionally unavoidable; then small, isolated, and recorded as program debt.

The discipline running through the list: an overlay changes *what the code reads*, never *what the code does*. The moment a customization needs behaviour, it graduates to a component or a deliberate framework patch; expressing behaviour in resources produces the fragile products you have already debugged.

Levels 1 and 2 deserve a closer look before the worked examples, because most customization traffic lives there. Framework behaviour is riddled with values the code *reads* rather than hard-codes: `config_*` booleans, integers, and string arrays in `frameworks/base/core/res/res/values/config.xml` and its siblings in SystemUI, Settings, and CarService (feature presence, timeouts, default behaviours, which components exist).

The professional habit is to grep for the consumer before touching anything: a timeout that reaches code as `getResources().getInteger(R.integer.config_…)` is a *value*, and changing it is an overlay operation measured in minutes; the same number pasted into a Java constant by a previous program is a code change wearing a value's clothes, and the review should say so.

The trap at this level is assuming a config's name describes its blast radius — many `config_*` values gate privileged behaviour, multi-user policy, or safety-adjacent timings, so a level-1 change still wants a level-headed review. What it never wants is a framework patch: editing `config.xml` in `frameworks/base` directly is just an overlay with worse bookkeeping, since the next upstream merge will offer to discard it for you.

A privileged app is three agreements that must not drift. **Placement**: it lives in a priv-app directory (`/system/priv-app`, `/product/priv-app`, `/vendor/priv-app`), which is what makes it eligible for privileged permissions at all. **Signature**: `certificate: "platform"` in its build file signs it with the platform key — which is what makes Lecture 9's `mac_permissions.xml` map it to `seinfo=acme_welcome`, landing it in the `system_app` domain.

**Allowlist**: each `signature|privileged` permission it requests must be granted to it explicitly in a privapp-permissions XML *on the same partition*, because since Android 9 a privileged permission that is neither granted nor denied there stops the device from booting under enforcement. Missing any one agreement produces a different, characteristic failure, and this lecture meets all three on purpose.

An RRO has its own triad: **target** (the package whose resources bend — declared in the overlay's manifest, enforced against the target's `<overlayable>` policy or, absent one, by the rule that the overlay must be preinstalled or share the target's signature), **resources** (identical names to the base, or they simply never match), and **state** (enabled or not, mutable or frozen, and at what priority relative to rival overlays — configured per partition in `overlay/config/config.xml`). Get one leg wrong and the overlay fails *silently*, which is why this lecture's evidence commands matter as much as its files.

<div class="section-recap"><span class="block-label">Now you can</span><p>Rank the customization levers by maintenance cost and defend the ranking to a product team in a hurry.</p></div>

<figure class="anchor-figure" role="img" aria-label="Concept anchor: the preference order, cheapest first"><p class="anchor-title">Concept anchor — the preference order, cheapest first</p><div class="anchor-stack"><div class="anchor-layer"><strong>Configure</strong><span>platform config and product makefiles — decided at build time</span></div><div class="anchor-layer"><strong>Overlay (RRO)</strong><span>runtime resources for one product, base app untouched</span></div><div class="anchor-layer"><strong>Privileged app</strong><span>platform-signed, allowlisted, same partition</span></div><div class="anchor-layer"><strong>Fork</strong><span>your copy of upstream code — the level that charges at every upgrade</span></div></div><figcaption><strong>Read it as:</strong> spend the cheapest lever that does the job. Every level down this stack is paid for again at the next release; the failures below are the receipts.</figcaption></figure>

## File anatomy: the two artifacts
<div class="section-opener"><span class="block-label">In this section</span><p>Two artifacts carry this lecture: the platform-signed privileged app and the runtime resource overlay. The row to study first is the partition rule, because it bites first.</p></div>

| # | Artifact | Where it lives | Job | If it's wrong |
|---|---|---|---|---|
| 1 | App build file | `device/acme/kestrel/apps/welcome/Android.bp` | `android_app` with `certificate`, `privileged`, `platform_apis` | App is a normal app with delusions (Failures 2–3) |
| 2 | App manifest | inside the app | Package identity, requested permissions, activity | Permissions unrequested are permissions unheld |
| 3 | Activity code | `src/com/acme/welcome/MainActivity.java` | Reads door state + light state, toggles via Lecture 5's AIDL | The face calls nothing, or calls it wrongly |
| 4 | Base strings | app `res/values/strings.xml` | The values overlays will bend (`welcome_settings_title`) | Nothing for an overlay to match (RRO leg 2) |
| 5 | Allowlist XML | installed to `/system/etc/permissions/privapp-permissions-kestrel.xml` | Grants the app its CarService-defined privileged permission | Boot-blocking violation under enforce (Failure 3) |
| 6 | Product entry | `kestrel_auto.mk` (`PRODUCT_PACKAGES`, config copy) | Ships app + overlay on this product only | Files exist; the product never heard of them |
| 7 | Overlay package | `device/acme/kestrel/overlay/kestrel-welcome/` (manifest + `res`) | Code-less RRO targeting `com.acme.welcome` | Silent no-op (Failure 1) |
| 8 | Overlay config | `device/acme/kestrel/overlay/config/config.xml` → `/product/overlay/config/config.xml` | Enables the overlay, freezes it (`mutable="false"`), sets precedence context | Overlay installed and disabled by default |

The row to study before writing anything is #5's partition rule, because it bites first: the allowlist must live on the *same partition as the app*. The app ships in `/system/priv-app` (that is where `privileged: true` without a partition qualifier puts it), so its allowlist ships to `/system/etc/permissions/` — a `privapp-permissions-kestrel.xml` modelled on upstream's `privapp-permissions-platform.xml`, whose header states the schema's purpose in one sentence. OEM files are conventionally named per device (`privapp-permissions-DEVICE_NAME.xml` in the documentation's recommendation); `kestrel` is ours.

<div class="section-recap"><span class="block-label">Now you can</span><p>Name the two artifacts, the partition rule that bites first, and the failure each artifact produces when misplaced.</p></div>

## Worked example A: ship `com.acme.welcome` as a platform component
<div class="section-opener"><span class="block-label">In this section</span><p>Ship <code>com.acme.welcome</code> as a platform component: platform certificate, the two distinct permission mechanisms, and the same-partition privapp allowlist — every file in full.</p></div>

### Step 1: the build file — three declarations that are the lecture

Create `device/acme/kestrel/apps/welcome/Android.bp`:

```
android_app {
    name: "AcmeWelcome",
    srcs: ["src/**/*.java"],
    resource_dirs: ["res"],
    manifest: "AndroidManifest.xml",
    certificate: "platform",
    privileged: true,
    platform_apis: true,
}
```

Each non-obvious field is a commitment. `certificate: "platform"` signs with the platform key — the same key Lecture 9's `mac_permissions.xml` keys on, which is how this app inherits `seinfo=acme_welcome` and the `system_app` domain; sign it with anything else and Lecture 9's chain silently delivers a different seinfo and a generic domain. `privileged: true` installs the APK to `/system/priv-app/AcmeWelcome/`, the placement that makes privileged permissions *requestable* — it grants nothing by itself, a distinction Failure 3 cashes in.

`platform_apis: true` admits the hidden-API surface the activity needs (`ServiceManager`, the generated `IWelcomeLightService` stubs, Car APIs beyond the public SDK) — upstream's own `Settings` module carries the same trio of fields, which is the shape to imitate when a component is platform, through and through. Note what is absent: no `sharedUserId`, no test key, nothing that widens the app's identity beyond what its two permissions (next step) require.

### Step 2: the manifest — request exactly two permissions

`AndroidManifest.xml` (trimmed to the load-bearing lines):

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
        package="com.acme.welcome">

    <!-- Lecture 5's signature permission: mutate the welcome light. -->
    <uses-permission android:name="android.permission.CONTROL_WELCOME_LIGHT"/>
    <!-- CarService's signature|privileged permission: read vehicle
         properties, including the vendor door property (Lecture 7). -->
    <uses-permission android:name="android.car.permission.CAR_VENDOR_EXTENSION"/>

    <application android:label="@string/app_name">
        <activity android:name=".MainActivity"
                android:label="@string/welcome_settings_title"
                android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
```

The two permissions illustrate the two different grant mechanisms this lecture exists to separate. `CONTROL_WELCOME_LIGHT` is a pure `signature` permission (Lecture 5 declared it so): the platform certificate *is* the grant, and no other artifact is consulted. `CAR_VENDOR_EXTENSION` is `signature|privileged` and defined by CarService — and the platform documentation is explicit that privileged permissions defined by the `android` package and by CarService **must be allowlisted** for priv-apps, while privileged permissions a device manufacturer defines itself are granted automatically.

So the manifest asks, the certificate satisfies one request, and the allowlist (Step 4) must satisfy the other. The activity label deserves its line: `@string/welcome_settings_title` is the string Worked Example B will bend per product, referenced from the manifest so the overlay's effect is visible without opening the app.

### Step 3: the activity — a thin, honest client

`src/com/acme/welcome/MainActivity.java` (essentials; the full flow, not a toy):

```java
package com.acme.welcome;

import android.app.Activity;
import android.car.Car;
import android.car.hardware.CarPropertyValue;
import android.car.hardware.property.CarPropertyManager;
import android.os.Bundle;
import android.os.IBinder;
import android.os.RemoteException;
import android.os.ServiceManager;
import android.util.Slog;
import android.widget.Button;
import android.widget.TextView;

import com.acme.welcome.IWelcomeLightService;

/**
 * Welcome settings face: shows door + light state, offers a manual
 * toggle. Owns no vehicle logic — Lecture 7's controller drives the
 * light from doors; this screen observes and overrides, using the
 * same governed APIs as every other client.
 */
public class MainActivity extends Activity {
    private static final String TAG = "AcmeWelcome";
    private static final int ACME_DOOR_STATE = 0x26200C10;  // Lecture 7
    private static final int AREA_ROW_1_LEFT = 0x00000001;

    private TextView mStatus;
    private IWelcomeLightService mLight;

    private final CarPropertyManager.CarPropertyEventCallback mDoorCallback =
            new CarPropertyManager.CarPropertyEventCallback() {
                @Override
                public void onChangeEvent(CarPropertyValue value) {
                    if (value.getStatus() == CarPropertyValue.STATUS_AVAILABLE) {
                        render();
                    }
                }

                @Override
                public void onErrorEvent(int propertyId, int areaId) {
                    Slog.w(TAG, "door property error area=" + areaId);
                }
            };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);
        mStatus = findViewById(R.id.status);
        Button toggle = findViewById(R.id.toggle);
        toggle.setOnClickListener(v -> {
            IWelcomeLightService light = light();
            if (light == null) return;
            try {
                int now = light.getLightState();
                light.setLightEnabled(now != 1);
            } catch (RemoteException e) {
                Slog.w(TAG, "toggle failed", e);
            }
            render();
        });

        Car car = Car.createCar(this);
        CarPropertyManager properties =
                (CarPropertyManager) car.getCarManager(Car.PROPERTY_SERVICE);
        properties.registerCallback(mDoorCallback, ACME_DOOR_STATE, 0.0f);
        render();
    }

    private void render() {
        IWelcomeLightService light = light();
        int state = -1;
        try {
            if (light != null) state = light.getLightState();
        } catch (RemoteException e) {
            mLight = null;
        }
        final int shown = state;
        runOnUiThread(() -> mStatus.setText(
                shown == 1 ? "Light on" : shown == 0 ? "Light off" : "Light unavailable"));
    }

    private IWelcomeLightService light() {
        if (mLight == null) {
            IBinder binder = ServiceManager.checkService("welcome_light");
            if (binder != null) mLight = IWelcomeLightService.Stub.asInterface(binder);
        }
        return mLight;
    }
}
```

Three things to notice as a reviewer. The app is a *client of the same contracts as everyone else*: door truth arrives through `CarPropertyManager` (permitted by `CAR_VENDOR_EXTENSION`), light mutation goes through Lecture 5's AIDL (permitted by the certificate) — no back doors, no direct `welcomed`, no VHAL. `createCar` + `registerCallback` reuses Lecture 7's client pattern at app altitude, including the status check before believing a value.

And there is deliberately no door→light *policy* here: Lecture 7's controller already owns that decision in the car process, so this screen is an observer with a manual override, not a second brain. Two components commanding the same actuator from two policies is how cabins develop split-brain lighting; one decider, many faces.

### Step 4: the allowlist — one XML that stands between you and a boot loop

Create `device/acme/kestrel/apps/welcome/privapp-permissions-kestrel.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Privileged permissions granted to kestrel's privileged apps.
     Modelled on frameworks/base/data/etc/privapp-permissions-platform.xml.
     Same-partition rule: this file ships in /system/etc/permissions/,
     beside the /system/priv-app apps it describes. -->
<permissions>
    <privapp-permissions package="com.acme.welcome">
        <!-- CarService-defined signature|privileged permission (Lecture 7):
             must be allowlisted; the platform certificate alone does not
             satisfy the privileged path. CONTROL_WELCOME_LIGHT is absent
             on purpose: pure signature, carried by certificate: "platform". -->
        <permission name="android.car.permission.CAR_VENDOR_EXTENSION"/>
    </privapp-permissions>
</permissions>
```

And install it beside the apps it describes, in the same `Android.bp`:

```
prebuilt_etc {
    name: "privapp-permissions-kestrel",
    src: "privapp-permissions-kestrel.xml",
    sub_dir: "permissions",
    filename: "privapp-permissions-kestrel.xml",
}
```

The comment in the XML is the lecture in miniature, so read it twice: the file grants the *CarService-defined* permission because the privileged path demands an explicit, same-partition grant for android- and CarService-defined privileged permissions; `CONTROL_WELCOME_LIGHT` is deliberately omitted because a pure signature permission rides the certificate. Engineers who allowlist everything "to be safe" teach themselves nothing and obscure the audit; engineers who allowlist nothing learn about `ro.control_privapp_permissions` at 3 a.m.

from a device that will not finish booting. The property has three postures worth knowing cold: `enforce` (violations are fatal to boot on modern Android — the shipping posture), `log` (violations are reported and permissions *not* granted, device keeps working — the bring-up posture, with the exact log line `PackageManager: Privileged permission … for package … - not in privapp-permissions allowlist`), and unset/disabled (everything granted silently — the posture that must never ship).

### Step 5: product wiring and the interrogation

In `kestrel_auto.mk` (Lecture 2's file), ship the component:

```make
PRODUCT_PACKAGES += \
    AcmeWelcome \
    privapp-permissions-kestrel
```

Rebuild, boot, and interrogate in the order of the three agreements (outputs representative):

```bash
adb shell pm list packages | grep acme
# package:com.acme.welcome

adb shell dumpsys package com.acme.welcome | grep -E "CONTROL_WELCOME_LIGHT|CAR_VENDOR_EXTENSION|granted=true" | head
# android.car.permission.CAR_VENDOR_EXTENSION: granted=true
# android.permission.CONTROL_WELCOME_LIGHT: granted=true

adb shell cmd appops get com.acme.welcome 2>/dev/null | head -1   # (sanity: no op denials)
adb shell am start -n com.acme.welcome/.MainActivity
# The settings face opens; the toggle moves Lecture 5's setCalls,
# and deniedCalls stays exactly where Lecture 5 left it.
```

The two `granted=true` lines were produced by *different mechanisms* — that is the whole worked example, verified: certificate for one, allowlist for the other. The toggle's effect in `dumpsys welcome_light` closes the loop across five lectures: an app process, holding two properly-granted permissions, moves a counter in `system_server`, which moves a frozen v1 HAL call, which lights hardware.

The `seapp` chain meanwhile has placed the process in `system_app` (Lecture 9), and its `find` on `welcome_light_service` was granted by the same device policy pattern — the one Lecture 9 staged and this lecture's component finally exercises for real.

<div class="checkpoint"><strong>Checkpoint:</strong> the package is installed from <code>/system/priv-app</code>, both permissions read <code>granted=true</code> by their separate mechanisms, the activity opens and toggles the light through Lecture 5's service with <code>deniedCalls</code> unmoved, and removing the allowlist entry (try it once, on a <code>log</code>-mode build) reproduces the PackageManager violation line naming exactly the permission and package.</div>

### Signing, once more with feeling: what `certificate: "platform"` does

Since two of the three agreements hang on it, be precise about the signing act itself. The value names a *key pair the build holds* (the platform key, in the build's security directory — the same certificate Lecture 9's `keys.conf` resolves for the `platform` seinfo), and Soong signs the APK with it at build time; the installed app's identity, for permission and seinfo purposes alike, *is* that signer.

Three corollaries engineers trip over. First, the signer is part of the app's *update identity*: an APK signed with a different key is not an update, it is a different app wearing the same package name, and package manager will refuse it — which is why the accidental test-key build in Exercise 3 fails in the interesting ways it does.

Second, shipping a prebuilt APK instead changes the field, not the requirement: `presigned: true` modules keep the APK's existing signature, which merely moves the question to "whose key is that, and does `mac_permissions.xml` map it" — there is no configuration in which the signer is unexamined.

Third, keys have lifecycles: rotation, compromise response, and the release-key ceremony for production images are Lecture 11's subject; this lecture's demand is smaller — that for every system component you ship, you can answer "what signs this, where does that key live, and which of this lecture's mechanisms (allowlist, seinfo, signature permission) keys off it" without opening a file. If the answer requires archaeology, the component is not yet shippable, however green the build looks.

<div class="section-recap"><span class="block-label">Now you can</span><p>Ship the companion app as a platform component and prove its privileged permissions from the device, partition by partition.</p></div>

## Worked example B: retitle the settings screen with an RRO
<div class="section-opener"><span class="block-label">In this section</span><p>A string, not a behaviour: retitle the welcome settings with a runtime resource overlay while the shared base app keeps its own title for other trims.</p></div>

Kestrel's product team wants the welcome settings titled *"Kestrel welcome lighting"* while the base app (shared with other trims) says *"Welcome lighting."* A string, not a behaviour — preference-order level 2, an RRO, with the app untouched.

### Step 1: the overlay package

Create `device/acme/kestrel/overlay/kestrel-welcome/` with `AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
        package="com.acme.welcome.overlay.kestrel">
    <overlay android:targetPackage="com.acme.welcome"
            android:priority="5"/>
    <application android:label="Kestrel welcome overlay" android:hasCode="false"/>
</manifest>
```

`res/values/strings.xml` — the name must match the base *exactly*:

```xml
<resources>
    <string name="welcome_settings_title">Kestrel welcome lighting</string>
</resources>
```

and `Android.bp`, following upstream's own overlay modules (compare `NavigationBarModeGesturalOverlay` at the tag):

```
runtime_resource_overlay {
    name: "KestrelWelcomeOverlay",
    product_specific: true,
}
```

`product_specific: true` places the overlay in the product partition's `overlay/` directory — the only place the next step's config file is allowed to govern it from, and the correct partition for a per-product trim artifact.

Two leg checks from the mental model: the target (`com.acme.welcome`) defines no restrictive `<overlayable>` policy, so the docs' rule applies — the overlay must be *preinstalled on the system image* (it is, next step) or share the target's signature; and the resource name is character-identical to Step A-2's label reference, because overlay matching is by name and type, and a mismatched name fails with no error anywhere.

One more piece of the target's side of this contract is worth reading before you need it: `<overlayable>`. Target packages may publish, inside their own resources, an `<overlayable>` declaration naming the resources outsiders may bend, optionally with `<policy>` restrictions on *who* may bend them (the documentation's model: the policy states which conditions an overlay must fulfil). When a target defines one, your overlay's freedom is exactly that list — resources outside it are not overlayable at runtime no matter what your package contains.

When it does not (our app does not), the fallback rule from Step 1 applies: preinstall or same-signature. The platform's own packages are the instructive extreme — the `android` package and SystemUI declare overlayable sets precisely because Google expects OEM overlays there and wants the surface enumerable; an OEM app that will be themed by *other* teams owes them the same courtesy.

The review question that falls out: does the target publish an overlayable list, and is the resource you need on it? Answering it takes one grep in the target's `res/values/` and settles arguments that otherwise happen at integration time.

### Step 2: enable it in the partition's OverlayConfig

Ship `device/acme/kestrel/overlay/config/config.xml`:

```xml
<config>
    <overlay package="com.acme.welcome.overlay.kestrel" mutable="false" enabled="true"/>
</config>
```

wired into the product image from `kestrel_auto.mk`:

```make
PRODUCT_COPY_FILES += \
    device/acme/kestrel/overlay/config/config.xml:$(TARGET_COPY_PRODUCT)/overlay/config/config.xml
```

Read the config semantics carefully, because this file is the modern (post-Android-11) mechanism and it inverts a common assumption: overlays *not listed* here are **mutable and disabled by default** — merely installing the overlay package accomplishes nothing visible.

`enabled="true"` gives it its default state; `mutable="false"` freezes that state against runtime toggling (`cmd overlay enable/disable` will refuse it), which is the shipping posture for a product-identity string: the trim's title is a product fact, not a user preference, and the next engineer who "fixes" it from a shell should meet a refusal that sends them to this file. `immutable`-ness affects only `Resources.getSystem()`-style reads for the `android` target, not us; what matters here is that enablement and precedence are *product configuration*, reviewable in one XML, rather than a runtime accident.

### Step 3: ship, verify, and fight the priority fight

Add `KestrelWelcomeOverlay` to `PRODUCT_PACKAGES`, rebuild the two modules only (`m AcmeWelcome KestrelWelcomeOverlay`, Lecture 2's discipline), reinstall, and verify with the overlay manager's own testimony before believing your eyes:

```bash
adb shell cmd overlay list | grep -i welcome
# [x] com.acme.welcome.overlay.kestrel

adb shell cmd overlay dump com.acme.welcome.overlay.kestrel | head -20
# ... mPackageName: com.acme.welcome.overlay.kestrel ...
# ... mIsEnabled: true ... (state enabled, from config)

adb shell am start -n com.acme.welcome/.MainActivity
# Title bar: "Kestrel welcome lighting"
```

(`[x]` in `cmd overlay list` marks enabled.) If the title is unchanged, work Failure 1's checklist below *in order* — target, name, state, inclusion — and resist the urge to rebuild the world: overlays fail silently by design, so the checklist *is* the debugger, with `idmap2 dump` against `/data/resource-cache/` as the deep inspection when `cmd overlay dump` claims all is well.

Now the rite of passage: a second team ships `com.acme.welcome.overlay.brandx` with priority `1` in its manifest, also bending `welcome_settings_title`. Who wins is arithmetic, not seniority: among enabled overlays for a target, higher priority takes precedence per resource, and `cmd overlay dump` on both packages shows the actual ordering the system computed. The resolution belongs in product configuration — kestrel's intent is expressed once, in the config file and the manifest priorities chosen there — never in a third overlay written to out-shout the second.

Close the loop: remove the brand overlay from the product (not from the tree), and the title returns, having touched no app code at any point. That reversibility is the entire economic argument for level 2 of the preference order.

<div class="checkpoint"><strong>Checkpoint:</strong> <code>cmd overlay list</code> shows the overlay enabled; the activity title reads "Kestrel welcome lighting"; disabling is refused while <code>mutable="false"</code>; the deliberate priority fight resolves in configuration, and removing the overlay restores the base title with zero changes under <code>apps/welcome/</code>.</div>

### Partition geography: where overlays are allowed to live

Overlay placement follows the same partition logic as everything else in this course, with one RRO-specific twist. An overlay shipped on a partition is governed by *that* partition's `overlay/config/config.xml` — the documentation's rule is that an overlay must reside in the `overlay/` directory of the partition whose config file configures it — so kestrel's overlay and its config entry travel together in `/product`, and moving the APK without its config line (or vice versa) manufactures Failure 1 from spare parts.

This geography is also the product-line mechanism: a shared `/system` app plus per-product `/product` overlays is exactly how one `AcmeWelcome` serves several trims without a fork, and OEM-common overlays can be shared across products while device-specific ones override them (the OverlayConfig format even provides `<merge path="…"/>` so a common config can be included and then amended per product, with precedence settled by the priority arithmetic of Step 3).

Read a strange device's `/product/overlay/`, `/vendor/overlay/`, and `/system/overlay/` directories and their config files, and you have read its customization strategy in five minutes — which is also the audit Lecture 12 will perform, so write yours as if it will be read by someone with a checklist, because it will be.

### Static, mutable, per-user: the overlay decision table

Three configuration axes decide an overlay's shipping personality, and choosing them is design work, not boilerplate. **Static vs runtime:** a static overlay (`android:isStatic`, or the build-time `PRODUCT_PACKAGE_OVERLAYS` directory mechanism it supersedes for fused changes) is applied unconditionally from first boot and cannot be toggled; reach for it when the value must be true before any manager runs or inside a component that ships fused (Exercise 5 develops the scenario), and accept that variants become separate artifacts.

**Mutable vs immutable:** mutability governs whether the enabled state may change at runtime — development wants mutable overlays precisely so `cmd overlay enable/disable` can A/B a string on a live bench in seconds (do this; it is the fastest customization feedback loop on the platform), while production identity (brand, regulatory text) wants `mutable="false"` so the state is a product fact.

**User scope:** enablement is per-user, and cars are multi-user machines — the documentation's own example enables an overlay separately for the system user (which owns SystemUI) and the foreground driver user. A title that changes "on the bench" (your shell's current user) and not for the driver is usually this row, misread as an overlay bug; `cmd overlay list --user current` versus `--user 10` settles it in one command.

And the boundary around all three: overlays replace existing resources by name — they cannot add behaviour, cannot rename what code references, and cannot reach a resource the target has not made reachable. Customizations that need any of those have already graduated to preference levels 4–5, and writing them as overlays anyway is how silent Failure 1s are manufactured.

### Framework edits, honestly (level 5 is a debt instrument)

Sometimes the levels genuinely run out: the behaviour — not a value, not a resource — must differ, upstream has no seam, and the feature is real. Then the discipline changes from *avoid* to *account*.

A defensible framework edit is small enough to re-apply by hand after an upstream merge (if reading that sentence makes you tired, the edit is too big), isolated behind the narrowest interface your own code can call (so the fork's surface is one file, not a subsystem), written to be upstreamable where the change is generally correct (programs that upstream their seams buy down future merges), and recorded — in your product's own documentation, in the style of this project's `ARCHITECTURE.md` — as named debt with an owner and a reason.

What disqualifies an edit is rarely its size; it is arriving disguised as a lower level: a "config change" that required modifying the consumer, an "overlay" that needed the target rebuilt. Those disguises are how forks accumulate invisibly until an Android upgrade becomes a quarter-long programme. The preference order is not snobbery about technique — it is a pricing model, and every level exists because someone paid the level below it.

<div class="section-recap"><span class="block-label">Now you can</span><p>Retitle a settings screen for one product with an RRO, leaving the base app untouched for every other trim.</p></div>

## The three customization failures you will actually meet
<div class="section-opener"><span class="block-label">In this section</span><p>The three customization failures you will actually meet — an allowlist on the wrong partition, a permission your merged manifests requested without telling you, an overlay aiming at the wrong target — each with its tell.</p></div>

**Failure 1: the overlay that silently does nothing.** The checklist, in debugging order (each step eliminates a leg of the triad): *target* — `android:targetPackage` names the package that *owns the resource* (for framework strings that is `android`, not the app displaying them); *name/type* — the overlay resource matches the base in name and type exactly (`grep` the base `res/`, not your memory of it);

*state* — `cmd overlay list` shows it enabled, remembering that unconfigured overlays default to *disabled* and that `--user` matters (system UI lives on user 0, the foreground driver on another; enabling for the wrong user is the AAOS special); *inclusion* — the module is in the product you actually flashed (`PRODUCT_PACKAGES` in the right product file, the image rebuilt, the device running it). Four checks, five minutes, no rebuilds — the failure is silent precisely because each of these is a *valid* system state someone intended.

**Failure 2: the app that is a priv-app and nothing else.** `privileged: true` was set, the app sits in `/system/priv-app`, and its privileged permission reads `granted=false`. The mental correction: placement is eligibility, not grant.

For android- and CarService-defined privileged permissions, the grant is the allowlist entry (Step 4), full stop; for pure signature permissions it is the certificate — and an app signed with a *test* or *release* key other than platform fails that second path while looking identical in every other respect (`dumpsys package` shows the signer; compare it before debugging anything else).

The third agreement — Lecture 9's seinfo chain — fails separately and silently (wrong signer, no `acme_welcome`, generic domain), so an app can be perfectly permissioned and wrongly confined, or vice versa. Diagnose the three agreements independently; they share no symptoms.

**Failure 3: the allowlist omission that stops the boot.** Under `ro.control_privapp_permissions=enforce`, a priv-app requesting a non-allowlisted privileged permission is a *device-does-not-boot* defect, not an app bug — this is the sharpest edge in the lecture and the reason Step 4 is written before Step 5's first boot.

The recovery discipline: switch the build to `log` mode during bring-up, collect the `not in privapp-permissions allowlist` lines (they name permission and package precisely), grant or deny each *deliberately* (deny is a first-class answer — the schema's `deny-permission` element exists for permissions a priv-app requests transitively but must never hold), and return to `enforce` for anything that ships. The anti-pattern to reject in review: switching enforcement off to make the boot pass.

That converts a five-minute XML edit into an unbounded permission grant to every present and future priv-app, and Lecture 12's compliance world will find it.

### The transitive-permission trap

One refinement of Failure 3 ambushes careful teams: the violating permission is one *your code never requested*. Android library manifests merge into the host app's manifest, so a static library (an analytics SDK, a shared car-ui toolkit, another team's component) can inject `<uses-permission>` entries — including privileged ones — into `com.acme.welcome` without a single line in your manifest changing.

Under `log` mode this surfaces as a violation naming your package and a permission nobody on your team recognizes; the archaeology is `grep` through your `static_libs`' manifests (and the merged-manifest artifact the build produces) until the string appears. The deliberate answers are the schema's own: allowlist it if the component genuinely needs it (and record *which library* asked, in the XML's comment — the next auditor will thank you), or `deny-permission` it if the request is incidental, which keeps enforcement satisfied and the permission unheld.

What you may not do is trim the library's feature silently by removing the permission from *your* manifest, because the merged artifact will re-add it at the next library update. Permissions in a platform component are a supply-chain fact; treat the merged manifest as a build output you review, not an implementation detail.

<div class="section-recap"><span class="block-label">Now you can</span><p>Diagnose the three failures from their tells, including the permission your own code never requested.</p></div>

## Lab (guided)
<div class="section-opener"><span class="block-label">In this section</span><p>Six artifacts, six paths: place each customization at its preference-order level, ship it, and state in one sentence per overlay which level it represents.</p></div>

**Tier 1 — inventory a running system (~1 h, emulator, no changes).** Run `cmd overlay list` and pick three overlays of different shapes (one targeting `android`, one a car component, one an app). For each: find its source package in the tree, its `targetPackage`, one resource it bends, and its enablement source (config file, static, or runtime). Then inventory the priv-apps (`ls /system/priv-app`, `/product/priv-app`) and match two of them to their allowlist entries in `frameworks/base/data/etc/privapp-permissions-platform.xml`. Checkpoint: six artifacts, six paths, and one sentence per overlay stating which preference-order level it represents.

**Tier 2 — ship the pair on kestrel_auto / Cuttlefish (~2–3 h).**
1. Ship Worked Example A exactly as written. Checkpoint: both permissions `granted=true` by their distinct mechanisms; toggle moves `setCalls`; the process sits in `system_app` (`ps -A -o NAME,LABEL` or the seapp chain) — three agreements, three evidences.
2. Ship Worked Example B. Checkpoint: title changed via overlay with the app module untouched (`git status` equivalent: no diff under `apps/welcome/` after the title change), enable/disable refused under `mutable="false"`.
3. Break Step 4: delete the `CAR_VENDOR_EXTENSION` line, rebuild with `ro.control_privapp_permissions=log`, boot, and harvest the exact violation line from logcat; then restore and boot under `enforce`. Checkpoint: you can predict, before booting, which of the app's two permissions survives the deletion and why.
4. Stage the priority fight (a second overlay at lower priority) and resolve it by configuration alone. Checkpoint: `cmd overlay dump` output for both packages cited in your resolution note.

**Tier 3 — bench audit (30 min, real head unit).** Choose one privileged app on the device. From the running system alone: its partition, signer (via `dumpsys package`), granted privileged permissions, and the allowlist file entry that grants each. Flag any requested-but-ungranted privileged permission as a finding with its Failure-2/Failure-3 classification. Checkpoint: an audit table a compliance reviewer (Lecture 12) could act on without asking you anything.

*Verification status: RRO module/manifest/OverlayConfig/`cmd overlay` semantics, the signing–privilege–platform-apis trio, privapp allowlist schema, same-partition rule, enforcement postures, and the violation log format checked against `android-17.0.0_r1` and the official AOSP documentation (see `docs/verification/lecture-08-source-truth.md`). The acme app, overlay, and strings are fictional teaching artifacts in upstream's shapes; Tier 2 was not executed in the authoring environment.*

<div class="section-recap"><span class="block-label">Now you can</span><p>Ship six customization artifacts at the right levels, with a one-sentence defence of each level.</p></div>

## Exercises
<div class="section-opener"><span class="block-label">In this section</span><p>Exercises in customization judgement: rank a proposed change, find the merged-manifest surprise, and talk a product team out of a fork it does not need.</p></div>

1. A supplier delivers a customization as a patch to `frameworks/base` changing one timeout. Rewrite the request using preference-order levels 1–2, and state the condition under which you would accept the patch instead.
2. Your overlay builds, installs, and shows in `cmd overlay list` — but the title never changes. You may run three commands before touching any file. Name them and what each eliminates.
3. `com.acme.welcome` is rebuilt with `certificate: "platform"` removed (default test key) by accident. Predict, agreement by agreement, what still works and what silently changes — permissions, domain, app function.
4. A teammate proposes granting `CONTROL_WELCOME_LIGHT` through the privapp allowlist "so both permissions live in one place." Give the two-sentence correction.
5. When is a *static* overlay (or build-time product overlay) the right choice over an RRO on a shipping car program? Answer with a concrete scenario and the cost accepted.

<details class="solution" markdown="1"><summary>Show solutions</summary>

1. If the timeout exists as a `config_*` resource, the request becomes an overlay entry (or product config value) naming that resource — level 1/2, no framework diff, upgrade-safe. Accept the patch only when the timeout's *behaviour* (not its value) must change — e.g. the computation, not the constant, is wrong — and then as a small, isolated framework edit recorded as program debt with an upstreaming note. A value wearing a patch's clothing is rejected on sight.
2. `cmd overlay dump <your overlay>` (state leg: enabled? priority? the computed precedence — eliminates the disabled-by-default and wrong-user cases), `idmap2 dump` on the overlay's `/data/resource-cache/` mapping (resource leg: did your string's ID actually map onto the base's?), and `cmd overlay list` for the target's full overlay set (rival leg: is something with higher priority bending the same resource). Only after those three does a file deserve editing; most silent overlays die at command one.
3. Signature path fails first: `CONTROL_WELCOME_LIGHT` is no longer granted (the certificate *was* that grant), so the toggle starts throwing Lecture 5's `SecurityException` — now visible as a *legitimate* denial in `deniedCalls`. The seinfo chain fails in parallel: the signer no longer matches Lecture 9's `@ACME_PLATFORM`, so `seinfo=acme_welcome` never attaches, the `seapp_contexts` line never matches, and the app falls to a generic app domain — with the SELinux denials that follow when it reaches for platform surface. What still works: installation (it is still `privileged: true` in priv-app), the allowlisted `CAR_VENDOR_EXTENSION` (the privileged path does not consult the platform cert), and door-state display. One deleted word, two of three agreements void, and every symptom points at a different layer — which is why Exercise-reviewers ask "what signs this?" before anything else.
4. Look for: the allowlist governs only the privileged path for `signature|privileged` permissions; `CONTROL_WELCOME_LIGHT` is pure `signature`, so its grant is the platform certificate and an allowlist entry for it is inert decoration. Keeping the two mechanisms distinct is what makes Step 4's file an audit document instead of a junk drawer — each line should answer "which privileged permission, granted why," and signature grants already have their answer in `Android.bp`.
5. Strong answers pick a case where enablement itself is the risk: e.g. a regulatory or brand-critical resource in a component that runs before OverlayManagerService can be trusted to apply state, or a value fused into a non-updatable recovery/boot component shipped once. The cost accepted, stated plainly: the change is baked at build time — no per-product runtime switch, no `cmd overlay` debugging, every variant is a distinct artifact to build and test. On a car program that trades fleet flexibility for first-boot determinism, and it should be chosen knowingly, per component, not by default.

</details>

<div class="section-recap"><span class="block-label">Now you can</span><p>Rank any proposed customization by maintenance cost and find the permission nobody remembered requesting.</p></div>

## Go deeper: kernel and app pointers
<div class="section-opener"><span class="block-label">In this section</span><p>Overlays reach into app resources and privileged apps live at the governed seams; the app path orders that reading, and the kernel path waits below the platform you now customize.</p></div>

Overlays reach into app resources, so the resource system itself is app-layer knowledge worth one evening; the [app path]({{ '/app-path/' | relative_url }}) step on resources is the consumer-side view of what this lecture configures from the platform side. Nothing here needs the kernel. Lecture 11 takes the signing thread this lecture started (`certificate: "platform"` for one app) and widens it into release signing for whole images, and Lecture 12 will read this lecture's allowlist and overlay config as compliance evidence — write them like exhibits.

<div class="callout"><p><strong>Working with AI agents:</strong> agents generate overlay XML fluently and invent base resource names confidently. Constrain them to your tree: "find the base resource for X and produce the overlay entry with the identical name" is verifiable in one <code>grep</code>, and a generated name that does not exist in the target fails silently — the worst failure class in this lecture. Apply the same suspicion to permissions: every <code>uses-permission</code> an agent adds to a priv-app manifest must arrive with its grant mechanism named (certificate, allowlist, or impossible), or it is a Failure 3 with good formatting.</p></div>

<div class="section-recap"><span class="block-label">Now you can</span><p>Follow customization upward into app resources and downward to the platform seams, at the right level each time.</p></div>
