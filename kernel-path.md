---
layout: page
title: The kernel path
subtitle: Pointers for kernel and driver customization, in the order a system engineer actually needs them.
permalink: /kernel-path/
---

This course stops at the kernel's interfaces on purpose. But system work constantly touches the kernel's edges: a HAL needs a device node, boot stalls before `init`, a vendor kernel config breaks a VTS test. When that happens, learn in this order. Each step lists the upstream document worth your evening, and the lecture it connects to.

1. **How Android uses the kernel (GKI).** Start with the [Generic Kernel Image documentation](https://source.android.com/docs/core/architecture/kernel/gki) and the [kernel overview](https://source.android.com/docs/core/architecture/kernel). Understand GKI vs vendor modules before touching a config; on modern AAOS the kernel is mostly not yours to fork, and knowing why saves a program-level argument. Connects to Lectures 4 and 6.
2. **Kernel configuration and build.** [Build kernels](https://source.android.com/docs/setup/build/building-kernels) and Kleaf (the kernel build system). Learn `gki_defconfig`, fragment configs, and how a config change is supposed to ship. Connects to Lecture 2: it is Soong's cousin, with the same lesson that generated files are not edited by hand.
3. **Device tree.** Your SoC vendor's documentation first (this is genuinely vendor territory), then upstream kernel DT bindings in `Documentation/devicetree/bindings/`. A system engineer mostly reads DT to answer "which node owns this device, and did the vendor's board file describe it?" Connects to Lectures 4 and 6.
4. **Drivers you will actually meet in IVI.** Input (touch), display/DRM, audio (ALSA/ASoC), CAN and vehicle interfaces behind the VHAL, and power/suspend. Read the relevant subsystem docs under `Documentation/` in the kernel tree, and the AOSP [HAL documentation](https://source.android.com/docs/core/architecture/hal) from the other side of the boundary. Connects to Lectures 6 and 7.
5. **Debugging below Android.** Kernel logs (`dmesg`, serial console), `ftrace`/Perfetto kernel tracing, and reading a kernel panic next to an Android tombstone. The [Perfetto documentation](https://perfetto.dev/docs/) covers the shared tooling; Lecture 10 covers the Android side of the same trace.
6. **Vendor modules and the ABI you must not break.** [Vendor module documentation](https://source.android.com/docs/core/architecture/kernel/vendor-module), KMI symbol lists, and why `android/abi_gki_aarch64` exists. This is where kernel work becomes compliance work; Lecture 12 picks it up from the VTS side.

Rule of thumb for OEM work: prefer a userspace or HAL fix over a kernel change, prefer a config change over a driver change, and treat every kernel change as a long-term maintenance debt you are choosing with open eyes. If you need to go deeper than pointers, the Linux kernel's own [documentation index](https://docs.kernel.org/) and LWN are the working engineer's next shelf.
