#include "Board.h"
#include "Logger.h"

#include "i2c_driver.h"
#include "isp_driver.h"
#include "led_driver.h"
#include "qspi_driver.h"
#include "spi_driver.h"
#include "swd_driver.h"

#include "protocol/OPUP.h"
#include "protocol/drivers/OPUP_I2C.h"
#include "protocol/drivers/OPUP_ISP.h"
#include "protocol/drivers/OPUP_QSPI.h"
#include "protocol/drivers/OPUP_SPI.h"
#include "protocol/drivers/OPUP_SWD.h"
#include "protocol/drivers/OPUP_System.h"

// Define Trace Tag
#define TAG "MAIN"

// Global Hardware Drivers
I2CDriver i2c;
SPIDriver spi;
QSPIDriver qspi;
ISPDriver isp;
SWDDriver swd;
LEDDriver led;

// Protocol Handler
OPUP opup;

// Protocol Drivers
OPUP_System opup_sys;
OPUP_I2C opup_i2c(i2c);
OPUP_SPI opup_spi(spi);
OPUP_QSPI opup_qspi(qspi);
OPUP_ISP opup_isp(isp);
OPUP_SWD opup_swd(swd);

void setup() {
  // Initialize Logging (Serial)
  LOG_BEGIN(Board::SERIAL_BAUD);
  LOG_WAIT();

  LOG_INFO(TAG, "UniProg-X Booting...");

  // Initialize Board Hardware (Pins, Safe Defaults)
  Board::init();

  // Initialize Status LED subsystem first for visual feedback
  led.begin();
  LOG_INFO(TAG, "LED Driver Initialized");

  // Initialize Communication Drivers
  i2c.begin();
  spi.begin();
  qspi.begin();
  isp.begin();
  // SWD initialized on demand

  LOG_INFO(TAG, "Hardware Drivers Initialized");

  // Register Protocol Drivers
  // System: 0x00 - 0x0F
  opup.registerDriver(0x00, 0x0F, &opup_sys);

  // I2C: 0x10 - 0x1F
  opup.registerDriver(0x10, 0x1F, &opup_i2c);

  // SPI: 0x20 - 0x24 (Standard)
  opup.registerDriver(0x20, 0x24, &opup_spi);

  // QSPI: 0x25 - 0x2F (Extended)
  opup.registerDriver(0x25, 0x2F, &opup_qspi);

  // AVR ISP: 0x30 - 0x3F
  opup.registerDriver(0x30, 0x3F, &opup_isp);

  // STM32 SWD: 0x40 - 0x4F
  opup.registerDriver(0x40, 0x4F, &opup_swd);

  // Start Protocol Handler
  opup.begin();
  LOG_INFO(TAG, "OPUP Protocol Started. Waiting for commands...");
}

void loop() {
  opup.update();
  led.update();
}
