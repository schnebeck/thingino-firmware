PETCAM_AUDIO_ALARM_SITE_METHOD = local
PETCAM_AUDIO_ALARM_SITE = $(BR2_EXTERNAL_THINGINO_PATH)/package/petcam-audio-alarm
PETCAM_AUDIO_ALARM_DEPENDENCIES = thingino-raptor

# libhelix-aac.so is a vendor blob already installed on target by
# thingino-raptor (rad/rsd/rmr all link it); no Buildroot package ships a
# staging copy, so a local copy here is used purely to resolve symbols at
# build time. The on-device copy is what actually gets loaded at runtime.
define PETCAM_AUDIO_ALARM_BUILD_CMDS
	$(TARGET_CC) $(TARGET_CFLAGS) -O2 -Wall -Wextra \
		-o $(@D)/audio-alarm $(PETCAM_AUDIO_ALARM_PKGDIR)/files/audio-alarm.c \
		-L$(PETCAM_AUDIO_ALARM_PKGDIR)/files/libs -lhelix-aac -lm \
		-Wl,-rpath-link=$(PETCAM_AUDIO_ALARM_PKGDIR)/files/libs
endef

define PETCAM_AUDIO_ALARM_INSTALL_TARGET_CMDS
	$(INSTALL) -D -m 0755 $(@D)/audio-alarm \
		$(TARGET_DIR)/usr/sbin/audio-alarm
	$(INSTALL) -D -m 0755 $(PETCAM_AUDIO_ALARM_PKGDIR)/files/raptor-audio-alarm \
		$(TARGET_DIR)/usr/sbin/raptor-audio-alarm
	$(INSTALL) -D -m 0755 $(PETCAM_AUDIO_ALARM_PKGDIR)/files/S79audioalarm \
		$(TARGET_DIR)/etc/init.d/S79audioalarm

	$(INSTALL) -d $(TARGET_DIR)/var/www/a/plugins
	$(INSTALL) -D -m 0644 $(PETCAM_AUDIO_ALARM_PKGDIR)/files/audio-alarm.webui.json \
		$(TARGET_DIR)/var/www/a/plugins/audio-alarm.webui.json
	$(INSTALL) -D -m 0644 $(PETCAM_AUDIO_ALARM_PKGDIR)/files/www/config-audio-alarm.html \
		$(TARGET_DIR)/var/www/config-audio-alarm.html
	$(INSTALL) -D -m 0644 $(PETCAM_AUDIO_ALARM_PKGDIR)/files/www/a/config-audio-alarm.js \
		$(TARGET_DIR)/var/www/a/config-audio-alarm.js
	$(INSTALL) -D -m 0644 $(PETCAM_AUDIO_ALARM_PKGDIR)/files/www/a/audio-alarm-control.js \
		$(TARGET_DIR)/var/www/a/audio-alarm-control.js
	$(INSTALL) -D -m 0755 $(PETCAM_AUDIO_ALARM_PKGDIR)/files/www/x/json-audio-alarm.cgi \
		$(TARGET_DIR)/var/www/x/json-audio-alarm.cgi
endef

$(eval $(generic-package))
