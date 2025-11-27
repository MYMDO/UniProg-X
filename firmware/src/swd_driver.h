#ifndef SWD_DRIVER_H
#define SWD_DRIVER_H

#include <Arduino.h>

class SWDDriver {
public:
  void begin();
  uint32_t init(); // Returns IDCODE
  bool readAP(uint8_t ap, uint32_t addr, uint32_t *data);
  bool writeAP(uint8_t ap, uint32_t addr, uint32_t data);

private:
  const uint8_t PIN_SWCLK = 2;
  const uint8_t PIN_SWDIO = 3;

  void sendSequence(uint8_t *seq, uint16_t bits);
  void writeBits(uint32_t data, uint8_t bits);
  uint32_t readBits(uint8_t bits);
  void turnAround();
  bool getAck();
};

#endif
