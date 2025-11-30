#pragma once
#include "../../swd_driver.h"
#include "../OPUP.h"
#include "../OPUPDriver.h"

class OPUP_SWD : public OPUPDriver {
private:
  SWDDriver &swd;

public:
  OPUP_SWD(SWDDriver &driver) : swd(driver) {}

  void begin() override {
    // SWD initialized in main
  }

  bool handleCommand(uint8_t cmd, uint8_t *payload, uint16_t len,
                     uint8_t *respData, uint16_t &respLen) override {
    switch (cmd) {
    case OpupCmd::SWD_INIT: {
      swd.begin();
      respLen = 0;
      return true;
    }
    case OpupCmd::SWD_READ: {
      // TODO: Implement full SWD read
      return false;
    }
    case OpupCmd::SWD_WRITE: {
      // TODO: Implement full SWD write
      return false;
    }
    default:
      return false;
    }
  }
};
