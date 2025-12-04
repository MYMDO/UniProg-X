#include "spi_driver.h"

// RP2040 SPI Pin Definitions
#define SPI_PIN_MISO 16 // GP16 = MISO (RX) / IO1
#define SPI_PIN_CS 17   // GP17 = CS (manual control)
#define SPI_PIN_SCK 18  // GP18 = SCK
#define SPI_PIN_MOSI 19 // GP19 = MOSI (TX) / IO0
#define SPI_PIN_IO2 21  // GP21 = /WP (Write Protect) / IO2
#define SPI_PIN_IO3 22  // GP22 = /HOLD (Hold) / IO3

void SPIDriver::begin() {
  // CRITICAL: Set /WP and /HOLD HIGH first!
  // /HOLD LOW = chip ignores all SPI commands
  // /WP LOW = write protect enabled (OK for reading, but set HIGH anyway)
  pinMode(SPI_PIN_IO2, OUTPUT);
  pinMode(SPI_PIN_IO3, OUTPUT);
  digitalWrite(SPI_PIN_IO2, HIGH); // Disable Write Protect
  digitalWrite(SPI_PIN_IO3, HIGH); // Disable Hold

  // Initialize CS pin - HIGH (deselected)
  pinMode(SPI_PIN_CS, OUTPUT);
  digitalWrite(SPI_PIN_CS, HIGH);

  // Configure SCK and MOSI as outputs
  pinMode(SPI_PIN_SCK, OUTPUT);
  pinMode(SPI_PIN_MOSI, OUTPUT);
  digitalWrite(SPI_PIN_SCK, LOW); // CPOL = 0
  digitalWrite(SPI_PIN_MOSI, LOW);

  // Configure MISO as input with pullup
  pinMode(SPI_PIN_MISO, INPUT_PULLUP);

  // Now configure hardware SPI
  SPI.setRX(SPI_PIN_MISO); // MISO = GP16
  SPI.setTX(SPI_PIN_MOSI); // MOSI = GP19
  SPI.setSCK(SPI_PIN_SCK); // SCK = GP18
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
    cs_pin = SPI_PIN_CS; // Default to GP17 if 0 is passed
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
    digitalWrite(SPI_PIN_MOSI, (txByte >> i) & 1);
    delayMicroseconds(1);

    // Clock high
    digitalWrite(SPI_PIN_SCK, HIGH);
    delayMicroseconds(1);

    // Read MISO
    rxByte |= (digitalRead(SPI_PIN_MISO) << i);

    // Clock low
    digitalWrite(SPI_PIN_SCK, LOW);
    delayMicroseconds(1);
  }

  return rxByte;
}

void SPIDriver::bitbangTransfer(uint8_t cs_pin, uint8_t *data, uint16_t len) {
  if (cs_pin == 0) {
    cs_pin = SPI_PIN_CS;
  }

  // Set pins for bit-bang mode
  pinMode(SPI_PIN_MOSI, OUTPUT);
  pinMode(SPI_PIN_SCK, OUTPUT);
  pinMode(SPI_PIN_MISO, INPUT_PULLUP);
  pinMode(cs_pin, OUTPUT);

  digitalWrite(SPI_PIN_SCK, LOW);
  digitalWrite(cs_pin, LOW);
  delayMicroseconds(5);

  for (uint16_t i = 0; i < len; i++) {
    data[i] = bitbangTransferByte(data[i]);
  }

  digitalWrite(cs_pin, HIGH);

  // Restore hardware SPI
  SPI.begin();
}
