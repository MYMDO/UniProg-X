# UniProg-X Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **OPUP Protocol v1.0**: Complete implementation of OpenProg Universal Protocol
  - CRC32 checksums for data integrity
  - Sequence number tracking for request/response matching
  - Modular driver architecture
  - Support for I2C, SPI, ISP, SWD protocols
- **Web Client**: Modern React-based interface with TypeScript
  - `OPUPClient` class for protocol handling
  - `WebSerialTransport` for Web Serial API integration
  - Virtualized hex editor for large files
  - AVR fuse bit editor with presets
  - STM32 option bytes viewer
  - Real-time console logging

### Changed
- **Protocol Migration**: Replaced legacy protocol (0xAA magic + CRC8) with OPUP
- **Client Architecture**: Migrated from direct serial communication to OPUP client
- **I2C_SCAN Response Format**: Fixed to return `[count, addr1, addr2, ...]` format

### Fixed
- **I2C_SCAN Response (2025-01-30)**: Firmware now returns count as first byte, then addresses
  - Before: Returned only addresses with `respLen = count`
  - After: Returns `respData[0] = count`, then addresses at `respData[1...]` with `respLen = 1 + count`
- **Multiple OPUPClient Instances (2025-01-30)**: Web client now uses `useState` lazy initializer
  - Prevents React from creating multiple client instances on re-renders
  - Ensures single client instance throughout app lifecycle
- **Response Payload Access**: Fixed all response accesses to use `response.payload[i]` instead of `response[i]`

## [1.0.0] - 2025-01-15

### Initial Release
- Basic I2C EEPROM support (24CXX series)
- Basic SPI Flash support (W25QXX series)  
- AVR ISP programming (ATmega328P, ATtiny85)
- STM32 SWD support (STM32F103)
- Web-based interface
- RP2040 firmware with PlatformIO build system

---

## Version Numbering

- **Major**: Breaking protocol or API changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, documentation updates
