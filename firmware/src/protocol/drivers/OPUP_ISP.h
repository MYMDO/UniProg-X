#pragma once
#include "../../isp_driver.h"
#include "../OPUP.h"
#include "../OPUPDriver.h"

class OPUP_ISP : public OPUPDriver {
private:
  ISPDriver &isp;

public:
  OPUP_ISP(ISPDriver &driver) : isp(driver) {}

  void begin() override {
    // ISP initialized in main
  }

  bool handleCommand(uint8_t cmd, uint8_t *payload, uint16_t len,
                     uint8_t *respData, uint16_t &respLen) override {
    switch (cmd) {
    case OpupCmd::ISP_ENTER: {
      if (isp.enterProgrammingMode()) {
        respLen = 0;
        return true;
      }
      return false;
    }
    case OpupCmd::ISP_XFER: {
      if (len < 4)
        return false;
      isp.transferBlock(payload, respData);
      respLen = 4;
      return true;
    }
    case OpupCmd::ISP_EXIT: {
      isp.endProgrammingMode();
      respLen = 0;
      return true;
    }
    default:
      return false;
    }
  }
};
