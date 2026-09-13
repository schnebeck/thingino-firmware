(function () {
  "use strict";

  const api = () => window.thinginoStreamer;
  const mixerEndpoint = "/x/json-audio-mixer.cgi";

  // page field id -> mixer JSON key. Covers everything raptorctl's "rad" can
  // actually apply live; codec and stereo capture have no backing command
  // and stay hidden. See json-audio-mixer.cgi for why this doesn't go
  // through the agent bridge or raptorctl's own config store.
  const MIXER_FIELDS = {
    audio_mic_vol: "mic_volume",
    audio_mic_gain: "mic_gain",
    audio_mic_alc_gain: "mic_alc_gain",
    audio_mic_high_pass_filter: "mic_hpf_enabled",
    audio_mic_noise_suppression: "mic_ns_level",
    audio_mic_agc_enabled: "mic_agc_enabled",
    audio_mic_agc_target_level_dbfs: "mic_agc_target_dbfs",
    audio_mic_agc_compression_gain_db: "mic_agc_compression_db",
    audio_spk_vol: "spk_volume",
    audio_spk_gain: "spk_gain",
  };

  async function loadAudioConfig() {
    const helper = api();
    if (!helper || !helper.preferAgent || !helper.preferAgent()) {
      hideUnsupported();
      return;
    }
    try {
      const mic = await helper.agentRequest("/api/v1/settings/audio/mic-enabled", {
        cache: "no-store",
      });
      const spk = await helper.agentRequest("/api/v1/settings/audio/spk-enabled", {
        cache: "no-store",
      });
      const micEl = $("#audio_mic_enabled");
      const spkEl = $("#audio_spk_enabled");
      if (micEl && mic && typeof mic.mic_enabled !== "undefined") {
        micEl.checked = !!mic.mic_enabled;
      }
      if (spkEl && spk && typeof spk.spk_enabled !== "undefined") {
        spkEl.checked = !!spk.spk_enabled;
      }
    } catch (err) {
      console.warn("audio load failed:", err);
    }
    hideUnsupported();
    loadMixer();
  }

  function unhide(el) {
    el.disabled = false;
    const wrap = el.closest(".number-range, .form-switch, .col") || el.parentElement;
    if (wrap) wrap.classList.remove("d-none");
  }

  async function loadMixer() {
    try {
      const res = await fetch(mixerEndpoint, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load mixer settings");
      const data = await res.json();
      Object.keys(MIXER_FIELDS).forEach((id) => {
        const el = $("#" + id);
        if (!el) return;
        const value = data[MIXER_FIELDS[id]];
        if (typeof value === "undefined") return;
        if (el.type === "checkbox") el.checked = !!value;
        else el.value = value;
        unhide(el);
      });
    } catch (err) {
      console.warn("mixer load failed:", err);
    }
  }

  async function saveMixer(field, value) {
    const res = await fetch(mixerEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) throw new Error("Failed to save " + field);
  }

  function hideUnsupported() {
    // Mic/spk toggles go through the agent; mixer fields (MIXER_FIELDS) go
    // through loadMixer()/saveMixer(). Everything else (codec, stereo
    // capture) has no backing command on this streamer and stays hidden.
    const keep = new Set(["audio_mic_enabled", "audio_spk_enabled", ...Object.keys(MIXER_FIELDS)]);
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!el.id || keep.has(el.id)) return;
      if (!el.id.startsWith("audio_")) return;
      const wrap =
        el.closest(".mb-3, .col, .form-check, .row > div") || el.parentElement;
      if (wrap) wrap.classList.add("d-none");
      el.disabled = true;
    });
  }

  async function saveAudioValue(path, body) {
    const helper = api();
    if (!helper || !helper.agentRequest) {
      throw new Error("Agent unavailable");
    }
    await helper.agentRequest("/api/v1/settings/" + path, {
      method: "PATCH",
      body,
      cache: "no-store",
    });
  }

  function readValue(el) {
    if (el.type === "checkbox") return el.checked;
    const value = parseInt(el.value, 10);
    return isNaN(value) ? null : value;
  }

  function wireMixerField(id) {
    const el = $("#" + id);
    if (!el) return;
    el.addEventListener("change", async () => {
      const value = readValue(el);
      if (value === null) return;
      try {
        await saveMixer(MIXER_FIELDS[id], value);
      } catch (err) {
        console.error(err);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadAudioConfig();
    const micEl = $("#audio_mic_enabled");
    const spkEl = $("#audio_spk_enabled");
    if (micEl) {
      micEl.addEventListener("change", async () => {
        try {
          await saveAudioValue("audio/mic-enabled", {
            mic_enabled: !!micEl.checked,
          });
        } catch (err) {
          console.error(err);
        }
      });
    }
    if (spkEl) {
      spkEl.addEventListener("change", async () => {
        try {
          await saveAudioValue("audio/spk-enabled", {
            spk_enabled: !!spkEl.checked,
          });
        } catch (err) {
          console.error(err);
        }
      });
    }
    Object.keys(MIXER_FIELDS).forEach(wireMixerField);
  });
})();
