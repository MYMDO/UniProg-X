#pragma once
#include <Arduino.h>
#include <stdint.h>

// QSPI GPIO Pin Definitions
#define QSPI_PIN_CS 17  // Chip Select
#define QSPI_PIN_CLK 18 // Clock
#define QSPI_PIN_IO0 19 // MOSI / IO0
#define QSPI_PIN_IO1 16 // MISO / IO1
#define QSPI_PIN_IO2 21 // /WP / IO2
#define QSPI_PIN_IO3 22 // /HOLD / IO3

/**
 * @brief QSPI Operating Modes
 * Format notation: CMD-ADDR-DATA (number of IO lines used)
 */
enum class QSPIMode : uint8_t {
  STANDARD = 0, // 1-1-1: Standard SPI (default)
  DUAL_OUT = 1, // 1-1-2: Dual output (data on IO0+IO1)
  DUAL_IO = 2,  // 1-2-2: Dual I/O (addr+data on IO0+IO1)
  QUAD_OUT = 3, // 1-1-4: Quad output (data on IO0-IO3)
  QUAD_IO = 4,  // 1-4-4: Quad I/O (addr+data on IO0-IO3)
  QPI = 5       // 4-4-4: Full QPI (cmd+addr+data on IO0-IO3)
};

/**
 * @brief Universal QSPI Driver with bit-banged implementation
 * Supports all standard SPI Flash operating modes including Dual, Quad, and QPI
 */
class QSPIDriver {
public:
  /**
   * @brief Initialize QSPI driver and configure GPIO pins
   */
  QSPIDriver(); // Constructor
  void begin();

  /**
   * @brief Set the current operating mode
   * @param mode QSPIMode enum value
   */
  void setMode(QSPIMode mode);

  /**
   * @brief Get current operating mode
   * @return Current QSPIMode
   */
  QSPIMode getMode() const { return _mode; }

  /**
   * @brief Send command byte (respects current mode)
   * @param cmd Command byte to send
   */
  void sendCommand(uint8_t cmd);

  /**
   * @brief Send address bytes (respects current mode for address phase)
   * @param addr 24-bit or 32-bit address
   * @param len Address length (3 or 4 bytes)
   */
  void sendAddress(uint32_t addr, uint8_t len = 3);

  /**
   * @brief Send dummy clock cycles (for fast read commands)
   * @param cycles Number of dummy cycles
   */
  void sendDummyCycles(uint8_t cycles);

  /**
   * @brief Write data (respects current mode for data phase)
   * @param data Pointer to data buffer
   * @param len Number of bytes to write
   */
  void writeData(const uint8_t *data, uint32_t len);

  /**
   * @brief Read data (respects current mode for data phase)
   * @param data Pointer to receive buffer
   * @param len Number of bytes to read
   */
  void readData(uint8_t *data, uint32_t len);

  /**
   * @brief Full-duplex SPI transfer (standard mode only)
   * @param txData Transmit buffer
   * @param rxData Receive buffer
   * @param len Transfer length
   */
  void transfer(const uint8_t *txData, uint8_t *rxData, uint16_t len);

  /**
   * @brief Assert chip select (active low)
   */
  void csLow();

  /**
   * @brief Deassert chip select
   */
  void csHigh();

  /**
   * @brief Enter QPI mode on the flash chip
   * Sends the standard Enter QPI command (0x38)
   */
  void enterQPI();

  /**
   * @brief Exit QPI mode on the flash chip
   * Sends Exit QPI command (0xFF) in QPI mode
   */
  void exitQPI();

  /**
   * @brief Configure IO2/IO3 for standard SPI (pulled HIGH)
   * This disables /WP and /HOLD functions
   */
  void setStandardMode();

  /**
   * @brief Configure all IOs for multi-wire operation
   */
  void setQuadMode();

private:
  QSPIMode _mode = QSPIMode::STANDARD;
  uint32_t _clockDelay = 0; // For timing control

  // Low-level bit-bang primitives
  void clockPulse();
  void writeBitStandard(uint8_t bit);
  uint8_t readBitStandard();
  void writeNibbleQuad(uint8_t nibble);
  uint8_t readNibbleQuad();
  void writeBitsDual(uint8_t bits);
  uint8_t readBitsDual();

  // Mode-aware byte operations
  void writeByteStandard(uint8_t byte);
  uint8_t readByteStandard();
  void writeByteDual(uint8_t byte);
  uint8_t readByteDual();
  void writeByteQuad(uint8_t byte);
  uint8_t readByteQuad();

  // Configure pin directions
  void setIOsOutput();
  void setIOsInput();
  void setIO01Output();
  void setIO01Input();

  // Pin definitions
  uint8_t csPin;
  uint8_t clkPin;
  uint8_t mosiPin;
  uint8_t misoPin;
};
