#pragma once
#include <Arduino.h>
#include <Wire.h>

class I2CDriver {
public:
  void begin();
  void scan(uint8_t *found_addresses, uint8_t &count);
  bool read(uint8_t addr, uint16_t len, uint8_t *data);
  bool write(uint8_t addr, uint8_t *data, uint16_t len);
};
