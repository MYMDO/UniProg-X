#include "qspi_driver.h"
#include "Board.h"
#include "Logger.h"

// Define Trace Tag
#define TAG "QSPI"

#include <Arduino.h>
#include <hardware/gpio.h>
#include <hardware/sync.h>

// Inline delay for clock timing (can be adjusted for speed)
#define QSPI_CLOCK_DELAY() delayMicroseconds(0)

QSPIDriver::QSPIDriver()
    : _mode(QSPIMode::STANDARD), csPin(Board::PIN_SPI_CS),
      clkPin(Board::PIN_SPI_SCK), mosiPin(Board::PIN_SPI_MOSI),
      misoPin(Board::PIN_SPI_MISO) {}

void QSPIDriver::begin() {
  LOG_INFO(TAG, "Initializing QSPI Driver");

  // Initialize standard SPI pins
  pinMode(csPin, OUTPUT);
  digitalWrite(csPin, HIGH);

  pinMode(clkPin, OUTPUT);
  digitalWrite(clkPin, LOW);

  // Note: MOSI/MISO are handled dynamically based on mode

  // Ensure WP/HOLD (IO2/IO3) are inactive by default
  pinMode(Board::PIN_QSPI_IO2, OUTPUT);
  digitalWrite(Board::PIN_QSPI_IO2, HIGH);

  pinMode(Board::PIN_QSPI_IO3, OUTPUT);
  digitalWrite(Board::PIN_QSPI_IO3, HIGH);
}

void QSPIDriver::setMode(QSPIMode mode) {
  _mode = mode;

  if (mode == QSPIMode::STANDARD || mode == QSPIMode::DUAL_OUT ||
      mode == QSPIMode::DUAL_IO) {
    // Standard and Dual modes: IO2/IO3 should be HIGH (disable WP/HOLD)
    setStandardMode();
  } else {
    // Quad and QPI modes: All IOs active
    setQuadMode();
  }
}

void QSPIDriver::setStandardMode() {
  // IO0 = output (MOSI), IO1 = input (MISO)
  pinMode(QSPI_PIN_IO0, OUTPUT);
  pinMode(QSPI_PIN_IO1, INPUT);

  // IO2 and IO3 pulled HIGH to disable /WP and /HOLD
  pinMode(QSPI_PIN_IO2, OUTPUT);
  pinMode(QSPI_PIN_IO3, OUTPUT);
  digitalWrite(QSPI_PIN_IO2, HIGH);
  digitalWrite(QSPI_PIN_IO3, HIGH);
}

void QSPIDriver::setQuadMode() {
  // All IOs initially as outputs for sending
  pinMode(QSPI_PIN_IO0, OUTPUT);
  pinMode(QSPI_PIN_IO1, OUTPUT);
  pinMode(QSPI_PIN_IO2, OUTPUT);
  pinMode(QSPI_PIN_IO3, OUTPUT);
}

void QSPIDriver::setIOsOutput() {
  pinMode(QSPI_PIN_IO0, OUTPUT);
  pinMode(QSPI_PIN_IO1, OUTPUT);
  pinMode(QSPI_PIN_IO2, OUTPUT);
  pinMode(QSPI_PIN_IO3, OUTPUT);
}

void QSPIDriver::setIOsInput() {
  pinMode(QSPI_PIN_IO0, INPUT);
  pinMode(QSPI_PIN_IO1, INPUT);
  pinMode(QSPI_PIN_IO2, INPUT);
  pinMode(QSPI_PIN_IO3, INPUT);
}

void QSPIDriver::setIO01Output() {
  pinMode(QSPI_PIN_IO0, OUTPUT);
  pinMode(QSPI_PIN_IO1, OUTPUT);
}

void QSPIDriver::setIO01Input() {
  pinMode(QSPI_PIN_IO0, INPUT);
  pinMode(QSPI_PIN_IO1, INPUT);
}

void QSPIDriver::csLow() { digitalWrite(QSPI_PIN_CS, LOW); }

void QSPIDriver::csHigh() { digitalWrite(QSPI_PIN_CS, HIGH); }

void QSPIDriver::clockPulse() {
  QSPI_CLOCK_DELAY();
  digitalWrite(QSPI_PIN_CLK, HIGH);
  QSPI_CLOCK_DELAY();
  digitalWrite(QSPI_PIN_CLK, LOW);
}

// ============== STANDARD SPI (1-bit) ==============

void QSPIDriver::writeBitStandard(uint8_t bit) {
  digitalWrite(QSPI_PIN_IO0, bit ? HIGH : LOW);
  clockPulse();
}

uint8_t QSPIDriver::readBitStandard() {
  uint8_t bit;
  QSPI_CLOCK_DELAY();
  digitalWrite(QSPI_PIN_CLK, HIGH);
  bit = digitalRead(QSPI_PIN_IO1);
  QSPI_CLOCK_DELAY();
  digitalWrite(QSPI_PIN_CLK, LOW);
  return bit;
}

void QSPIDriver::writeByteStandard(uint8_t byte) {
  pinMode(QSPI_PIN_IO0, OUTPUT);
  for (int i = 7; i >= 0; i--) {
    writeBitStandard((byte >> i) & 1);
  }
}

uint8_t QSPIDriver::readByteStandard() {
  uint8_t byte = 0;
  for (int i = 7; i >= 0; i--) {
    byte |= (readBitStandard() << i);
  }
  return byte;
}

// ============== DUAL SPI (2-bit) ==============

void QSPIDriver::writeBitsDual(uint8_t bits) {
  // bits: 2 bits, IO0=b0, IO1=b1
  digitalWrite(QSPI_PIN_IO0, (bits & 0x01) ? HIGH : LOW);
  digitalWrite(QSPI_PIN_IO1, (bits & 0x02) ? HIGH : LOW);
  clockPulse();
}

uint8_t QSPIDriver::readBitsDual() {
  uint8_t bits;
  QSPI_CLOCK_DELAY();
  digitalWrite(QSPI_PIN_CLK, HIGH);
  bits = (digitalRead(QSPI_PIN_IO0) ? 0x01 : 0) |
         (digitalRead(QSPI_PIN_IO1) ? 0x02 : 0);
  QSPI_CLOCK_DELAY();
  digitalWrite(QSPI_PIN_CLK, LOW);
  return bits;
}

void QSPIDriver::writeByteDual(uint8_t byte) {
  // Send MSB first, 2 bits per clock
  setIO01Output();
  writeBitsDual((byte >> 6) & 0x03);
  writeBitsDual((byte >> 4) & 0x03);
  writeBitsDual((byte >> 2) & 0x03);
  writeBitsDual(byte & 0x03);
}

uint8_t QSPIDriver::readByteDual() {
  uint8_t byte = 0;
  setIO01Input();
  byte |= (readBitsDual() << 6);
  byte |= (readBitsDual() << 4);
  byte |= (readBitsDual() << 2);
  byte |= readBitsDual();
  return byte;
}

// ============== QUAD SPI (4-bit) ==============

void QSPIDriver::writeNibbleQuad(uint8_t nibble) {
  // nibble: 4 bits, IO0=b0, IO1=b1, IO2=b2, IO3=b3
  digitalWrite(QSPI_PIN_IO0, (nibble & 0x01) ? HIGH : LOW);
  digitalWrite(QSPI_PIN_IO1, (nibble & 0x02) ? HIGH : LOW);
  digitalWrite(QSPI_PIN_IO2, (nibble & 0x04) ? HIGH : LOW);
  digitalWrite(QSPI_PIN_IO3, (nibble & 0x08) ? HIGH : LOW);
  clockPulse();
}

uint8_t QSPIDriver::readNibbleQuad() {
  uint8_t nibble;
  QSPI_CLOCK_DELAY();
  digitalWrite(QSPI_PIN_CLK, HIGH);
  nibble = (digitalRead(QSPI_PIN_IO0) ? 0x01 : 0) |
           (digitalRead(QSPI_PIN_IO1) ? 0x02 : 0) |
           (digitalRead(QSPI_PIN_IO2) ? 0x04 : 0) |
           (digitalRead(QSPI_PIN_IO3) ? 0x08 : 0);
  QSPI_CLOCK_DELAY();
  digitalWrite(QSPI_PIN_CLK, LOW);
  return nibble;
}

void QSPIDriver::writeByteQuad(uint8_t byte) {
  // Send MSB nibble first
  setIOsOutput();
  writeNibbleQuad((byte >> 4) & 0x0F);
  writeNibbleQuad(byte & 0x0F);
}

uint8_t QSPIDriver::readByteQuad() {
  uint8_t byte = 0;
  setIOsInput();
  byte |= (readNibbleQuad() << 4);
  byte |= readNibbleQuad();
  return byte;
}

// ============== HIGH-LEVEL API ==============

void QSPIDriver::sendCommand(uint8_t cmd) {
  if (_mode == QSPIMode::QPI) {
    // In QPI mode, command is sent on 4 wires
    writeByteQuad(cmd);
  } else {
    // All other modes: command on single wire
    writeByteStandard(cmd);
  }
}

void QSPIDriver::sendAddress(uint32_t addr, uint8_t len) {
  switch (_mode) {
  case QSPIMode::STANDARD:
  case QSPIMode::DUAL_OUT:
  case QSPIMode::QUAD_OUT:
    // Address on single wire
    if (len >= 4)
      writeByteStandard((addr >> 24) & 0xFF);
    writeByteStandard((addr >> 16) & 0xFF);
    writeByteStandard((addr >> 8) & 0xFF);
    writeByteStandard(addr & 0xFF);
    break;

  case QSPIMode::DUAL_IO:
    // Address on 2 wires
    if (len >= 4)
      writeByteDual((addr >> 24) & 0xFF);
    writeByteDual((addr >> 16) & 0xFF);
    writeByteDual((addr >> 8) & 0xFF);
    writeByteDual(addr & 0xFF);
    break;

  case QSPIMode::QUAD_IO:
  case QSPIMode::QPI:
    // Address on 4 wires
    if (len >= 4)
      writeByteQuad((addr >> 24) & 0xFF);
    writeByteQuad((addr >> 16) & 0xFF);
    writeByteQuad((addr >> 8) & 0xFF);
    writeByteQuad(addr & 0xFF);
    break;
  }
}

void QSPIDriver::sendDummyCycles(uint8_t cycles) {
  setIOsInput(); // Tri-state during dummy cycles
  for (uint8_t i = 0; i < cycles; i++) {
    clockPulse();
  }
}

void QSPIDriver::writeData(const uint8_t *data, uint32_t len) {
  switch (_mode) {
  case QSPIMode::STANDARD:
    for (uint32_t i = 0; i < len; i++) {
      writeByteStandard(data[i]);
    }
    break;

  case QSPIMode::DUAL_OUT:
  case QSPIMode::DUAL_IO:
    for (uint32_t i = 0; i < len; i++) {
      writeByteDual(data[i]);
    }
    break;

  case QSPIMode::QUAD_OUT:
  case QSPIMode::QUAD_IO:
  case QSPIMode::QPI:
    for (uint32_t i = 0; i < len; i++) {
      writeByteQuad(data[i]);
    }
    break;
  }
}

void QSPIDriver::readData(uint8_t *data, uint32_t len) {
  switch (_mode) {
  case QSPIMode::STANDARD:
    for (uint32_t i = 0; i < len; i++) {
      data[i] = readByteStandard();
    }
    break;

  case QSPIMode::DUAL_OUT:
  case QSPIMode::DUAL_IO:
    for (uint32_t i = 0; i < len; i++) {
      data[i] = readByteDual();
    }
    break;

  case QSPIMode::QUAD_OUT:
  case QSPIMode::QUAD_IO:
  case QSPIMode::QPI:
    for (uint32_t i = 0; i < len; i++) {
      data[i] = readByteQuad();
    }
    break;
  }
}

void QSPIDriver::transfer(const uint8_t *txData, uint8_t *rxData,
                          uint16_t len) {
  // Full-duplex transfer only in standard mode
  pinMode(QSPI_PIN_IO0, OUTPUT);
  pinMode(QSPI_PIN_IO1, INPUT);

  for (uint16_t i = 0; i < len; i++) {
    uint8_t txByte = txData ? txData[i] : 0xFF;
    uint8_t rxByte = 0;

    for (int b = 7; b >= 0; b--) {
      digitalWrite(QSPI_PIN_IO0, (txByte >> b) & 1);
      QSPI_CLOCK_DELAY();
      digitalWrite(QSPI_PIN_CLK, HIGH);
      rxByte |= (digitalRead(QSPI_PIN_IO1) << b);
      QSPI_CLOCK_DELAY();
      digitalWrite(QSPI_PIN_CLK, LOW);
    }

    if (rxData) {
      rxData[i] = rxByte;
    }
  }
}

void QSPIDriver::enterQPI() {
  // Standard command to enter QPI mode (0x38)
  // Must be sent in standard SPI mode
  QSPIMode prevMode = _mode;
  setMode(QSPIMode::STANDARD);

  csLow();
  sendCommand(0x38); // Enter QPI command
  csHigh();

  // Now switch driver to QPI mode
  setMode(QSPIMode::QPI);
}

void QSPIDriver::exitQPI() {
  // Must be sent in QPI mode
  setMode(QSPIMode::QPI);

  csLow();
  sendCommand(0xFF); // Exit QPI command
  csHigh();

  // Switch back to standard mode
  setMode(QSPIMode::STANDARD);
}
