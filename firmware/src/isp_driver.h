#ifndef ISP_DRIVER_H
#define ISP_DRIVER_H

#include <Arduino.h>
#include <SPI.h>

class ISPDriver {
public:
    void begin();
    bool enterProgrammingMode();
    void endProgrammingMode();
    uint8_t transfer(uint8_t data);
    void transferBlock(uint8_t* cmd, uint8_t* response);

private:
    const uint8_t PIN_RESET = 20; // Use GPIO 20 for AVR Reset
    const uint32_t ISP_CLOCK = 100000; // 100kHz for ISP
};

#endif
