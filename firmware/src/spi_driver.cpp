#include "spi_driver.h"

void SPIDriver::begin() { SPI.begin(); }

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
  SPI.beginTransaction(_settings);

  pinMode(cs_pin, OUTPUT);
  digitalWrite(cs_pin, LOW);

  SPI.transfer(data, len);

  digitalWrite(cs_pin, HIGH);
  SPI.endTransaction();
}
