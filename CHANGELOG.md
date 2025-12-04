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
- **QSPI Support (2025-12-04)**: Full Quad SPI implementation
  - GPIO21 = IO2 (/WP), GPIO22 = IO3 (/HOLD)
  - All 6 modes: Standard, Dual Out/IO, Quad Out/IO, QPI
  - New OPUP commands: 0x25-0x29 (QSPI_SET_MODE, READ, WRITE, FAST_READ, CMD)
- **CLI Tool (2025-12-04)**: Python command-line interface (`cli/uniprog.py`)
  - ping, status, i2c-scan, spi-scan, spi-raw, qspi-mode, gpio-test
  - Debugging and testing without web browser
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
- **SPI Flash Detection (2025-12-04)**: Bit-bang SPI implementation for RP2040
  - Standard Arduino SPI library had issues with RP2040
  - Implemented software SPI (bit-bang) for maximum compatibility
  - Tested with Winbond W25Q80 (0xEF 0x4014) - working!
- **SPI_XFER CS Pin**: Fixed CS pin parameter (was passing 0 instead of 17)
- **MISO Input Mode**: Added INPUT_PULLUP for proper MISO reading
- **I2C_SCAN Response (2025-01-30)**: Firmware now returns count as first byte
- **Multiple OPUPClient Instances (2025-01-30)**: Web client uses `useState` lazy initializer
- **Response Payload Access**: Fixed all response accesses to use `response.payload[i]`

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
