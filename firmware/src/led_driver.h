#ifndef LED_DRIVER_H
#define LED_DRIVER_H

#include <Arduino.h>
#include <cstdint>

// Pin definitions for YD-RP2040
#define LED_PIN_ACTIVITY 25 // Onboard LED (GP25)
#define LED_PIN_WS2812 23   // WS2812 RGB LED (GP23)

// Status LED states
enum LEDStatus : uint8_t {
  STATUS_IDLE = 0,    // Cyan breathing - waiting for commands
  STATUS_BUSY,        // Yellow solid - processing command
  STATUS_SUCCESS,     // Green flash - command succeeded
  STATUS_ERROR,       // Red flash - command failed
  STATUS_CONNECTED,   // Blue solid - USB connected
  STATUS_DISCONNECTED // Off - USB disconnected
};

// RGB color structure
struct RGBColor {
  uint8_t r, g, b;
};

// Predefined colors (GRB order for WS2812)
namespace Colors {
constexpr RGBColor OFF = {0, 0, 0};
constexpr RGBColor RED = {255, 0, 0};
constexpr RGBColor GREEN = {0, 255, 0};
constexpr RGBColor BLUE = {0, 0, 255};
constexpr RGBColor YELLOW = {255, 255, 0};
constexpr RGBColor CYAN = {0, 255, 255};
constexpr RGBColor MAGENTA = {255, 0, 255};
constexpr RGBColor WHITE = {255, 255, 255};
} // namespace Colors

class LEDDriver {
public:
  LEDDriver();

  // Initialize LED pins
  void begin();

  // Activity LED (GP25) - for data transfer indication
  void setActivity(bool on);
  void activityPulse(); // Quick blink for single byte

  // Status LED (WS2812 on GP23)
  void setStatus(LEDStatus status);
  void setColor(const RGBColor &color);
  void setColor(uint8_t r, uint8_t g, uint8_t b);

  // Call in loop() for animations
  void update();

  // Get current status
  LEDStatus getStatus() const { return currentStatus; }

private:
  LEDStatus currentStatus;
  RGBColor targetColor;
  RGBColor currentColor;

  uint32_t lastUpdate;
  uint32_t animationStep;
  uint8_t flashCount;
  bool flashState;

  // WS2812 bit-banging
  void sendWS2812(const RGBColor &color);
  void sendByte(uint8_t byte);

  // Animation helpers
  void updateBreathing();
  void updateFlash();
  uint8_t breathe(uint8_t value, uint8_t step);
};

// Global LED driver instance (extern declaration)
extern LEDDriver led;

#endif // LED_DRIVER_H
