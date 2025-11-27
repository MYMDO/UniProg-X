# UniProg-X: Universal Hardware Programmer

UniProg-X is a professional-grade, hyper-scalable, and automated hardware programmer designed for the modern era. Built on the powerful Raspberry Pi Pico (RP2040) and featuring a sleek, web-based interface, it brings hardware programming into the 21st century.

![UniProg-X Interface](https://via.placeholder.com/800x450?text=UniProg-X+Interface)

## 🚀 Features

*   **Universal Support**: Native support for I2C EEPROMs and SPI Flash chips.
*   **Web-First Interface**: No drivers needed. Works directly in Chrome, Edge, and Opera via the Web Serial API.
*   **Auto-Detection**: Smart scanning automatically identifies connected chips (I2C & SPI).
*   **High Performance**: Powered by RP2040's PIO and dual-core architecture for maximum throughput.
*   **Modern UI**: Cyberpunk-themed, responsive interface with glassmorphism and real-time feedback.
*   **Virtualized Hex Editor**: Smoothly handle large binary files with efficient virtualization.
*   **Comprehensive Toolset**: Read, Write, Verify, Erase, and File Management (.bin, .hex, .eep).

## 🛠️ Hardware Setup

UniProg-X runs on a standard **Raspberry Pi Pico** (RP2040).

### Pinout Configuration

| Signal | GPIO Pin | Physical Pin | Description |
| :--- | :--- | :--- | :--- |
| **I2C SDA** | GPIO 4 | Pin 6 | I2C Data |
| **I2C SCL** | GPIO 5 | Pin 7 | I2C Clock |
| **SPI RX** | GPIO 16 | Pin 21 | MISO (Master In Slave Out) |
| **SPI CS** | GPIO 17 | Pin 22 | Chip Select |
| **SPI SCK** | GPIO 18 | Pin 24 | SPI Clock |
| **SPI TX** | GPIO 19 | Pin 25 | MOSI (Master Out Slave In) |
| **GND** | GND | Pin 3, 8, etc. | Ground |
| **3V3** | 3V3(OUT) | Pin 36 | 3.3V Power Supply |

> **Note**: Ensure your target chip operates at 3.3V. For 1.8V or 5V chips, level shifters are required.

## 💾 Supported Chips

### I2C EEPROMs (24CXX / AT24CXX)
*   **Standard**: 24C01, 24C02, 24C04, 24C08, 24C16, 24C32, 24C64, 24C128, 24C256, 24C512
*   **Atmel**: AT24C01 - AT24C512
*   *Auto-detection supported for standard address 0x50*

### SPI Flash (W25QXX)
*   **Winbond**: W25Q16 (2MB), W25Q32 (4MB), W25Q64 (8MB), W25Q128 (16MB), W25Q256 (32MB)
*   **Generic**: Compatible with most standard SPI Flash chips supporting JEDEC ID (0x9F).

## 📦 Installation & Build

### Firmware (RP2040)
1.  Install **PlatformIO** (VS Code extension or CLI).
2.  Navigate to the `firmware/` directory.
3.  Build and upload:
    ```bash
    pio run -t upload
    ```

### Web Client
1.  Install **Node.js** (v16+).
2.  Navigate to the `web-client/` directory.
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```
5.  Open `http://localhost:5173` in a compatible browser.

## 📖 Usage Guide

1.  **Connect**: Plug in your RP2040 and click **"INITIALIZE LINK"** in the web interface. Select the device from the browser prompt.
2.  **Scan**:
    *   Click **"SCAN I2C"** for EEPROMs.
    *   Click **"SCAN SPI"** for Flash chips.
    *   *The system will attempt to auto-select the detected chip.*
3.  **Read**: Click **"READ"** to dump the chip's memory into the Hex Editor.
4.  **Edit/Load**: Modify data directly in the editor or use **"LOAD FILE"** to import a binary.
5.  **Write**: Click **"WRITE"** to program the chip.
6.  **Verify**: Click **"VERIFY"** to ensure data integrity.

## 🤝 Contributing

Contributions are welcome! Please read `protocol.md` to understand the communication standard before submitting PRs.

## 📄 License

MIT License - Copyright (c) 2025 UniProg-X Team
