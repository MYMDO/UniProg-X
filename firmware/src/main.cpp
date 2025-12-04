#include "i2c_driver.h"
#include "isp_driver.h"
#include "protocol/OPUP.h"
#include "protocol/drivers/OPUP_I2C.h"
#include "protocol/drivers/OPUP_ISP.h"
#include "protocol/drivers/OPUP_QSPI.h"
#include "protocol/drivers/OPUP_SPI.h"
#include "protocol/drivers/OPUP_SWD.h"
#include "protocol/drivers/OPUP_System.h"
#include "qspi_driver.h"
#include "spi_driver.h"
#include "swd_driver.h"
#include <Arduino.h>

// Global Instances
I2CDriver i2c;
SPIDriver spi;
QSPIDriver qspi;
ISPDriver isp;
SWDDriver swd;
OPUP opup;

// Driver Instances
OPUP_System opup_sys;
OPUP_I2C opup_i2c(i2c);
OPUP_SPI opup_spi(spi);
OPUP_QSPI opup_qspi(qspi);
OPUP_ISP opup_isp(isp);
OPUP_SWD opup_swd(swd);

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 2000)
    ; // Wait for USB CDC (max 2s)

  // Initialize Drivers
  i2c.begin();
  spi.begin();
  qspi.begin(); // Initialize QSPI with GPIO21/22 for IO2/IO3
  isp.begin();
  // SWD initialized on demand

  // Register OPUP Drivers
  opup.registerDriver(0x00, 0x0F, &opup_sys);
  opup.registerDriver(0x10, 0x1F, &opup_i2c);
  opup.registerDriver(0x20, 0x24, &opup_spi);  // Standard SPI (0x20-0x24)
  opup.registerDriver(0x25, 0x2F, &opup_qspi); // QSPI commands (0x25-0x2F)
  opup.registerDriver(0x30, 0x3F, &opup_isp);
  opup.registerDriver(0x40, 0x4F, &opup_swd);

  opup.begin();

  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  opup.update();

  // Heartbeat (slow blink = running)
  static uint32_t lastBlink = 0;
  if (millis() - lastBlink > 500) {
    lastBlink = millis();
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
  }
}
