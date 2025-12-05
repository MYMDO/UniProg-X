#include "led_driver.h"
#include <Arduino.h>

// Global instance is defined in main.cpp

LEDDriver::LEDDriver()
    : currentStatus(STATUS_DISCONNECTED), targetColor(Colors::OFF),
      breathingColor(Colors::CYAN), currentColor(Colors::OFF), lastUpdate(0),
      animationStep(0), flashCount(0), flashState(false), isFirstStartup(true) {
}

void LEDDriver::begin() {
  // Activity LED
  pinMode(LED_PIN_ACTIVITY, OUTPUT);
  digitalWrite(LED_PIN_ACTIVITY, LOW);

  // WS2812 data pin
  pinMode(LED_PIN_WS2812, OUTPUT);
  digitalWrite(LED_PIN_WS2812, LOW);

  // Initial state: startup (cyan breathing)
  // Force clear first to prevent garbage
  sendWS2812(Colors::OFF);
  setStatus(STATUS_STARTUP);
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

  // Debug Logging for Status Change
  Serial.print("LED Status: ");
  Serial.println((int)status);

  currentStatus = status;
  animationStep = 0;
  flashCount = 0;
  flashState = true;
  lastUpdate = millis();

  switch (status) {
  case STATUS_STARTUP:
    // First startup - cyan breathing
    targetColor = Colors::CYAN;
    breathingColor = Colors::CYAN;
    // Start immediately dim
    {
      RGBColor start = {(uint8_t)((targetColor.r * 12) / 255),
                        (uint8_t)((targetColor.g * 12) / 255),
                        (uint8_t)((targetColor.b * 12) / 255)};
      sendWS2812(start);
    }
    break;
  case STATUS_IDLE:
    // Continue breathing in current breathingColor
    targetColor = breathingColor;
    break;
  case STATUS_BUSY:
    // First operation started - no longer first startup
    isFirstStartup = false;
    targetColor = Colors::YELLOW;
    // Send full color, let sendWS2812 scale it globally
    sendWS2812(targetColor);
    break;
  case STATUS_SUCCESS:
    targetColor = Colors::GREEN;
    breathingColor = Colors::GREEN;
    flashCount = 0;
    // Start breathing immediately from low brightness (switched to 12 to
    // survive /4 scaling)
    animationStep = 0;
    {
      RGBColor start = {(uint8_t)((targetColor.r * 12) / 255),
                        (uint8_t)((targetColor.g * 12) / 255),
                        (uint8_t)((targetColor.b * 12) / 255)};
      sendWS2812(start);
    }
    break;
  case STATUS_ERROR:
    targetColor = Colors::RED;
    breathingColor = Colors::RED;
    flashCount = 0;
    // Start breathing immediately from low brightness
    animationStep = 0;
    {
      RGBColor start = {(uint8_t)((targetColor.r * 12) / 255),
                        (uint8_t)((targetColor.g * 12) / 255),
                        (uint8_t)((targetColor.b * 12) / 255)};
      sendWS2812(start);
    }
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
  case STATUS_STARTUP:
  case STATUS_IDLE:
  case STATUS_SUCCESS:
  case STATUS_ERROR:
    // Breathing animation (50ms steps)
    if (now - lastUpdate >= 50) {
      lastUpdate = now;
      updateBreathing();
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
  // We calculate FULL range (0..255) here, and let sendWS2812 scale it down to
  // 25% Min logical brightness = 12 (approx 5% of 255) -> becomes 1.25%
  // physical Max logical brightness = 255 (100% of 255) -> becomes 25% physical
  // Range = 243

  uint32_t stepVal;
  if (animationStep < 32) {
    stepVal = animationStep; // 0 to 31
  } else {
    stepVal = 63 - animationStep; // 31 to 0
  }

  // Linear interpolation: Min + (Step * Range) / MaxSteps
  uint8_t brightness = 12 + (stepVal * 243) / 32;

  // Apply brightness to target color
  RGBColor breathed = {(uint8_t)((targetColor.r * brightness) / 255),
                       (uint8_t)((targetColor.g * brightness) / 255),
                       (uint8_t)((targetColor.b * brightness) / 255)};

  sendWS2812(breathed);
}

void LEDDriver::updateFlash() {
  // Flash logic removed as requested
}

// WS2812 bit-banging implementation
// Timing: 0 = 400ns high, 850ns low | 1 = 800ns high, 450ns low
void LEDDriver::sendWS2812(const RGBColor &color) {
  // Global Brightness Cap: Scale EVERYTHING by 25% (>> 2)
  RGBColor capped = {(uint8_t)(color.r >> 2), (uint8_t)(color.g >> 2),
                     (uint8_t)(color.b >> 2)};

  // Debug Logging for Raw Data
  Serial.print("LED Raw: R=");
  Serial.print(capped.r);
  Serial.print(" G=");
  Serial.print(capped.g);
  Serial.print(" B=");
  Serial.println(capped.b);

  // WS2812 expects GRB order
  noInterrupts();
  sendByte(capped.g);
  sendByte(capped.r);
  sendByte(capped.b);
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
