#include "spi_driver.h"
#include "Board.h"

// RP2040 SPI Pin Definitions are now in Board.h

void SPIDriver::begin() {
  // CRITICAL: Set /WP and /HOLD HIGH first!
  // /HOLD LOW = chip ignores all SPI commands
  // /WP LOW = write protect enabled (OK for reading, but set HIGH anyway)
  pinMode(Board::PIN_QSPI_IO2, OUTPUT);
  pinMode(Board::PIN_QSPI_IO3, OUTPUT);
  digitalWrite(Board::PIN_QSPI_IO2, HIGH); // Disable Write Protect
  digitalWrite(Board::PIN_QSPI_IO3, HIGH); // Disable Hold

  // Initialize CS pin - HIGH (deselected)
  pinMode(Board::PIN_SPI_CS, OUTPUT);
  digitalWrite(Board::PIN_SPI_CS, HIGH);

  // Configure SCK and MOSI as outputs
  pinMode(Board::PIN_SPI_SCK, OUTPUT);
  pinMode(Board::PIN_SPI_MOSI, OUTPUT);
  digitalWrite(Board::PIN_SPI_SCK, LOW); // CPOL = 0
  digitalWrite(Board::PIN_SPI_MOSI, LOW);

  // Configure MISO as input with pullup
  pinMode(Board::PIN_SPI_MISO, INPUT_PULLUP);

  // Now configure hardware SPI
  SPI.setRX(Board::PIN_SPI_MISO); // MISO = GP16
  SPI.setTX(Board::PIN_SPI_MOSI); // MOSI = GP19
  SPI.setSCK(Board::PIN_SPI_SCK); // SCK = GP18
  SPI.begin();

  // Default settings: 1MHz, Mode 0 (CPOL=0, CPHA=0)
  _settings = SPISettings(1000000, MSBFIRST, SPI_MODE0);
}

void SPIDriver::configure(uint32_t freq, uint8_t mode) {
  uint8_t dataMode = SPI_MODE0;
  if (mode == 1)
    dataMode = SPI_MODE1;
  else if (mode == 2)
    dataMode = SPI_MODE2;
  else if (mode == 3)
    dataMode = SPI_MODE3;

  _settings = SPISettings(freq, MSBFIRST, dataMode);
}

void SPIDriver::transfer(uint8_t cs_pin, uint8_t *data, uint16_t len) {
  // Ensure CS pin is configured
  if (cs_pin == 0) {
    cs_pin = Board::PIN_SPI_CS; // Default to GP17 if 0 is passed
  }

  SPI.beginTransaction(_settings);

  pinMode(cs_pin, OUTPUT);
  digitalWrite(cs_pin, LOW);
  delayMicroseconds(5); // Give flash chip time to recognize CS

  // Transfer each byte
  for (uint16_t i = 0; i < len; i++) {
    data[i] = SPI.transfer(data[i]);
  }

  delayMicroseconds(1);
  digitalWrite(cs_pin, HIGH);
  SPI.endTransaction();
}

// Alternative bit-bang transfer for debugging
uint8_t SPIDriver::bitbangTransferByte(uint8_t txByte) {
  uint8_t rxByte = 0;

  for (int i = 7; i >= 0; i--) {
    // Set MOSI
    digitalWrite(Board::PIN_SPI_MOSI, (txByte >> i) & 1);
    delayMicroseconds(1);

    // Clock high
    digitalWrite(Board::PIN_SPI_SCK, HIGH);
    delayMicroseconds(1);

    // Read MISO
    rxByte |= (digitalRead(Board::PIN_SPI_MISO) << i);

    // Clock low
    digitalWrite(Board::PIN_SPI_SCK, LOW);
    delayMicroseconds(1);
  }

  return rxByte;
}

void SPIDriver::bitbangTransfer(uint8_t cs_pin, uint8_t *data, uint16_t len) {
  if (cs_pin == 0) {
    cs_pin = Board::PIN_SPI_CS;
  }

  // Set pins for bit-bang mode
  pinMode(Board::PIN_SPI_MOSI, OUTPUT);
  pinMode(Board::PIN_SPI_SCK, OUTPUT);
  pinMode(Board::PIN_SPI_MISO, INPUT_PULLUP);
  pinMode(cs_pin, OUTPUT);

  digitalWrite(Board::PIN_SPI_SCK, LOW);
  digitalWrite(cs_pin, LOW);
  delayMicroseconds(5);

  for (uint16_t i = 0; i < len; i++) {
    data[i] = bitbangTransferByte(data[i]);
  }

  digitalWrite(cs_pin, HIGH);

  // Restore hardware SPI
  SPI.begin();
}
