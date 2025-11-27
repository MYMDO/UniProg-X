export const CMD = {
    // System
    PING: 0x01,
    GET_INFO: 0x02,
    RESET: 0x03,

    // I2C
    I2C_SCAN: 0x10,
    I2C_READ: 0x11,
    I2C_WRITE: 0x12,

    // SPI
    SPI_SCAN: 0x20,
    SPI_CONFIG: 0x21,
    SPI_XFER: 0x22,

    // Error
    ERROR: 0xFF,
} as const;

export const ERROR_CODES = {
    INVALID_CMD: 0x01,
    CRC_ERROR: 0x02,
    TIMEOUT: 0x03,
    NACK: 0x04,
} as const;

export const MAGIC_BYTE = 0xAA;
