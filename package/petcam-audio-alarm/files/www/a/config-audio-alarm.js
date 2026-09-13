(function () {
  "use strict";

  const endpoint = "/x/json-audio-alarm.cgi";
  const services = [
    { id: "email", label: "Email", icon: "bi-envelope" },
    { id: "ftp", label: "FTP", icon: "bi-hdd-network" },
    { id: "telegram", label: "Telegram", icon: "bi-telegram" },
    { id: "mqtt", label: "MQTT", icon: "bi-broadcast" },
    { id: "webhook", label: "Webhook", icon: "bi-link-45deg" },
    { id: "storage", label: "Storage", icon: "bi-hdd" },
    { id: "ntfy", label: "Ntfy", icon: "bi-bell" },
    { id: "xmpp", label: "XMPP", icon: "bi-chat-dots" },
    { id: "gotify", label: "Gotify", icon: "bi-bell-fill" },
    { id: "pushover", label: "Pushover", icon: "bi-send-fill" },
    { id: "gphotos", label: "Google Photos", icon: "bi-google" },
  ];

  const enabledInput = $("#aa_enabled");
  const activityRatioInput = $("#aa_activity_ratio");
  const activityRatioValue = $("#aa_activity_ratio_value");
  const integralThresholdInput = $("#aa_integral_threshold");
  const integralThresholdValue = $("#aa_integral_threshold_value");
  const recordSecsInput = $("#aa_record_secs");
  const recordSecsValue = $("#aa_record_secs_value");
  const extendSecsInput = $("#aa_extend_secs");
  const extendSecsValue = $("#aa_extend_secs_value");
  const emailSubjectInput = $("#aa_email_subject");
  const emailBodyInput = $("#aa_email_body");
  const saveAllButton = $("#save_all");
  const servicesBody = $("#aa-services-body");

  function bindRangeDisplay(input, display) {
    if (!input) return;
    input.addEventListener("input", () => {
      if (display) display.textContent = input.value;
    });
  }
  bindRangeDisplay(activityRatioInput, activityRatioValue);
  bindRangeDisplay(integralThresholdInput, integralThresholdValue);
  bindRangeDisplay(recordSecsInput, recordSecsValue);
  bindRangeDisplay(extendSecsInput, extendSecsValue);

  function buildServicesTable() {
    if (!servicesBody) return;
    servicesBody.innerHTML = services
      .map(
        (svc) => `
      <tr>
        <td><a href="tool-send2-${svc.id}.html"><i class="bi ${svc.icon} me-2"></i>${svc.label}</a></td>
        <td>
          <div class="form-switch d-inline-block m-0">
            <input class="form-check-input aa-sendto" type="checkbox" id="aa_send2${svc.id}" data-service="${svc.id}">
          </div>
        </td>
        <td><button type="button" class="btn btn-outline-secondary btn-sm" data-sendto="${svc.id}" title="Test ${svc.label} service">Test</button></td>
      </tr>`,
      )
      .join("");
  }

  async function loadConfig() {
    showBusy("Loading configuration...");
    try {
      const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Failed to load configuration");
      const data = await response.json();
      const aa = data.audio_alarm || {};

      if (enabledInput) enabledInput.checked = aa.enabled === true || aa.enabled === "true";
      if (activityRatioInput) {
        activityRatioInput.value = aa.activity_ratio ?? 1.5;
        if (activityRatioValue) activityRatioValue.textContent = activityRatioInput.value;
      }
      if (integralThresholdInput) {
        integralThresholdInput.value = aa.integral_threshold ?? 4000;
        if (integralThresholdValue) integralThresholdValue.textContent = integralThresholdInput.value;
      }
      if (recordSecsInput) {
        recordSecsInput.value = aa.record_secs ?? 20;
        if (recordSecsValue) recordSecsValue.textContent = recordSecsInput.value;
      }
      if (extendSecsInput) {
        extendSecsInput.value = aa.extend_secs ?? 10;
        if (extendSecsValue) extendSecsValue.textContent = extendSecsInput.value;
      }
      if (emailSubjectInput) emailSubjectInput.value = aa.email_subject || "";
      if (emailBodyInput) emailBodyInput.value = aa.email_body || "";

      services.forEach((svc) => {
        const checkbox = $(`#aa_send2${svc.id}`);
        if (checkbox) {
          checkbox.checked = aa[`send2${svc.id}`] === true || aa[`send2${svc.id}`] === "true";
        }
      });
    } catch (err) {
      console.error("Failed to load config:", err);
      showAlert("danger", `Failed to load configuration: ${err.message || err}`);
    } finally {
      hideBusy();
    }
  }

  async function saveAllSettings() {
    if (!saveAllButton) return;
    showBusy("Saving settings...");
    saveAllButton.disabled = true;
    try {
      const audio_alarm = {
        enabled: enabledInput ? enabledInput.checked : false,
        activity_ratio: activityRatioInput ? Number(activityRatioInput.value) : 1.5,
        integral_threshold: integralThresholdInput ? Number(integralThresholdInput.value) : 4000,
        record_secs: recordSecsInput ? Number(recordSecsInput.value) : 20,
        extend_secs: extendSecsInput ? Number(extendSecsInput.value) : 10,
        email_subject: emailSubjectInput ? emailSubjectInput.value.trim() : "",
        email_body: emailBodyInput ? emailBodyInput.value.trim() : "",
      };
      services.forEach((svc) => {
        const checkbox = $(`#aa_send2${svc.id}`);
        audio_alarm[`send2${svc.id}`] = checkbox ? checkbox.checked : false;
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_alarm }),
      });
      if (!response.ok) throw new Error("Failed to save settings");
      const result = await response.json();
      if (result.error) throw new Error(result.error.message || "Failed to save settings");
      showAlert("success", "Settings saved successfully.", 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      showAlert("danger", `Failed to save settings: ${err.message || err}`);
    } finally {
      hideBusy();
      saveAllButton.disabled = false;
    }
  }

  buildServicesTable();

  const testModalEl = $("#aa-test-modal");
  const testModal = testModalEl ? new bootstrap.Modal(testModalEl) : null;
  const testOutput = $("#aa-test-output");
  const testTitle = $("#aa-test-title");

  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-sendto]");
    if (!btn) return;
    ev.preventDefault();
    const target = btn.dataset.sendto;
    if (testTitle) testTitle.textContent = `Test: ${target}`;
    if (testOutput) testOutput.textContent = "Running...";
    if (testModal) testModal.show();
    btn.disabled = true;

    fetch(`/x/send.cgi?${new URLSearchParams({ to: target, verbose: "1" }).toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!testOutput) return;
        if (data.error) {
          testOutput.textContent = `Error: ${data.error.message || data.error}`;
        } else if (data.message && typeof data.message === "object") {
          testOutput.textContent = data.message.output || JSON.stringify(data.message, null, 2);
        } else {
          testOutput.textContent = String(data.message || "(no output)");
        }
      })
      .catch((err) => {
        if (testOutput) testOutput.textContent = `Request failed: ${err}`;
      })
      .finally(() => {
        btn.disabled = false;
      });
  });

  if (saveAllButton) saveAllButton.addEventListener("click", saveAllSettings);

  loadConfig();
})();
