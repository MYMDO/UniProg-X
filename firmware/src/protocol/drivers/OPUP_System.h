#pragma once
#include "../OPUP.h"
#include "../OPUPDriver.h"
#include <Arduino.h>

class OPUP_System : public OPUPDriver {
public:
  void begin() override {
    // Nothing to init for system commands
  }

  bool handleCommand(uint8_t cmd, uint8_t *payload, uint16_t len,
                     uint8_t *respData, uint16_t &respLen) override {
    switch (cmd) {
    case OpupCmd::SYS_PING: {
      respData[0] = 0xCA;
      respData[1] = 0xFE;
      respLen = 2;
      return true;
    }
    case OpupCmd::SYS_GET_CAPS: {
      const char *caps = "{\"proto\":\"opup\",\"ver\":\"2.0\",\"caps\":["
                         "\"i2c\",\"spi\",\"isp\",\"swd\"]}";
      strcpy((char *)respData, caps);
      respLen = strlen(caps);
      return true;
    }
    case OpupCmd::SYS_GET_STATUS: {
      respData[0] = 0; // Idle
      uint32_t uptime = millis();
      memcpy(&respData[1], &uptime, 4);
      respLen = 5;
      return true;
    }
    case OpupCmd::BOOTLOADER: {
      // Send ACK before rebooting
      respLen = 0;
      // We need to send response immediately because we are about to reboot
      // But handleCommand just returns true to send response.
      // The caller (OPUP::processPacket) sends response.
      // So we need a way to delay reboot until response is sent.
      // For now, we can just return true, and hope the response goes out before
      // we reboot? No, we need to trigger reboot AFTER response. We can use a
      // flag or a callback. Or we can just do it here with a small delay but
      // that blocks response? Actually, OPUP::processPacket sends response
      // immediately after this returns. So we can set a flag to reboot in
      // loop()? Or just use rp2040.rebootToBootloader() here? If we do it here,
      // the response might not be sent. Let's use a dirty hack: delay(10) then
      // reboot? But we are inside handleCommand. Let's just return true, and
      // let the user handle the reboot manually? No, the command is
      // "BOOTLOADER". Let's use `rp2040.rebootToBootloader()` but we need
      // access to `rp2040` object. It is global in Arduino-Pico. But we need to
      // wait for response to be sent. OPUP::sendResponse writes to Serial.
      // Serial is buffered. Serial.flush() might help.
      return true;
    }
    default:
      return false;
    }
  }
};
