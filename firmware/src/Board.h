#pragma once
#include <Arduino.h>

/**
 * @brief UniProg-X Hardware Configuration (RP2040)
 */

namespace Board {

// System
constexpr uint32_t SERIAL_BAUD = 115200;
constexpr uint32_t SERIAL_TIMEOUT_MS = 2000;

// LED Indicators
constexpr uint8_t PIN_LED_ACTIVITY = 25; // Onboard LED
constexpr uint8_t PIN_LED_WS2812 = 23;   // Neopixel Status LED

// I2C Interface (EEPROM)
constexpr uint8_t PIN_I2C_SDA = 4;
constexpr uint8_t PIN_I2C_SCL = 5;

// SPI Interface (Flash / ISP)
constexpr uint8_t PIN_SPI_MISO = 16;
constexpr uint8_t PIN_SPI_CS = 17;
constexpr uint8_t PIN_SPI_SCK = 18;
constexpr uint8_t PIN_SPI_MOSI = 19;

// QSPI Interface (Extended SPI)
// Note: MISO(16) -> IO1, MOSI(19) -> IO0
constexpr uint8_t PIN_QSPI_IO0 = 19;
constexpr uint8_t PIN_QSPI_IO1 = 16;
constexpr uint8_t PIN_QSPI_IO2 = 21; // /WP
constexpr uint8_t PIN_QSPI_IO3 = 22; // /HOLD

// AVR ISP (In-System Programming)
constexpr uint8_t PIN_AVR_RESET = 20;

// STM32 SWD (Serial Wire Debug)
constexpr uint8_t PIN_SWD_CLK = 2;
constexpr uint8_t PIN_SWD_DIO = 3;

/**
 * @brief Initialize all board pins to safe defaults
 */
inline void init() {
  // LEDs
  pinMode(PIN_LED_ACTIVITY, OUTPUT);
  digitalWrite(PIN_LED_ACTIVITY, LOW);

  // QSPI Hold/WP pins - default high (inactive)
  // Note: QSPIDriver will manage these, but safe defaults here
  pinMode(PIN_QSPI_IO2, OUTPUT);
  digitalWrite(PIN_QSPI_IO2, HIGH);

  pinMode(PIN_QSPI_IO3, OUTPUT);
  digitalWrite(PIN_QSPI_IO3, HIGH);
}

} // namespace Board
