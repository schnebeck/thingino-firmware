function runMotorCmd(args) {
  return fetch(`/x/json-motor.cgi?${args}`)
    .then((res) => res.json())
    .then(({ message }) => {
      const { xpos, ypos } = message || {};
      if (xpos !== undefined && ypos !== undefined) {
        console.log("Position:" + xpos + "," + ypos);
      }
      return message;
    });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePreviewControlMode(value) {
  return value === "continuous" ? "continuous" : "step";
}

function getPreviewControlMode() {
  const motorParams = window.motorParams || {};
  return normalizePreviewControlMode(motorParams.preview_control_mode);
}

async function ensureMotorParams() {
  if (window.motorParams) {
    return window.motorParams;
  }
  try {
    const response = await fetch("/x/json-motor-params.cgi");
    const motorParams = await response.json();
    window.motorParams = motorParams;
    return motorParams;
  } catch (error) {
    console.error("Failed to load motor parameters:", error);
    window.motorParams = {
      steps_pan: 0,
      steps_tilt: 0,
      pos_0_x: 0,
      pos_0_y: 0,
      preview_control_mode: "step",
    };
    return window.motorParams;
  }
}

async function moveMotor(dir, steps = 100, d = "g") {
  // Use motor parameters loaded from backend
  const motorParams = window.motorParams || {
    steps_pan: 0,
    steps_tilt: 0,
    pos_0_x: 0,
    pos_0_y: 0,
  };
  const x_max = motorParams.steps_pan;
  const y_max = motorParams.steps_tilt;
  const x0 = Number(motorParams.pos_0_x);
  const y0 = Number(motorParams.pos_0_y);
  const step = x_max / steps;
  if (dir === "homing") {
    await runMotorCmd("d=r");
    if (Number.isFinite(x0) && Number.isFinite(y0)) {
      await sleep(800);
      await runMotorCmd("d=x&x=" + x0 + "&y=" + y0);
    }
  } else if (dir === "cc") {
    runMotorCmd("d=x&x=" + x_max / 2 + "&y=" + y_max / 2);
  } else {
    let y = dir.includes("d") ? -step : dir.includes("u") ? step : 0;
    let x = dir.includes("l") ? -step : dir.includes("r") ? step : 0;
    runMotorCmd("d=g&x=" + x + "&y=" + y);
  }
}

// Initialize motor controls when DOM is ready
document.addEventListener("DOMContentLoaded", async function () {
  const uiConfig = window.thinginoUIConfig || {};
  const hasMotors = uiConfig.device && uiConfig.device.motors === true;

  if (!hasMotors) {
    return;
  }
  const motorParams = await ensureMotorParams();

  const motorOverlay = $("#motor-overlay");
  if (motorOverlay) {
    motorOverlay.style.display = "";
  }

  // Boards without a tilt motor (steps_tilt=0, e.g. petcam pan-only rig)
  // get a compact left/home/right bar instead of the 8-way joystick disc.
  // Hide the whole #motor box (not just .jst inside it) so its fixed 300px
  // footprint doesn't leave dead space in #motor-overlay's layout when the
  // pan bar is shown instead.
  const hasTilt = Number(motorParams.steps_tilt) > 0;
  const motorBox = $("#motor");
  const panCtrl = $(".pan-ctrl");
  if (motorBox) motorBox.style.display = hasTilt ? "" : "none";
  if (panCtrl) panCtrl.style.display = hasTilt ? "none" : "";

  let timer;
  const stepMode = getPreviewControlMode() === "step";

  function bindStepControls() {
    $$(".jst a.s, .pan-ctrl .pan-btn[data-dir]").forEach((el) => {
      el.onclick = (ev) => {
        if (ev.detail === 1) {
          // ev.currentTarget is only valid during synchronous dispatch; the
          // browser nulls it out before this setTimeout callback runs, so
          // the element itself (closed over from the forEach) is used instead.
          // timer is shared across all buttons (including home, below) - a
          // stale pending timer from an earlier tap must be cancelled here,
          // otherwise a quick second tap (any button) leaves the first tap's
          // move queued and it still fires afterwards.
          clearTimeout(timer);
          timer = setTimeout(() => {
            moveMotor(el.dataset.dir, 100);
          }, 200);
        }
      };
      el.ondblclick = (ev) => {
        if (ev.detail === 2) {
          clearTimeout(timer);
          moveMotor(el.dataset.dir, 10);
        }
      };
      // Without this, a touch press held just slightly too long is read by
      // mobile browsers as a long-press on the video/image underneath and
      // pops up its native "save image/video" menu instead of registering
      // as a tap here.
      el.addEventListener("contextmenu", (ev) => ev.preventDefault());
    });
  }

  function bindContinuousControls() {
    let holdInterval = null;
    const intervalMs = 90;

    const stopContinuousMove = () => {
      if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
      }
    };

    const startContinuousMove = (dir) => {
      if (!dir) return;
      stopContinuousMove();
      moveMotor(dir, 100);
      holdInterval = setInterval(() => {
        moveMotor(dir, 100);
      }, intervalMs);
    };

    $$(".jst a.s, .pan-ctrl .pan-btn[data-dir]").forEach((el) => {
      const stopHandler = () => stopContinuousMove();
      el.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (el.setPointerCapture && ev.pointerId !== undefined) {
          el.setPointerCapture(ev.pointerId);
        }
        startContinuousMove(el.dataset.dir);
      });
      el.addEventListener("pointerup", stopHandler);
      el.addEventListener("pointerleave", stopHandler);
      el.addEventListener("pointercancel", stopHandler);
      el.addEventListener("lostpointercapture", stopHandler);
      el.addEventListener("contextmenu", (ev) => ev.preventDefault());
    });
  }

  if (stepMode) {
    bindStepControls();
  } else {
    bindContinuousControls();
  }

  $$(".jst a.b, .pan-ctrl .pan-home").forEach((el) => {
    el.onclick = (ev) => {
      if (ev.detail === 1) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          moveMotor("cc");
        }, 200);
      }
    };

    el.ondblclick = (ev) => {
      clearTimeout(timer);
      moveMotor("homing");
    };
  });

  runMotorCmd("d=j");

  // Distance-based fade for #motor-overlay itself is handled centrally in
  // preview.html (shared with #petcam-feed-overlay, since only that page
  // knows about both plugins' overlays at once) - do not duplicate it
  // here, the two independent mousemove listeners fought each other.
});
