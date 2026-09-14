/*
 * gpio-wait - block until a sysfs GPIO's configured edge fires (or a
 * timeout elapses), using poll() instead of a busy-poll sleep loop.
 *
 * Real-world motivation: the treat dispenser's DC motor has a genuine
 * hardware interrupt line for its end-of-travel switch (see
 * dispense-treat-cycle's GPIO_SPARE / vendor name "DCMOTOR-STOP-IRQ",
 * confirmed against the original vendor kernel module's disassembly -
 * a real request_threaded_irq() on this exact pin). Polling it from a
 * shell loop every 20-25ms is a crude approximation with tens-of-ms
 * jitter; sysfs GPIO's edge+poll() mechanism delivers the same kernel
 * interrupt to userspace with real edge-triggered latency.
 *
 * Usage: gpio-wait <pin> <rising|falling|both> <timeout_ms>
 * Exit:  0 = edge occurred, 1 = timed out, 2 = usage/setup error.
 * Prints the GPIO's value after waking, for the caller to log/branch on.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <poll.h>

static void die(const char *msg) {
    fprintf(stderr, "gpio-wait: %s: %s\n", msg, strerror(errno));
    exit(2);
}

static void gpio_setup(int pin, const char *edge) {
    char path[128];
    int fd;

    snprintf(path, sizeof(path), "/sys/class/gpio/gpio%d", pin);
    if (access(path, F_OK) != 0) {
        fd = open("/sys/class/gpio/export", O_WRONLY);
        if (fd < 0) die("cannot open /sys/class/gpio/export");
        char buf[16];
        int n = snprintf(buf, sizeof(buf), "%d", pin);
        if (write(fd, buf, n) < 0 && errno != EBUSY) {
            close(fd);
            die("cannot export gpio");
        }
        close(fd);
    }

    /* Best-effort: the caller (dispense-treat-cycle's setup_gpio_spare)
     * already sets this pin to "in" before we ever run, and on this
     * driver, writing "direction" again while a previous run's edge is
     * still armed on the same pin gets rejected (EINVAL) rather than
     * treated as a no-op. Not fatal - the pin is already an input either
     * way; only die() if opening the file itself fails (a real setup
     * problem, not just a redundant/rejected write). */
    snprintf(path, sizeof(path), "/sys/class/gpio/gpio%d/direction", pin);
    fd = open(path, O_WRONLY);
    if (fd < 0) die("cannot open gpio direction");
    if (write(fd, "in", 2) < 0 && errno != EINVAL)
        die("cannot set gpio direction");
    close(fd);

    snprintf(path, sizeof(path), "/sys/class/gpio/gpio%d/edge", pin);
    fd = open(path, O_WRONLY);
    if (fd < 0) die("cannot open gpio edge (driver may not support interrupts on this pin)");
    if (write(fd, edge, strlen(edge)) < 0) die("cannot set gpio edge");
    close(fd);
}

int main(int argc, char **argv) {
    if (argc != 4) {
        fprintf(stderr, "Usage: %s <pin> <rising|falling|both> <timeout_ms>\n", argv[0]);
        return 2;
    }
    int pin = atoi(argv[1]);
    const char *edge = argv[2];
    int timeout_ms = atoi(argv[3]);
    if (strcmp(edge, "rising") && strcmp(edge, "falling") && strcmp(edge, "both")) {
        fprintf(stderr, "gpio-wait: edge must be rising, falling, or both\n");
        return 2;
    }

    gpio_setup(pin, edge);

    char path[128];
    snprintf(path, sizeof(path), "/sys/class/gpio/gpio%d/value", pin);
    int fd = open(path, O_RDONLY);
    if (fd < 0) die("cannot open gpio value");

    /* Sysfs GPIO poll() convention: an lseek+read is required before the
     * first poll() both to prime the file position for POLLPRI and to
     * drain the always-pending initial "readable" state a fresh open()
     * starts with - without this, poll() returns immediately on the
     * current level rather than waiting for a real edge. */
    char val[8];
    lseek(fd, 0, SEEK_SET);
    read(fd, val, sizeof(val));

    struct pollfd pfd = { .fd = fd, .events = POLLPRI | POLLERR };
    int ret = poll(&pfd, 1, timeout_ms);
    if (ret < 0) die("poll failed");

    lseek(fd, 0, SEEK_SET);
    int n = read(fd, val, sizeof(val) - 1);
    if (n > 0) {
        val[n] = '\0';
        printf("%s", val);
    }
    close(fd);

    /* Leave the pin unarmed so the next run's direction write (see the
     * comment in gpio_setup()) isn't fighting a still-configured edge
     * from this run. Best-effort - already exiting either way. */
    snprintf(path, sizeof(path), "/sys/class/gpio/gpio%d/edge", pin);
    fd = open(path, O_WRONLY);
    if (fd >= 0) {
        if (write(fd, "none", 4) < 0) { /* best effort */ }
        close(fd);
    }

    return ret == 0 ? 1 : 0;
}
