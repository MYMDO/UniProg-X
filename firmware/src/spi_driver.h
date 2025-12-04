#pragma once
#include <Arduino.h>
#include <SPI.h>
#include <stdint.h>

class SPIDriver {
public:
  void begin();
  void configure(uint32_t freq, uint8_t mode);
  void transfer(uint8_t cs_pin, uint8_t *data, uint16_t len);
  void bitbangTransfer(uint8_t cs_pin, uint8_t *data, uint16_t len);
  uint8_t bitbangTransferByte(uint8_t txByte);

private:
  SPISettings _settings;
};
