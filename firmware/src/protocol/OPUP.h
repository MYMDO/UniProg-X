#ifndef OPUP_H
#define OPUP_H

#include "OPUPRegistry.h"
#include <Arduino.h>
#include <cstdint>
#include <vector>

// Protocol Constants
#define OPUP_SOF 0xA5
#define OPUP_MAX_PAYLOAD 4096

// Flags
#define OPUP_FLAG_RESP 0x01
#define OPUP_FLAG_ERROR 0x02
#define OPUP_FLAG_ASYNC 0x04

// Commands
enum OpupCmd : uint8_t {
  SYS_PING = 0x01,
  SYS_GET_CAPS = 0x02,
  SYS_GET_STATUS = 0x03,
  SYS_RESET = 0x04,

  I2C_SCAN = 0x10,
  I2C_READ = 0x11,
  I2C_WRITE = 0x12,

  SPI_SCAN = 0x20,
  SPI_CONFIG = 0x21,
  SPI_XFER = 0x22,

  // QSPI Commands (Quad SPI modes)
  QSPI_SET_MODE = 0x25,  // Set QSPI mode (0-5)
  QSPI_READ = 0x26,      // Read with current mode
  QSPI_WRITE = 0x27,     // Write with current mode
  QSPI_FAST_READ = 0x28, // Fast page read
  QSPI_CMD = 0x29,       // Raw command execution

  ISP_ENTER = 0x30,
  ISP_XFER = 0x31,
  ISP_EXIT = 0x32,

  SWD_INIT = 0x40,
  SWD_READ = 0x41,
  SWD_WRITE = 0x42,

  BOOTLOADER = 0x50
};

struct OpupPacket {
  uint8_t seq;
  uint8_t cmd;
  uint8_t flags;
  uint16_t len;
  uint8_t *data;
};

class OPUP {
public:
  OPUP();
  void begin();
  void update();

  // Send a response packet
  void sendResponse(uint8_t cmd, uint8_t seq, uint8_t *data, uint16_t len,
                    bool error = false);
  void sendError(uint8_t seq, uint8_t errorCode, const char *msg = nullptr);

  // Registry
  void registerDriver(uint8_t startCmd, uint8_t endCmd, OPUPDriver *driver);

private:
  // Parsing state
  enum State { WAIT_SOF, WAIT_HEADER, WAIT_DATA, WAIT_CRC };

  State state;
  uint8_t rxBuffer[OPUP_MAX_PAYLOAD + 16]; // + header/crc
  uint16_t rxIndex;
  uint16_t payloadLen;

  // Header fields
  uint8_t currentSeq;
  uint8_t currentCmd;
  uint8_t currentFlags;

  OPUPRegistry registry;

  void processPacket();
  uint32_t calculateCRC32(const uint8_t *data, size_t len);
};

#endif
