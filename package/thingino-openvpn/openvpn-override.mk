################################################################################
#
# openvpn overrides for Thingino
#
################################################################################

ifeq ($(BR2_PACKAGE_OPENVPN),y)

ifeq ($(BR2_PACKAGE_THINGINO_WEBUI),y)
OPENVPN_DEPENDENCIES += thingino-webui

define OPENVPN_INSTALL_WEBUI
	$(INSTALL) -d $(TARGET_DIR)/var/www/a
	$(INSTALL) -d $(TARGET_DIR)/var/www/x
	$(INSTALL) -d $(TARGET_DIR)/var/www/a/plugins
	$(INSTALL) -D -m 0644 $(BR2_EXTERNAL_THINGINO_PATH)/package/thingino-openvpn/files/www/config-openvpn.html \
		$(TARGET_DIR)/var/www/config-openvpn.html
	$(INSTALL) -D -m 0644 $(BR2_EXTERNAL_THINGINO_PATH)/package/thingino-openvpn/files/www/a/config-openvpn.js \
		$(TARGET_DIR)/var/www/a/config-openvpn.js
	$(INSTALL) -D -m 0755 $(BR2_EXTERNAL_THINGINO_PATH)/package/thingino-openvpn/files/www/x/json-config-openvpn.cgi \
		$(TARGET_DIR)/var/www/x/json-config-openvpn.cgi
	$(INSTALL) -D -m 0755 $(BR2_EXTERNAL_THINGINO_PATH)/package/thingino-openvpn/files/www/x/json-openvpn.cgi \
		$(TARGET_DIR)/var/www/x/json-openvpn.cgi
	$(INSTALL) -D -m 0644 $(BR2_EXTERNAL_THINGINO_PATH)/package/thingino-openvpn/files/openvpn.webui.json \
		$(TARGET_DIR)/var/www/a/plugins/openvpn.webui.json
endef
OPENVPN_POST_INSTALL_TARGET_HOOKS += OPENVPN_INSTALL_WEBUI
endif

define OPENVPN_INSTALL_SCRIPTS
	$(INSTALL) -D -m 0755 $(BR2_EXTERNAL_THINGINO_PATH)/package/thingino-openvpn/files/S43openvpn \
		$(TARGET_DIR)/etc/init.d/S43openvpn
	# Stock openvpn.mk installs its own generic S60openvpn (expects a static
	# /etc/openvpn/openvpn.conf). We drive everything through S43openvpn
	# instead (reads config from thingino.json), so drop the stock one to
	# avoid two competing init scripts.
	rm -f $(TARGET_DIR)/etc/init.d/S60openvpn
endef
OPENVPN_POST_INSTALL_TARGET_HOOKS += OPENVPN_INSTALL_SCRIPTS

endif # BR2_PACKAGE_OPENVPN
