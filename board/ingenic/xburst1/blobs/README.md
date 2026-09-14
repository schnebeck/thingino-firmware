# Pinned binary blobs

## arenti_petcam-uboot-known-good-2026-09-10.bin

A pre-built U-Boot binary (`u-boot-with-tpl-lzma.bin` format, 327680 bytes,
the full padded boot partition size) for the `arenti_petcam` camera,
pinned into the build via `UBOOT_POST_INSTALL_IMAGES_HOOKS` in
`package/petcam-tools/petcam-tools.mk`, overriding whatever U-Boot the
normal Buildroot `uboot` package build produces.

**Why this exists:** on 2026-09-10, a full day of investigation traced a
reproducible SD/MMC0 card-initialization failure (`mmc0: error -145
whilst initialising SD card`, every attempt, every card tried, both
SDXC and SDHC) to the U-Boot binary specifically - not the Linux kernel
(same git commit, confirmed via `output/*/build/linux-<hash>` directory
names), not the Linux kernel Kconfig (a full diff against a known-working
build's `/proc/config.gz` came down to 4 unrelated additive lines:
`FAT_FS`/`VFAT_FS`/`TUN`), and not the host toolchain used to compile
U-Boot (rebuilding U-Boot from today's source with a toolchain preserved
from a much older build still failed identically).

Evidence trail, in order:
1. A firmware image built 2026-09-10 03:00 UTC (before the kernel/UBoot
   investigation began) initializes the SD card correctly and
   reproducibly (fresh boot, and again after a spontaneous reboot).
2. Rebuilding today's full source tree with the Linux kernel Kconfig
   forced to exactly match that working build's MMC-related settings
   (`CONFIG_JZMMC_V12=m`, `CONFIG_MMC0_MAX_FREQ=48000000`,
   `CONFIG_MMC_PARANOID_SD_INIT` unset, no `GPIO_MMC_CD_N` patch) still
   fails identically. Kernel source and Kconfig are ruled out.
3. Extracting just the U-Boot partition from the 2026-09-10 image and
   flashing it standalone (`sysupgrade -b`) while keeping today's kernel
   and rootfs makes the SD card work again immediately, and it survives
   a subsequent warm reboot. This isolates the cause to U-Boot.
4. Rebuilding U-Boot from today's source, but with a host toolchain
   preserved from an earlier, untouched build directory (predating a
   2026-09-13 refresh of the `thingino-toolchain-x86_64_xburst1_uclibc`
   GitHub release asset - confirmed via the GitHub API `updated_at`
   timestamp on that asset), still fails identically. The toolchain
   is ruled out too.

That leaves the U-Boot **source** itself (the vendor/thingino patch set
applied on top of the vanilla `u-boot-2026.07` release, in
`package/all-patches/uboot/2026.07/`, or the vanilla release tarball
itself) as the only remaining variable - but the exact change can no
longer be pinned down: the cached source tarball in `dl/uboot/` is
dated 2026-09-10 23:09 UTC, after the working 03:00 build, and whatever
it originally contained at 03:00 was overwritten by the time this was
investigated. There is no git commit in this repository's history that
touches U-Boot's config or patches around that window, which points to
something changing upstream of this project rather than in it.

**How to remove this workaround once the real cause is found:** delete
this file and the `UBOOT_POST_INSTALL_IMAGES_HOOKS` hook in
`package/petcam-tools/petcam-tools.mk`, then do a full from-scratch
rebuild and manually re-verify the SD card actually initializes
(`dmesg | grep mmc`, `/dev/mmcblk0` should appear) before trusting it -
this exact failure mode has no build-time signal (nothing errors,
nothing warns), it only shows up as a device that never gets a
functioning SD card.
