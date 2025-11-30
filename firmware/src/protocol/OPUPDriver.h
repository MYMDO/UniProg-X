#pragma once
#include <stddef.h>
#include <stdint.h>

/**
 * @brief Abstract Base Class for all OPUP Protocol Drivers.
 *
 * Each subsystem (I2C, SPI, ISP, etc.) must implement this interface.
 * The OPUP Core will route commands to the appropriate driver based on the
 * Command ID.
 */
class OPUPDriver {
public:
  virtual ~OPUPDriver() {}

  /**
   * @brief Initialize the driver (hardware setup, etc.)
   */
  virtual void begin() = 0;

  /**
   * @brief Handle an incoming OPUP command.
   *
   * @param cmd The specific command ID (e.g., I2C_SCAN).
   * @param payload Pointer to the command payload data.
   * @param len Length of the payload.
   * @param respData Pointer to buffer where response data should be written.
   * @param respLen Reference to variable where response length should be
   * written.
   * @return true if command was handled successfully (ACK), false if error
   * (NAK).
   */
  virtual bool handleCommand(uint8_t cmd, uint8_t *payload, uint16_t len,
                             uint8_t *respData, uint16_t &respLen) = 0;
};
