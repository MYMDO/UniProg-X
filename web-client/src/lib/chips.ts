export interface ChipDef {
    name: string;
    type: 'I2C' | 'SPI';
    size: number; // in bytes
    pageSize: number; // in bytes
    address?: number; // I2C address
}

export const CHIP_DB: ChipDef[] = [
    // I2C EEPROMs - 24CXX Series (Atmel/Microchip)
    { name: '24C01', type: 'I2C', size: 128, pageSize: 8, address: 0x50 },
    { name: '24C02', type: 'I2C', size: 256, pageSize: 8, address: 0x50 },
    { name: '24C04', type: 'I2C', size: 512, pageSize: 16, address: 0x50 },
    { name: '24C08', type: 'I2C', size: 1024, pageSize: 16, address: 0x50 },
    { name: '24C16', type: 'I2C', size: 2048, pageSize: 16, address: 0x50 },
    { name: '24C32', type: 'I2C', size: 4096, pageSize: 32, address: 0x50 },
    { name: '24C64', type: 'I2C', size: 8192, pageSize: 32, address: 0x50 },
    { name: '24C128', type: 'I2C', size: 16384, pageSize: 64, address: 0x50 },
    { name: '24C256', type: 'I2C', size: 32768, pageSize: 64, address: 0x50 },
    { name: '24C512', type: 'I2C', size: 65536, pageSize: 128, address: 0x50 },

    // I2C EEPROMs - AT24CXX Series (Atmel)
    { name: 'AT24C01', type: 'I2C', size: 128, pageSize: 8, address: 0x50 },
    { name: 'AT24C02', type: 'I2C', size: 256, pageSize: 8, address: 0x50 },
    { name: 'AT24C04', type: 'I2C', size: 512, pageSize: 16, address: 0x50 },
    { name: 'AT24C08', type: 'I2C', size: 1024, pageSize: 16, address: 0x50 },
    { name: 'AT24C16', type: 'I2C', size: 2048, pageSize: 16, address: 0x50 },
    { name: 'AT24C32', type: 'I2C', size: 4096, pageSize: 32, address: 0x50 },
    { name: 'AT24C64', type: 'I2C', size: 8192, pageSize: 32, address: 0x50 },
    { name: 'AT24C128', type: 'I2C', size: 16384, pageSize: 64, address: 0x50 },
    { name: 'AT24C256', type: 'I2C', size: 32768, pageSize: 64, address: 0x50 },
    { name: 'AT24C512', type: 'I2C', size: 65536, pageSize: 128, address: 0x50 },

    // SPI Flash - Winbond W25QXX Series
    { name: 'W25Q16', type: 'SPI', size: 2 * 1024 * 1024, pageSize: 256 },
    { name: 'W25Q32', type: 'SPI', size: 4 * 1024 * 1024, pageSize: 256 },
    { name: 'W25Q64', type: 'SPI', size: 8 * 1024 * 1024, pageSize: 256 },
    { name: 'W25Q128', type: 'SPI', size: 16 * 1024 * 1024, pageSize: 256 },
    { name: 'W25Q256', type: 'SPI', size: 32 * 1024 * 1024, pageSize: 256 },

    // SPI Flash - Legacy naming
    { name: '25Q16', type: 'SPI', size: 2 * 1024 * 1024, pageSize: 256 },
    { name: '25Q32', type: 'SPI', size: 4 * 1024 * 1024, pageSize: 256 },
    { name: '25Q64', type: 'SPI', size: 8 * 1024 * 1024, pageSize: 256 },
    { name: '25Q128', type: 'SPI', size: 16 * 1024 * 1024, pageSize: 256 },
];
