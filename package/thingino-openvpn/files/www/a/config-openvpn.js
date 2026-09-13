(function () {
  const form = $("#openvpnForm");
  const configInput = $("#ovpn_config");
  const enabledSwitch = $("#ovpn_enabled");
  const submitButton = $("#ovpn_submit");
  const importFileButton = $("#ovpn-import-file");
  const importFileInput = $("#ovpn-import-file-input");
  const toggleButton = $("#btn-ovpn-toggle");
  const ovpnCtrl = $("#ovpn-ctrl");
  const ovpnCtrlMessage = $("#ovpn-ctrl-message");
  const ovpnToggleLabel = $("#ovpn-toggle-label");
  const ovpnNotSupported = $("#ovpn-not-supported");
  let ovpnStatus = 0;
  let isBusy = false;

  function toggleBusy(state, label) {
    isBusy = state;
    submitButton.disabled = state;
    if (importFileButton) importFileButton.disabled = state;
    configInput.disabled = state;
    enabledSwitch.disabled = state;
    if (state) {
      showBusy(label || "Working...");
    } else {
      hideBusy();
    }
  }

  function updateOvpnControl(status) {
    ovpnStatus = status;
    ovpnCtrl.classList.remove("d-none", "alert-success", "alert-danger");
    toggleButton.classList.remove("btn-success", "btn-danger");

    if (ovpnStatus === 1) {
      ovpnCtrl.classList.add("alert-danger");
      toggleButton.classList.add("btn-danger");
      ovpnCtrlMessage.textContent =
        "Attention! Switching OpenVPN off while working over the VPN connection will render this camera inaccessible! Make sure you have a backup plan.";
      ovpnToggleLabel.textContent = "OFF";
    } else {
      ovpnCtrl.classList.add("alert-success");
      toggleButton.classList.add("btn-success");
      ovpnCtrlMessage.textContent =
        "Please click the button below to switch the OpenVPN client on. Make sure the configuration is correct and saved!";
      ovpnToggleLabel.textContent = "ON";
    }
  }

  async function loadConfig(options = {}) {
    const preserveBusy = options.preserveBusy === true;
    if (!preserveBusy) {
      toggleBusy(true, "Loading OpenVPN settings...");
    }
    try {
      const response = await fetch("/x/json-config-openvpn.cgi", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Failed to load OpenVPN configuration");
      const data = await response.json();

      const supported = data.openvpn_supported === true;
      if (!supported) {
        ovpnNotSupported.classList.remove("d-none");
        form.classList.add("d-none");
        return;
      }

      configInput.value = data.config || "";
      enabledSwitch.checked = data.enabled === true;

      updateOvpnControl(data.openvpn_status || 0);
    } catch (err) {
      showAlert("danger", err.message || "Unable to load OpenVPN configuration.");
    } finally {
      if (!preserveBusy) {
        toggleBusy(false);
      }
    }
  }

  async function saveConfig(payload) {
    toggleBusy(true, "Saving OpenVPN settings...");
    try {
      const response = await fetch("/x/json-config-openvpn.cgi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || (result && result.error)) {
        const message =
          result && result.error && result.error.message
            ? result.error.message
            : "Failed to save settings";
        throw new Error(message);
      }
      showAlert("", "");
      showOverlayMessage(
        result.message || "OpenVPN configuration saved.",
        "success",
      );
      await loadConfig({ preserveBusy: true });
    } catch (err) {
      showAlert("danger", err.message || "Failed to save OpenVPN configuration.");
    } finally {
      toggleBusy(false);
    }
  }

  async function toggleOpenVpn() {
    const targetState = ovpnStatus === 1 ? 0 : 1;
    toggleButton.disabled = true;
    showBusy("Switching OpenVPN...");

    try {
      const response = await fetch("/x/json-openvpn.cgi?state=" + targetState);
      const result = await response.json();

      if (result.error) {
        showAlert("danger", result.error.message || "Failed to toggle OpenVPN");
      } else {
        updateOvpnControl(result.message.status || 0);
        showAlert("", "");
        showOverlayMessage(
          result.message.message || "OpenVPN status updated",
          "success",
        );
      }
    } catch (err) {
      showAlert("danger", err.message || "Failed to toggle OpenVPN");
    } finally {
      hideBusy();
      toggleButton.disabled = false;
    }
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    const payload = {
      enabled: enabledSwitch.checked,
      config: configInput.value,
    };
    saveConfig(payload);
  });

  toggleButton.addEventListener("click", toggleOpenVpn);

  if (importFileButton && importFileInput) {
    importFileButton.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        configInput.value = e.target.result;
        showOverlayMessage(
          "OpenVPN profile imported. Review and save.",
          "success",
        );
        importFileInput.value = "";
      };
      reader.readAsText(file);
    });
  }

  const reloadButton = $("#openvpn-reload");
  if (reloadButton) {
    reloadButton.addEventListener("click", async () => {
      try {
        reloadButton.disabled = true;
        await loadConfig();
        showAlert("info", "OpenVPN settings reloaded from camera.", 3000);
      } catch (err) {
        showAlert("danger", "Failed to reload OpenVPN settings.");
      } finally {
        reloadButton.disabled = false;
      }
    });
  }

  loadConfig();
})();
