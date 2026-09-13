(function () {
  "use strict";

  const form = $("#emailForm");

  async function loadConfig() {
    await send2Load("Email", (data) => {
      const email = data.email || {};
      $("#email_host").value = email.host || "";
      $("#email_port").value = email.port || "587";
      $("#email_username").value = email.username || "";
      $("#email_password").value = email.password || "";
      const useSsl = email.use_ssl === true || email.use_ssl === "true";
      const startTls = email.starttls === true || email.starttls === "true";
      $("#email_encryption").value = useSsl ? "ssl" : startTls ? "starttls" : "none";
      $("#email_trust_cert").checked =
        email.trust_cert === true || email.trust_cert === "true";
      $("#email_from_name").value = email.from_name || "";
      $("#email_from_address").value = email.from_address || "";
      $("#email_to_name").value = email.to_name || "";
      $("#email_to_address").value = email.to_address || "";
      $("#email_send_photo").checked =
        email.send_photo !== false && email.send_photo !== "false";
      $("#email_send_video").checked =
        email.send_video === true || email.send_video === "true";
      $("#email_subject").value = email.subject || "Motion detected";
      $("#email_body").value = email.body || "";
    });
  }

  if (form) {
    form.addEventListener("submit", (event) =>
      send2Save("Email", form, event, () => {
        const encryption = $("#email_encryption").value;
        return {
          email: {
            host: $("#email_host").value.trim(),
            port: Number($("#email_port").value) || 587,
            username: $("#email_username").value.trim(),
            password: $("#email_password").value.trim(),
            use_ssl: encryption === "ssl",
            starttls: encryption === "starttls",
            trust_cert: $("#email_trust_cert").checked,
            from_name: $("#email_from_name").value.trim(),
            from_address: $("#email_from_address").value.trim(),
            to_name: $("#email_to_name").value.trim(),
            to_address: $("#email_to_address").value.trim(),
            send_photo: $("#email_send_photo").checked,
            send_video: $("#email_send_video").checked,
            subject: $("#email_subject").value.trim(),
            body: $("#email_body").value.trim(),
            enabled: true,
          },
        };
      }),
    );
  }

  const testButton = $("#test-email");
  const testModalEl = $("#email-test-modal");
  const testModal = testModalEl ? new bootstrap.Modal(testModalEl) : null;
  const testOutput = $("#email-test-output");

  if (testButton) {
    testButton.addEventListener("click", () => {
      if (testOutput) testOutput.textContent = "Running...";
      if (testModal) testModal.show();
      testButton.disabled = true;

      fetch(`/x/send.cgi?${new URLSearchParams({ to: "email", verbose: "1" }).toString()}`)
        .then((res) => res.json())
        .then((data) => {
          if (!testOutput) return;
          if (data.error) {
            testOutput.textContent = `Error: ${data.error.message || data.error}`;
            return;
          }
          const msg = data.message;
          if (msg && typeof msg === "object") {
            let text = msg.output_b64 ? decodeBase64String(msg.output_b64) : msg.output || "";
            if (msg.status && msg.status !== "success") text = `[${msg.status}] ${text}`;
            testOutput.textContent = text || "(no output)";
          } else {
            testOutput.textContent = String(msg || "(no output)");
          }
        })
        .catch((err) => {
          if (testOutput) testOutput.textContent = `Request failed: ${err}`;
        })
        .finally(() => {
          testButton.disabled = false;
        });
    });
  }

  send2SetupReload($("#email-reload"), "Email", loadConfig);
  loadConfig();
})();
