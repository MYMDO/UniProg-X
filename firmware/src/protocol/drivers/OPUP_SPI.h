#pragma once
#include "../../spi_driver.h"
#include "../OPUP.h"
#include "../OPUPDriver.h"

class OPUP_SPI : public OPUPDriver {
private:
  SPIDriver &spi;

public:
  OPUP_SPI(SPIDriver &driver) : spi(driver) {}

  void begin() override {
    // SPI initialized in main
  }

  bool handleCommand(uint8_t cmd, uint8_t *payload, uint16_t len,
                     uint8_t *respData, uint16_t &respLen) override {
    switch (cmd) {
    case OpupCmd::SPI_SCAN: {
      // JEDEC Read ID (0x9F)
      uint8_t jedecCmd[4] = {0x9F, 0x00, 0x00, 0x00};
      uint8_t jedecResp[4];

      spi.transfer(0, jedecCmd, 4);
      delay(1);
      spi.transfer(0, jedecResp, 4);

      if (jedecResp[0] != 0x00 && jedecResp[0] != 0xFF) {
        respData[0] = 1;            // Count
        respData[1] = jedecResp[0]; // Mfg
        respData[2] = jedecResp[1]; // Dev High
        respData[3] = jedecResp[2]; // Dev Low
        respLen = 4;
      } else {
        respData[0] = 0;
        respLen = 1;
      }
      return true;
    }
    case OpupCmd::SPI_XFER: {
      // Simultaneous transfer
      memcpy(respData, payload, len);
      spi.transfer(0, respData, len);
      respLen = len;
      return true;
    }
    case OpupCmd::SPI_CONFIG: {
      // TODO: Implement config
      respLen = 0;
      return true;
    }
    default:
      return false;
    }
  }
};
