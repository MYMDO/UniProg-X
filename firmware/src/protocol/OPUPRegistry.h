#pragma once
#include "OPUPDriver.h"

/**
 * @brief Registry for OPUP Drivers.
 *
 * Maps command ranges to specific driver instances.
 * Example: 0x10-0x1F -> I2CDriver
 */
class OPUPRegistry {
public:
  // Register a driver for a specific command range (start inclusive, end
  // inclusive)
  void registerDriver(uint8_t startCmd, uint8_t endCmd, OPUPDriver *driver) {
    // Simple linear search or map is fine for small number of drivers.
    // For efficiency on MCU, we can store in a simple struct array.
    if (driverCount < MAX_DRIVERS) {
      drivers[driverCount++] = {startCmd, endCmd, driver};
    }
  }

  // Find the driver responsible for a command
  OPUPDriver *getDriver(uint8_t cmd) {
    for (int i = 0; i < driverCount; i++) {
      if (cmd >= drivers[i].start && cmd <= drivers[i].end) {
        return drivers[i].driver;
      }
    }
    return nullptr;
  }

  void beginAll() {
    for (int i = 0; i < driverCount; i++) {
      drivers[i].driver->begin();
    }
  }

private:
  struct DriverEntry {
    uint8_t start;
    uint8_t end;
    OPUPDriver *driver;
  };

  static const int MAX_DRIVERS = 10;
  DriverEntry drivers[MAX_DRIVERS];
  int driverCount = 0;
};
