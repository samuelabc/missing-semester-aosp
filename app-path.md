---
layout: page
title: The app path
subtitle: Pointers for app-level learning and customization, for system engineers who integrate apps rather than write them.
permalink: /app-path/
---

This course does not teach Android app development. It does expect you to integrate, replace, grant privileges to, and occasionally argue with apps: launchers, media, settings, and the car apps your program ships. Learn in this order, from the system side inward.

1. **App fundamentals, system reading list.** The official [app fundamentals](https://developer.android.com/guide/components/fundamentals) and [application sandbox](https://source.android.com/docs/security/app-sandbox) pages. Read them as a platform engineer: which of these guarantees does your customization rely on? Connects to Lecture 9.
2. **Privileged and platform-signed apps.** [Privileged app permissions](https://source.android.com/docs/core/permissions/privapp-permissions) and permission allowlists, plus `AndroidManifest` permission protection levels. Most "the system app cannot do X" bugs on a program are decided here, not in code. Connects to Lectures 8 and 9.
3. **AAOS car apps and Car API from the consumer side.** [Android for Cars documentation](https://developer.android.com/training/cars) and the Car API guides for media, settings, and driver distraction rules. You met the service side in Lecture 7; this is what your colleagues building cabin features see. Build one tiny media or settings app against the emulator to feel the UX restrictions from their side.
4. **SystemUI and launcher customization.** AOSP `frameworks/base/packages/SystemUI` and the AAOS launcher/SystemUI overlays under `packages/apps/Car/`. Start from Lecture 8's RRO and config material, then read how your own product already customizes them (`adb shell dumpsys activity` and the product overlays tell the truth faster than docs).
5. **Settings and vehicle settings surfaces.** `packages/apps/Car/Settings` and its upstream settings architecture. Vehicle settings are where your Lecture 7 properties become driver-visible; knowing how the settings app reads CarProperty values makes you a better service author.
6. **Testing apps you integrate.** [Android testing documentation](https://developer.android.com/training/testing), instrumentation, and UIAutomator for system surfaces. On a bench, most regression reports are app-visible and system-caused; Lecture 10's workflow assumes you can reproduce at this layer.

If app development itself is your goal, this is the wrong course and that is fine: the official [Android developer training](https://developer.android.com/training) and the car-specific guides above are the right shelf, in that order.
