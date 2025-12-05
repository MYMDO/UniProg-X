#include "led_driver.h"

// Global instance is defined in main.cpp

LEDDriver::LEDDriver()
    : currentStatus(STATUS_DISCONNECTED), targetColor(Colors::OFF),
      currentColor(Colors::OFF), lastUpdate(0), animationStep(0), flashCount(0),
      flashState(false) {}

void LEDDriver::begin() {
  // Activity LED
  pinMode(LED_PIN_ACTIVITY, OUTPUT);
  digitalWrite(LED_PIN_ACTIVITY, LOW);

  // WS2812 data pin
  pinMode(LED_PIN_WS2812, OUTPUT);
  digitalWrite(LED_PIN_WS2812, LOW);

  // Initial state: connected
  setStatus(STATUS_CONNECTED);
}

void LEDDriver::setActivity(bool on) {
  digitalWrite(LED_PIN_ACTIVITY, on ? HIGH : LOW);
}

void LEDDriver::activityPulse() {
  // Quick pulse for single byte transfers
  digitalWrite(LED_PIN_ACTIVITY, HIGH);
  delayMicroseconds(10);
  digitalWrite(LED_PIN_ACTIVITY, LOW);
}

void LEDDriver::setStatus(LEDStatus status) {
  if (currentStatus == status)
    return;

  currentStatus = status;
  animationStep = 0;
  flashCount = 0;
  flashState = true;
  lastUpdate = millis();

  switch (status) {
  case STATUS_IDLE:
    targetColor = Colors::CYAN;
    break;
  case STATUS_BUSY:
    targetColor = Colors::YELLOW;
    sendWS2812(targetColor);
    break;
  case STATUS_SUCCESS:
    targetColor = Colors::GREEN;
    flashCount = 2;
    break;
  case STATUS_ERROR:
    targetColor = Colors::RED;
    flashCount = 3;
    break;
  case STATUS_CONNECTED:
    targetColor = Colors::BLUE;
    sendWS2812(targetColor);
    break;
  case STATUS_DISCONNECTED:
    targetColor = Colors::OFF;
    sendWS2812(Colors::OFF);
    break;
  }
}

void LEDDriver::setColor(const RGBColor &color) {
  targetColor = color;
  sendWS2812(color);
}

void LEDDriver::setColor(uint8_t r, uint8_t g, uint8_t b) {
  setColor({r, g, b});
}

void LEDDriver::update() {
  uint32_t now = millis();

  switch (currentStatus) {
  case STATUS_IDLE:
    // Breathing animation (50ms steps)
    if (now - lastUpdate >= 50) {
      lastUpdate = now;
      updateBreathing();
    }
    break;

  case STATUS_SUCCESS:
  case STATUS_ERROR:
    // Flash animation (150ms per flash)
    if (now - lastUpdate >= 150) {
      lastUpdate = now;
      updateFlash();
    }
    break;

  case STATUS_BUSY:
  case STATUS_CONNECTED:
  case STATUS_DISCONNECTED:
    // Static - no animation needed
    break;
  }
}

void LEDDriver::updateBreathing() {
  animationStep = (animationStep + 1) % 64;

  // Sine-like breathing curve
  uint8_t brightness;
  if (animationStep < 32) {
    brightness = animationStep * 8; // Fade in
  } else {
    brightness = (63 - animationStep) * 8; // Fade out
  }

  // Apply brightness to target color
  RGBColor breathed = {(uint8_t)((targetColor.r * brightness) / 255),
                       (uint8_t)((targetColor.g * brightness) / 255),
                       (uint8_t)((targetColor.b * brightness) / 255)};

  sendWS2812(breathed);
}

void LEDDriver::updateFlash() {
  if (flashCount == 0) {
    // Done flashing, return to idle
    setStatus(STATUS_IDLE);
    return;
  }

  if (flashState) {
    sendWS2812(targetColor);
  } else {
    sendWS2812(Colors::OFF);
    flashCount--;
  }
  flashState = !flashState;
}

// WS2812 bit-banging implementation
// Timing: 0 = 400ns high, 850ns low | 1 = 800ns high, 450ns low
void LEDDriver::sendWS2812(const RGBColor &color) {
  // WS2812 expects GRB order
  noInterrupts();
  sendByte(color.g);
  sendByte(color.r);
  sendByte(color.b);
  interrupts();

  // Reset pulse (>50us low)
  delayMicroseconds(60);
}

void LEDDriver::sendByte(uint8_t byte) {
  // RP2040 runs at 125MHz, so timing needs adjustment
  // Using inline assembly or precise delays

  for (int8_t bit = 7; bit >= 0; bit--) {
    if (byte & (1 << bit)) {
      // Send "1": ~800ns high, ~450ns low
      gpio_put(LED_PIN_WS2812, 1);
      // ~100 cycles at 125MHz = 800ns
      asm volatile(
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n");
      gpio_put(LED_PIN_WS2812, 0);
      // ~56 cycles at 125MHz = 450ns
      asm volatile("nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n");
    } else {
      // Send "0": ~400ns high, ~850ns low
      gpio_put(LED_PIN_WS2812, 1);
      // ~50 cycles at 125MHz = 400ns
      asm volatile(
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
          "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n");
      gpio_put(LED_PIN_WS2812, 0);
      // ~106 cycles at 125MHz = 850ns
      asm volatile("nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n nop\n"
                   "nop\n nop\n nop\n nop\n nop\n nop\n");
    }
  }
}
