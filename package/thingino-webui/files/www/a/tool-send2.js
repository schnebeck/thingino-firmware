(function () {
  "use strict";

  const endpoint = "/x/json-send2.cgi";
  const serviceCapabilities = {
    email: { photo: true, video: true },
    ftp: { photo: true, video: true },
    telegram: { photo: true, video: true },
    gotify: { photo: false, video: false },
    pushover: { photo: true, video: false },
    mqtt: { photo: true, video: false },
    webhook: { photo: true, video: true },
    storage: { photo: true, video: true },
    ntfy: { photo: true, video: false },
    gphotos: { photo: true, video: true },
    xmpp: { photo: true, video: false },
  };

  const motionEnabledInput = $("#motion_enabled");
  const motionPlayOnSpeakerInput = $("#motion_playonspeaker");
  const motionSensitivityInput = $("#motion_sensitivity");
  const motionSensitivityValue = $("#motion_sensitivity_value");
  const motionCooldownInput = $("#motion_cooldown");
  const motionCooldownValue = $("#motion_cooldown_value");
  const motionRecordSecsInput = $("#motion_record_secs");
  const motionRecordSecsValue = $("#motion_record_secs_value");
  const motionExtendSecsInput = $("#motion_extend_secs");
  const motionExtendSecsValue = $("#motion_extend_secs_value");
  const motionEmailSubjectInput = $("#motion_email_subject");
  const motionEmailBodyInput = $("#motion_email_body");
  const saveAllButton = $("#save_all");

  // Speaker elements
  const speakerFileInput = $("#speaker_file");
  const speakerVolumeInput = $("#speaker_volume");
  const speakerVolumeValue = $("#speaker_volume_value");
  const speakerGainInput = $("#speaker_gain");
  const speakerGainValue = $("#speaker_gain_value");
  const speakerLoopInput = $("#speaker_loop");
  const testSpeakerButton = $("#test_speaker");

  // Update slider value displays
  if (motionSensitivityInput) {
    motionSensitivityInput.addEventListener("input", () => {
      if (motionSensitivityValue) {
        motionSensitivityValue.textContent = motionSensitivityInput.value;
      }
    });
  }

  if (motionCooldownInput) {
    motionCooldownInput.addEventListener("input", () => {
      if (motionCooldownValue) {
        motionCooldownValue.textContent = motionCooldownInput.value;
      }
    });
  }

  if (motionRecordSecsInput) {
    motionRecordSecsInput.addEventListener("input", () => {
      if (motionRecordSecsValue) {
        motionRecordSecsValue.textContent = motionRecordSecsInput.value;
      }
    });
  }

  if (motionExtendSecsInput) {
    motionExtendSecsInput.addEventListener("input", () => {
      if (motionExtendSecsValue) {
        motionExtendSecsValue.textContent = motionExtendSecsInput.value;
      }
    });
  }

  if (speakerVolumeInput) {
    speakerVolumeInput.addEventListener("input", () => {
      if (speakerVolumeValue) {
        speakerVolumeValue.textContent = speakerVolumeInput.value;
      }
    });
  }

  if (speakerGainInput) {
    speakerGainInput.addEventListener("input", () => {
      if (speakerGainValue) {
        speakerGainValue.textContent = speakerGainInput.value;
      }
    });
  }

  async function updateMotionValue(service, value) {
    try {
      const payload = {
        motion: {
          [service]: value,
        },
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to update");

      const result = await response.json();
      if (result.error) throw new Error(result.error.message);
    } catch (err) {
      console.error(`Failed to update ${service}:`, err);
      showAlert("danger", `Failed to update ${service}: ${err.message || err}`);
    }
  }

  const audioAlarmEndpoint = "/x/json-audio-alarm.cgi";

  async function updateAudioAlarmValue(service, value) {
    try {
      const payload = { audio_alarm: { [service]: value } };
      const response = await fetch(audioAlarmEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update");
      const result = await response.json();
      if (result.error) throw new Error(result.error.message);
    } catch (err) {
      console.error(`Failed to update audio alarm ${service}:`, err);
      showAlert("danger", `Failed to update ${service}: ${err.message || err}`);
    }
  }

  async function loadConfig() {
    showBusy("Loading configuration...");
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error("Failed to load configuration");

      const data = await response.json();

      // Apply motion settings
      if (data.motion) {
        if (motionEnabledInput)
          motionEnabledInput.checked =
            data.motion.enabled === true || data.motion.enabled === "true";
        if (motionPlayOnSpeakerInput)
          motionPlayOnSpeakerInput.checked =
            data.motion.playonspeaker === true ||
            data.motion.playonspeaker === "true";
        if (motionSensitivityInput) {
          motionSensitivityInput.value = data.motion.sensitivity || 4;
          if (motionSensitivityValue)
            motionSensitivityValue.textContent = motionSensitivityInput.value;
        }
        if (motionCooldownInput) {
          motionCooldownInput.value = data.motion.cooldown_time || 15;
          if (motionCooldownValue)
            motionCooldownValue.textContent = motionCooldownInput.value;
        }
        if (motionRecordSecsInput) {
          motionRecordSecsInput.value = data.motion.record_secs || 20;
          if (motionRecordSecsValue)
            motionRecordSecsValue.textContent = motionRecordSecsInput.value;
        }
        if (motionExtendSecsInput) {
          motionExtendSecsInput.value = data.motion.extend_secs ?? 10;
          if (motionExtendSecsValue)
            motionExtendSecsValue.textContent = motionExtendSecsInput.value;
        }
        if (motionEmailSubjectInput)
          motionEmailSubjectInput.value = data.motion.email_subject || "";
        if (motionEmailBodyInput)
          motionEmailBodyInput.value = data.motion.email_body || "";

        // Update motion service checkboxes
        const services = [
          "email",
          "ftp",
          "telegram",
          "gotify",
          "pushover",
          "mqtt",
          "webhook",
          "storage",
          "ntfy",
          "gphotos",
          "xmpp",
        ];
        services.forEach((service) => {
          const checkbox = $(`#motion_send2${service}`);
          if (checkbox) {
            checkbox.checked =
              data.motion[`send2${service}`] === true ||
              data.motion[`send2${service}`] === "true";
          }
        });
      }

      // Update service status badges (photo/video support)
      const services = [
        "email",
        "ftp",
        "telegram",
        "gotify",
        "pushover",
        "mqtt",
        "webhook",
        "storage",
        "ntfy",
        "gphotos",
        "xmpp",
      ];
      services.forEach((service) => {
        const serviceData = data[service];
        const photoStatus = $(`#status-${service}-photo`);
        const videoStatus = $(`#status-${service}-video`);
        const capabilities = serviceCapabilities[service] || {};

        const setStatus = (element, enabled) => {
          if (!element) return;
          element.textContent = enabled ? "✓" : "✗";
          element.className = enabled
            ? "badge bg-success"
            : "badge bg-secondary";
        };

        if (photoStatus) {
          const sendPhoto =
            capabilities.photo === true &&
            serviceData &&
            (serviceData.send_photo === true ||
              serviceData.send_photo === "true");
          setStatus(photoStatus, sendPhoto);
        }

        if (videoStatus) {
          const sendVideo =
            capabilities.video === true &&
            serviceData &&
            (serviceData.send_video === true ||
              serviceData.send_video === "true");
          setStatus(videoStatus, sendVideo);
        }
      });

      // Apply speaker settings
      if (data.speaker) {
        if (speakerFileInput) speakerFileInput.value = data.speaker.file || "";
        if (speakerVolumeInput) {
          speakerVolumeInput.value = data.speaker.volume ?? 80;
          if (speakerVolumeValue)
            speakerVolumeValue.textContent = speakerVolumeInput.value;
        }
        if (speakerGainInput) {
          speakerGainInput.value = data.speaker.gain ?? 20;
          if (speakerGainValue)
            speakerGainValue.textContent = speakerGainInput.value;
        }
        if (speakerLoopInput) speakerLoopInput.value = data.speaker.loop ?? 1;
      }

      try {
        const aaResponse = await fetch(audioAlarmEndpoint, {
          headers: { Accept: "application/json" },
        });
        if (aaResponse.ok) {
          const aaData = await aaResponse.json();
          const audioAlarm = aaData.audio_alarm || {};
          services.forEach((service) => {
            const checkbox = $(`#audio_send2${service}`);
            if (checkbox) {
              checkbox.checked =
                audioAlarm[`send2${service}`] === true ||
                audioAlarm[`send2${service}`] === "true";
            }
          });
        }
      } catch (err) {
        console.error("Failed to load audio alarm config:", err);
      }
    } catch (err) {
      console.error("Failed to load config:", err);
      showAlert(
        "danger",
        `Failed to load configuration: ${err.message || err}`,
      );
    } finally {
      hideBusy();
    }
  }

  async function saveAllSettings() {
    if (!saveAllButton) return;

    showBusy("Saving settings...");
    saveAllButton.disabled = true;

    try {
      const payload = {
        motion: {
          enabled: motionEnabledInput ? motionEnabledInput.checked : false,
          playonspeaker: motionPlayOnSpeakerInput
            ? motionPlayOnSpeakerInput.checked
            : false,
          sensitivity: motionSensitivityInput
            ? Number(motionSensitivityInput.value)
            : 4,
          cooldown_time: motionCooldownInput
            ? Number(motionCooldownInput.value)
            : 15,
          record_secs: motionRecordSecsInput
            ? Number(motionRecordSecsInput.value)
            : 20,
          extend_secs: motionExtendSecsInput
            ? Number(motionExtendSecsInput.value)
            : 10,
          email_subject: motionEmailSubjectInput
            ? motionEmailSubjectInput.value.trim()
            : "",
          email_body: motionEmailBodyInput
            ? motionEmailBodyInput.value.trim()
            : "",
        },
        speaker: {
          file: speakerFileInput ? speakerFileInput.value : "",
          volume: speakerVolumeInput ? Number(speakerVolumeInput.value) : 80,
          gain: speakerGainInput ? Number(speakerGainInput.value) : 20,
          loop: speakerLoopInput ? Number(speakerLoopInput.value) : 1,
        },
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message || "Failed to save settings");
      }

      showAlert("success", "Settings saved successfully.", 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      showAlert("danger", `Failed to save settings: ${err.message || err}`);
    } finally {
      hideBusy();
      saveAllButton.disabled = false;
    }
  }

  function testSpeaker() {
    if (!testSpeakerButton) return;
    testSpeakerButton.disabled = true;

    const params = new URLSearchParams({ to: "speaker" });
    fetch(`/x/send.cgi?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          showAlert(
            "danger",
            `Speaker test failed: ${data.error.message || data.error}`,
          );
        } else {
          showAlert("success", "Speaker test played.", 3000);
        }
      })
      .catch((err) => {
        showAlert("danger", `Speaker test failed: ${err}`);
      })
      .finally(() => {
        testSpeakerButton.disabled = false;
      });
  }

  // Handle motion service toggles
  $$(".motion-sendto").forEach((checkbox) => {
    checkbox.addEventListener("change", (ev) => {
      const service = ev.target.dataset.service;
      const value = ev.target.checked;
      updateMotionValue(service, value);
    });
  });

  // Handle audio alarm service toggles
  $$(".audio-sendto").forEach((checkbox) => {
    checkbox.addEventListener("change", (ev) => {
      const service = ev.target.dataset.service;
      const value = ev.target.checked;
      updateAudioAlarmValue(service, value);
    });
  });

  // Handle test buttons
  const testModalEl = $("#send2-test-modal");
  const testModal = testModalEl ? new bootstrap.Modal(testModalEl) : null;
  const testOutput = $("#send2-test-output");
  const testTitle = $("#send2-test-title");
  const testVerbose = $("#send2-test-verbose");

  const renderTestResult = (data) => {
    if (!testOutput) return;
    let text = "";
    const stripAnsi = (s) =>
      typeof s === "string" ? s.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "") : s;

    if (!data) {
      text = "No response received.";
    } else if (data.error) {
      const err = data.error.message || data.error.code || data.error;
      text = `Error: ${err}`;
    } else if (data.message && typeof data.message === "object") {
      const msg = data.message;
      if (msg.output_b64) {
        try {
          text = stripAnsi(decodeBase64String(msg.output_b64));
        } catch (e) {
          text = `Failed to decode output: ${e}`;
        }
      } else {
        text = stripAnsi(msg.output || JSON.stringify(msg, null, 2));
      }
      if (msg.status && msg.status !== "success") {
        text = `[${msg.status}] ${text}`;
      }
    } else if (typeof data.message === "string") {
      text = stripAnsi(data.message);
    } else {
      text = stripAnsi(JSON.stringify(data, null, 2));
    }

    testOutput.textContent = text || "(no output)";
  };

  $$("button[data-sendto]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const target = btn.dataset.sendto;
      if (!target) return;

      if (testTitle) testTitle.textContent = `Test: ${target}`;
      if (testOutput) testOutput.textContent = "Running...";
      if (testModal) testModal.show();

      btn.disabled = true;

      const params = new URLSearchParams({ to: target });
      if (!testVerbose || testVerbose.checked) {
        params.set("verbose", "1");
      }

      fetch(`/x/send.cgi?${params.toString()}`)
        .then((res) => res.json())
        .then(renderTestResult)
        .catch((err) => {
          if (testOutput) testOutput.textContent = `Request failed: ${err}`;
        })
        .finally(() => {
          btn.disabled = false;
        });
    });
  });

  if (saveAllButton) {
    saveAllButton.addEventListener("click", saveAllSettings);
  }

  if (testSpeakerButton) {
    testSpeakerButton.addEventListener("click", testSpeaker);
  }

  loadConfig();
})();
