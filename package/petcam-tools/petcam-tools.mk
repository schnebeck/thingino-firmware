PETCAM_TOOLS_SITE_METHOD = local
PETCAM_TOOLS_SITE = $(BR2_EXTERNAL_THINGINO_PATH)/package/petcam-tools

define PETCAM_TOOLS_BUILD_CMDS
	$(TARGET_CC) $(TARGET_CFLAGS) -static -Os -Wall -Wextra \
		-o $(@D)/stepper $(PETCAM_TOOLS_PKGDIR)/files/stepper.c
	$(TARGET_CC) $(TARGET_CFLAGS) -static -Os -Wall -Wextra \
		-o $(@D)/gpio-wait $(PETCAM_TOOLS_PKGDIR)/files/gpio-wait.c
endef

define PETCAM_TOOLS_INSTALL_TARGET_CMDS
	$(INSTALL) -D -m 0755 $(@D)/stepper \
		$(TARGET_DIR)/usr/sbin/stepper
	$(INSTALL) -D -m 0755 $(@D)/gpio-wait \
		$(TARGET_DIR)/usr/sbin/gpio-wait

	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/dispense-treat-cycle \
		$(TARGET_DIR)/usr/sbin/dispense-treat-cycle

	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/petcam-tls-pull \
		$(TARGET_DIR)/usr/sbin/petcam-tls-pull
	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/S51petcam-tls-cron \
		$(TARGET_DIR)/etc/init.d/S51petcam-tls-cron

	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/petcam-backup-push \
		$(TARGET_DIR)/usr/sbin/petcam-backup-push
	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/petcam-backup-sync \
		$(TARGET_DIR)/usr/sbin/petcam-backup-sync
	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/petcam-emergency-snapshot \
		$(TARGET_DIR)/usr/sbin/petcam-emergency-snapshot
	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/S52petcam-backup-cron \
		$(TARGET_DIR)/etc/init.d/S52petcam-backup-cron

	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/petcam-locate \
		$(TARGET_DIR)/usr/sbin/petcam-locate
	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/S53petcam-locate-cron \
		$(TARGET_DIR)/etc/init.d/S53petcam-locate-cron

	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/petcam-vpn-onconnect \
		$(TARGET_DIR)/usr/sbin/petcam-vpn-onconnect
	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/S54petcam-vpn-watch-cron \
		$(TARGET_DIR)/etc/init.d/S54petcam-vpn-watch-cron

	$(PETCAM_TOOLS_INSTALL_WWW_CMDS)
endef

ifeq ($(BR2_PACKAGE_THINGINO_WEBUI),y)
PETCAM_TOOLS_DEPENDENCIES += thingino-webui

define PETCAM_TOOLS_INSTALL_WWW_CMDS
	$(INSTALL) -d $(TARGET_DIR)/var/www/a/plugins
	$(INSTALL) -d $(TARGET_DIR)/var/www/x
	$(INSTALL) -D -m 0644 $(PETCAM_TOOLS_PKGDIR)/files/www/feed.html \
		$(TARGET_DIR)/var/www/feed.html
	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/www/x/json-feed.cgi \
		$(TARGET_DIR)/var/www/x/json-feed.cgi
	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/www/x/json-network-path.cgi \
		$(TARGET_DIR)/var/www/x/json-network-path.cgi
	$(INSTALL) -D -m 0644 $(PETCAM_TOOLS_PKGDIR)/files/petcam-feed.webui.json \
		$(TARGET_DIR)/var/www/a/plugins/petcam-feed.webui.json
	$(INSTALL) -D -m 0644 $(PETCAM_TOOLS_PKGDIR)/files/www/a/petcam-feed-preview.js \
		$(TARGET_DIR)/var/www/a/petcam-feed-preview.js
	$(INSTALL) -D -m 0644 $(PETCAM_TOOLS_PKGDIR)/files/www/a/feed.js \
		$(TARGET_DIR)/var/www/a/feed.js
	$(INSTALL) -D -m 0644 $(PETCAM_TOOLS_PKGDIR)/files/petcam-sounds.webui.json \
		$(TARGET_DIR)/var/www/a/plugins/petcam-sounds.webui.json
	$(INSTALL) -D -m 0644 $(PETCAM_TOOLS_PKGDIR)/files/www/config-sound-buttons.html \
		$(TARGET_DIR)/var/www/config-sound-buttons.html
	$(INSTALL) -D -m 0644 $(PETCAM_TOOLS_PKGDIR)/files/www/a/config-sound-buttons.js \
		$(TARGET_DIR)/var/www/a/config-sound-buttons.js
	$(INSTALL) -D -m 0644 $(PETCAM_TOOLS_PKGDIR)/files/www/a/sound-buttons-control.js \
		$(TARGET_DIR)/var/www/a/sound-buttons-control.js
	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/www/x/json-sound-buttons.cgi \
		$(TARGET_DIR)/var/www/x/json-sound-buttons.cgi
	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/www/x/json-sound-upload.cgi \
		$(TARGET_DIR)/var/www/x/json-sound-upload.cgi
	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/www/x/play-sound.cgi \
		$(TARGET_DIR)/var/www/x/play-sound.cgi
	$(INSTALL) -D -m 0644 $(PETCAM_TOOLS_PKGDIR)/files/petcam-locate.webui.json \
		$(TARGET_DIR)/var/www/a/plugins/petcam-locate.webui.json
	$(INSTALL) -D -m 0644 $(PETCAM_TOOLS_PKGDIR)/files/www/tool-locate.html \
		$(TARGET_DIR)/var/www/tool-locate.html
	$(INSTALL) -D -m 0644 $(PETCAM_TOOLS_PKGDIR)/files/www/a/tool-locate.js \
		$(TARGET_DIR)/var/www/a/tool-locate.js
	$(INSTALL) -D -m 0755 $(PETCAM_TOOLS_PKGDIR)/files/www/x/json-locate.cgi \
		$(TARGET_DIR)/var/www/x/json-locate.cgi
	$(INSTALL) -D -m 0644 $(PETCAM_TOOLS_PKGDIR)/files/www/a/footer-locate.js \
		$(TARGET_DIR)/var/www/a/footer-locate.js
endef
endif

# SD card init robustness: this camera's MMC0 contact is marginal enough
# to reliably hit -ETIMEDOUT during mmc_sd_init_card() (see ADMIN.md for
# the investigation). CONFIG_MMC0_MAX_FREQ is a separate, deliberately
# shared fixup in thingino-kopt.mk (Buildroot's per-package fixup pass
# runs packages in a fixed order regardless of which package defines the
# hook, so a petcam-local override here would just get raced and lost -
# verified empirically). CONFIG_MMC_PARANOID_SD_INIT isn't touched by
# any other package, so it's safe to set from here: retries
# mmc_sd_init_card() up to 5 times instead of giving up after 1, for the
# case where the marginal contact only causes an occasional bad attempt.
# thingino-kopt's FAT/VFAT fixup only applies to xburst2 boards (SD-card
# filesystem support isn't assumed for xburst1 cameras in general); this
# camera actually has an SD card slot, so enable it here instead of
# touching the shared, cross-camera thingino-kopt.mk.
define PETCAM_TOOLS_LINUX_CONFIG_FIXUPS
	$(call KCONFIG_ENABLE_OPT,CONFIG_MMC_PARANOID_SD_INIT)
	$(call KCONFIG_ENABLE_OPT,CONFIG_FAT_FS)
	$(call KCONFIG_ENABLE_OPT,CONFIG_VFAT_FS)
	$(call KCONFIG_SET_OPT,CONFIG_FAT_DEFAULT_CODEPAGE,437)
	$(call KCONFIG_SET_OPT,CONFIG_FAT_DEFAULT_IOCHARSET,"iso8859-1")
endef

# TEMPORARY: pin U-Boot to a known-good pre-built binary instead of the
# live source build - see board/ingenic/xburst1/blobs/README.md for the
# full investigation (kernel source, kernel Kconfig, and host toolchain
# were all independently ruled out; the regression is in the U-Boot
# source itself, at a point that's no longer reproducible). Remove this
# override once the real cause is found upstream, or once a fresh U-Boot
# build is manually reverified against the SD card. petcam-tools is only
# ever enabled for arenti_petcam (see this camera's own defconfig), so
# no further guard is needed here.
define PETCAM_TOOLS_OVERRIDE_UBOOT_BLOB
	cp -f $(BR2_EXTERNAL_THINGINO_PATH)/board/ingenic/xburst1/blobs/arenti_petcam-uboot-known-good-2026-09-10.bin \
		$(BINARIES_DIR)/u-boot-with-tpl-lzma.bin
endef
UBOOT_POST_INSTALL_IMAGES_HOOKS += PETCAM_TOOLS_OVERRIDE_UBOOT_BLOB

$(eval $(generic-package))
