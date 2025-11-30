#pragma once
#include "../../i2c_driver.h"
#include "../OPUP.h"
#include "../OPUPDriver.h"

class OPUP_I2C : public OPUPDriver {
private:
  I2CDriver &i2c;

public:
  OPUP_I2C(I2CDriver &driver) : i2c(driver) {}

  void begin() override {
    // I2C initialized in main
  }

  bool handleCommand(uint8_t cmd, uint8_t *payload, uint16_t len,
                     uint8_t *respData, uint16_t &respLen) override {
    switch (cmd) {
    case OpupCmd::I2C_SCAN: {
      uint8_t count = 0;
      // Scan fills addresses starting at respData[1], count is returned by
      // reference
      i2c.scan(respData + 1, count);
      // First byte of response is the count
      respData[0] = count;
      // Response length is 1 (count byte) + number of addresses found
      respLen = 1 + count;
      return true;
    }
    case OpupCmd::I2C_READ: {
      if (len < 3)
        return false;
      uint8_t addr = payload[0];
      uint16_t readLen = payload[1] | (payload[2] << 8);

      // Safety check
      if (readLen > 4096)
        readLen = 4096;

      i2c.read(addr, readLen, respData);
      respLen = readLen;
      return true;
    }
    case OpupCmd::I2C_WRITE: {
      if (len < 1)
        return false;
      uint8_t addr = payload[0];
      i2c.write(addr, &payload[1], len - 1);
      respLen = 0;
      return true;
    }
    default:
      return false;
    }
  }
};
