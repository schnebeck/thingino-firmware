/* Enable/disable + active-state wiring for the "Audio Alarm" control-bar
 * button (shell built in control-bar.js's createAudioAlarmButton(), gated
 * on device.audio_alarm). Not part of the agent's settings schema like
 * motion is, so this talks straight to json-audio-alarm.cgi instead of
 * going through agentJsonRequest() the way toggleMotion() does.
 */
(function () {
  "use strict";

  const endpoint = "/x/json-audio-alarm.cgi";

  function setActive(button, enabled) {
    if (!button) return;
    button.classList.remove("pending");
    button.classList.toggle("active", !!enabled);
  }

  function loadInitialState() {
    const button = document.getElementById("audio-alarm");
    if (!button) return;
    fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.audio_alarm) setActive(button, data.audio_alarm.enabled);
      })
      .catch(() => {});
  }

  function toggleAudioAlarm(state) {
    const button = document.getElementById("audio-alarm");
    if (button) button.classList.add("pending");

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_alarm: { enabled: state } }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to toggle audio alarm");
        setActive(button, state);
      })
      .catch((err) => {
        console.error("Audio alarm toggle error", err);
        if (button) button.classList.remove("pending");
      });
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadInitialState();
    const button = document.getElementById("audio-alarm");
    if (button) {
      button.addEventListener("click", (ev) => {
        ev.preventDefault();
        toggleAudioAlarm(!button.classList.contains("active"));
      });
    }
  });
})();
