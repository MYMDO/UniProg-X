#pragma once
#include "../../qspi_driver.h"
#include "../OPUP.h"
#include "../OPUPDriver.h"

/**
 * @brief OPUP QSPI Driver
 * Handles Quad SPI commands for Serial Flash (W25Qxx, etc.)
 * Supports Standard, Dual, Quad and QPI modes
 */
class OPUP_QSPI : public OPUPDriver {
private:
  QSPIDriver &qspi;

public:
  OPUP_QSPI(QSPIDriver &driver) : qspi(driver) {}

  void begin() override { qspi.begin(); }

  bool handleCommand(uint8_t cmd, uint8_t *payload, uint16_t len,
                     uint8_t *respData, uint16_t &respLen) override {
    switch (cmd) {

    // ============================================
    // 0x25: QSPI_SET_MODE
    // Request: [Mode:1]
    // Response: [CurrentMode:1]
    // ============================================
    case OpupCmd::QSPI_SET_MODE: {
      if (len < 1) {
        respLen = 0;
        return false;
      }

      uint8_t mode = payload[0];
      if (mode > 5) {
        respLen = 0;
        return false; // Invalid mode
      }

      qspi.setMode(static_cast<QSPIMode>(mode));
      respData[0] = static_cast<uint8_t>(qspi.getMode());
      respLen = 1;
      return true;
    }

    // ============================================
    // 0x26: QSPI_READ
    // Request: [Cmd:1][AddrLen:1][Addr:3-4][DummyCycles:1][ReadLen:2]
    // Response: [Data:N]
    // ============================================
    case OpupCmd::QSPI_READ: {
      if (len < 7) {
        respLen = 0;
        return false;
      }

      uint8_t flashCmd = payload[0];
      uint8_t addrLen = payload[1];
      uint32_t addr = 0;

      // Build address (little-endian in payload)
      for (uint8_t i = 0; i < addrLen && i < 4; i++) {
        addr |= ((uint32_t)payload[2 + i] << (i * 8));
      }

      uint8_t dummyCycles = payload[2 + addrLen];
      uint16_t readLen = payload[3 + addrLen] | (payload[4 + addrLen] << 8);

      // Limit read size
      if (readLen > 4096)
        readLen = 4096;

      // Execute read sequence
      qspi.csLow();
      qspi.sendCommand(flashCmd);
      qspi.sendAddress(addr, addrLen);
      qspi.sendDummyCycles(dummyCycles);
      qspi.readData(respData, readLen);
      qspi.csHigh();

      respLen = readLen;
      return true;
    }

    // ============================================
    // 0x27: QSPI_WRITE
    // Request: [Cmd:1][AddrLen:1][Addr:3-4][Data:N]
    // Response: Empty on success
    // ============================================
    case OpupCmd::QSPI_WRITE: {
      if (len < 4) {
        respLen = 0;
        return false;
      }

      uint8_t flashCmd = payload[0];
      uint8_t addrLen = payload[1];
      uint32_t addr = 0;

      // Build address
      for (uint8_t i = 0; i < addrLen && i < 4; i++) {
        addr |= ((uint32_t)payload[2 + i] << (i * 8));
      }

      uint16_t dataOffset = 2 + addrLen;
      uint16_t dataLen = len - dataOffset;

      // Execute write sequence
      qspi.csLow();
      qspi.sendCommand(flashCmd);
      qspi.sendAddress(addr, addrLen);
      qspi.writeData(&payload[dataOffset], dataLen);
      qspi.csHigh();

      respLen = 0;
      return true;
    }

    // ============================================
    // 0x28: QSPI_FAST_READ (Optimized page read)
    // Request: [Addr:3][PageCount:1]
    // Response: [Data:256*PageCount]
    // ============================================
    case OpupCmd::QSPI_FAST_READ: {
      if (len < 4) {
        respLen = 0;
        return false;
      }

      uint32_t addr = payload[0] | (payload[1] << 8) | (payload[2] << 16);
      uint8_t pageCount = payload[3];
      if (pageCount > 16)
        pageCount = 16; // Max 4KB

      uint16_t totalLen = pageCount * 256;

      // Use appropriate fast read command based on mode
      uint8_t fastReadCmd;
      uint8_t dummyCycles;

      switch (qspi.getMode()) {
      case QSPIMode::STANDARD:
        fastReadCmd = 0x0B; // Fast Read
        dummyCycles = 8;
        break;
      case QSPIMode::DUAL_OUT:
        fastReadCmd = 0x3B; // Fast Read Dual Output
        dummyCycles = 8;
        break;
      case QSPIMode::DUAL_IO:
        fastReadCmd = 0xBB; // Fast Read Dual I/O
        dummyCycles = 4;
        break;
      case QSPIMode::QUAD_OUT:
        fastReadCmd = 0x6B; // Fast Read Quad Output
        dummyCycles = 8;
        break;
      case QSPIMode::QUAD_IO:
        fastReadCmd = 0xEB; // Fast Read Quad I/O
        dummyCycles = 6;
        break;
      case QSPIMode::QPI:
        fastReadCmd = 0xEB; // Fast Read in QPI
        dummyCycles = 6;
        break;
      default:
        fastReadCmd = 0x03; // Normal read
        dummyCycles = 0;
      }

      qspi.csLow();
      qspi.sendCommand(fastReadCmd);
      qspi.sendAddress(addr, 3);
      qspi.sendDummyCycles(dummyCycles);
      qspi.readData(respData, totalLen);
      qspi.csHigh();

      respLen = totalLen;
      return true;
    }

    // ============================================
    // 0x29: QSPI_CMD (Raw command execution)
    // Request: [Cmd:1][TxLen:1][TxData:N]
    // Response: [RxData:TxLen] (echoed RX during TX)
    // ============================================
    case OpupCmd::QSPI_CMD: {
      if (len < 2) {
        respLen = 0;
        return false;
      }

      uint8_t flashCmd = payload[0];
      uint8_t txLen = payload[1];

      if (txLen > 64)
        txLen = 64;

      qspi.csLow();
      qspi.sendCommand(flashCmd);

      if (txLen > 0 && len >= 2 + txLen) {
        // Transfer data if provided
        qspi.transfer(&payload[2], respData, txLen);
        respLen = txLen;
      } else if (txLen > 0) {
        // Just read
        qspi.readData(respData, txLen);
        respLen = txLen;
      } else {
        respLen = 0;
      }

      qspi.csHigh();
      return true;
    }

    default:
      return false;
    }
  }
};
