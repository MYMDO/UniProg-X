#pragma once
#include "../../spi_driver.h"
#include "../OPUP.h"
#include "../OPUPDriver.h"

// SPI CS Pin
#define SPI_CS_PIN 17

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
      // JEDEC Read ID (0x9F) - use bit-bang for reliability
      uint8_t jedecData[4] = {0x9F, 0x00, 0x00, 0x00};

      // Use bit-bang transfer for maximum compatibility
      spi.bitbangTransfer(SPI_CS_PIN, jedecData, 4);

      // After transfer, jedecData contains:
      // [0] = garbage (MISO during command byte)
      // [1] = Manufacturer ID (e.g., 0xEF = Winbond)
      // [2] = Memory Type
      // [3] = Capacity

      if (jedecData[1] != 0x00 && jedecData[1] != 0xFF) {
        respData[0] = 1;            // Count = 1 chip found
        respData[1] = jedecData[1]; // Mfg ID
        respData[2] = jedecData[2]; // Device ID High
        respData[3] = jedecData[3]; // Device ID Low
        respLen = 4;
      } else {
        // Return raw data for debugging
        respData[0] = 0;            // No valid chip
        respData[1] = jedecData[0]; // Debug: raw byte 0
        respData[2] = jedecData[1]; // Debug: raw byte 1
        respData[3] = jedecData[2]; // Debug: raw byte 2
        respData[4] = jedecData[3]; // Debug: raw byte 3
        respLen = 5;
      }
      return true;
    }
    case OpupCmd::SPI_XFER: {
      // Copy payload to response buffer
      memcpy(respData, payload, len);
      // Use hardware SPI with correct CS pin
      spi.transfer(SPI_CS_PIN, respData, len);
      respLen = len;
      return true;
    }
    case OpupCmd::SPI_CONFIG: {
      // Configure SPI speed and mode
      if (len >= 5) {
        uint8_t mode = payload[0];
        uint32_t freq = payload[1] | (payload[2] << 8) | (payload[3] << 16) |
                        (payload[4] << 24);
        spi.configure(freq, mode);
        respData[0] = 1; // Success
        respLen = 1;
      } else {
        respData[0] = 0; // Error
        respLen = 1;
      }
      return true;
    }
    default:
      return false;
    }
  }
};
