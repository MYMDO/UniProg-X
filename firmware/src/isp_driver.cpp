#include "isp_driver.h"

void ISPDriver::begin() {
  pinMode(PIN_RESET, OUTPUT);
  digitalWrite(PIN_RESET, HIGH); // Default to high (inactive)
}

bool ISPDriver::enterProgrammingMode() {
  // 1. Power up sequence (assumed target is powered)
  // 2. Pull RESET low
  digitalWrite(PIN_RESET, LOW);
  delay(20); // Wait at least 20ms

  // 3. Send Programming Enable command (0xAC, 0x53, 0x00, 0x00)
  SPI.beginTransaction(SPISettings(ISP_CLOCK, MSBFIRST, SPI_MODE0));

  uint8_t response[4];
  response[0] = SPI.transfer(0xAC);
  response[1] = SPI.transfer(0x53);
  response[2] = SPI.transfer(0x00);
  response[3] = SPI.transfer(0x00);

  SPI.endTransaction();

  // Check for sync (byte 3 should be 0x53)
  return (response[2] == 0x53);
}

void ISPDriver::endProgrammingMode() { digitalWrite(PIN_RESET, HIGH); }

uint8_t ISPDriver::transfer(uint8_t data) {
  SPI.beginTransaction(SPISettings(ISP_CLOCK, MSBFIRST, SPI_MODE0));
  uint8_t result = SPI.transfer(data);
  SPI.endTransaction();
  return result;
}

void ISPDriver::transferBlock(uint8_t *cmd, uint8_t *response) {
  SPI.beginTransaction(SPISettings(ISP_CLOCK, MSBFIRST, SPI_MODE0));
  for (int i = 0; i < 4; i++) {
    response[i] = SPI.transfer(cmd[i]);
  }
  SPI.endTransaction();
}
