#ifndef CHILLHUB_H
#define CHILLHUB_H

#define CHILLHUB_CB_TYPE_FRIDGE 0
#define CHILLHUB_CB_TYPE_CRON 1
#define CHILLHUB_CB_TYPE_TIME 2
#define CHILLHUB_CB_TYPE_CLOUD 3

typedef void (*chillhubCallbackFunction)();
struct chCbTableType {
  chillhubCallbackFunction callback;
  unsigned char symbol;
  unsigned char type;  // 0: fridge data, 1: cron alarm, 2: time, 3: cloud
  chCbTableType* rest;
};

class chInterface {  
  typedef void (*chCbFcnU8)(unsigned char);
  typedef void (*chCbFcnU16)(unsigned int);
  typedef void (*chCbFcnU32)(unsigned long);
  typedef void (*chCbFcnTime)(unsigned char[4]);
  
  private:
    static unsigned char buf[8];
    static chCbTableType* callbackTable;
    static void storeCallbackEntry(unsigned char id, unsigned char typ, void(*fcn)());
    static chillhubCallbackFunction callbackLookup(unsigned char sym, unsigned char typ);
    static void callbackRemove(unsigned char sym, unsigned char typ);
    static void setName(char* name, unsigned char strLength);
  
  public:
    static void setup(char* name, unsigned char strLength);
    static void subscribe(unsigned char type, chillhubCallbackFunction cb);
    static void unsubscribe(unsigned char type);
    static void setAlarm(unsigned char ID, char* cronString, unsigned char strLength, chillhubCallbackFunction cb);
    static void unsetAlarm(unsigned char ID);
    static void getTime(chillhubCallbackFunction cb);
    static void addCloudListener(unsigned char msgType, chillhubCallbackFunction cb);
    
    static void sendU8Msg(unsigned char msgType, unsigned char payload);
    static void sendU16Msg(unsigned char msgType, unsigned int payload);
    static void sendI8Msg(unsigned char msgType, signed char payload);
    static void sendI16Msg(unsigned char msgType, signed int payload);
    static void sendBooleanMsg(unsigned char msgType, unsigned char payload);
    
    static void loop();
};

// Chill Hub data types
enum ChillHubDataTypes {
  arrayDataType = 0x01,
  stringDataType = 0x02,
  unsigned8DataType = 0x03,
  signed8DataType = 0x04,
  unsigned16DataType = 0x05,
  signed16DataType = 0x06,
  unsigned32DataType = 0x07,
  signed32DataType = 0x08,
  jsonDataType = 0x09,
  booleanDataType = 0x10
};

// Chill Hub message types
enum ChillHubMsgTypes {
  deviceIdMsgType = 0x00,
  subscribeMsgType = 0x01,
  unsubscribeMsgType = 0x02,
  setAlarmMsgType = 0x03,
  unsetAlarmMsgType = 0x04,
  alarmNotifyMsgType = 0x05,
  getTimeMsgType = 0x06,
  timeResponseMsgType = 0x07,
  // 0x08-0x0F Reserved for Future Use
  filterAlertMsgType = 0x10,
  waterFilterCalendarTimerMsgType = 0x11,
  waterFilterCalendarPercentUsedMsgType = 0x12,
  waterFilterHoursRemainingMsgType = 0x13,
  waterUsageTimerMsgType = 0x14,
  waterFilterUsageTimePercentUsedMsgType = 0x15,
  waterFilterOuncesRemainingMsgType = 0x16,
  commandFeaturesMsgType = 0x17,
  temperatureAlertMsgType = 0x18,
  freshFoodDisplayTemperatureMsgType = 0x19,
  freezerDisplayTemperatureMsgType = 0x1A,
  freshFoodSetpointTemperatureMsgType = 0x1B,
  freezerSetpointTemperatureMsgType = 0x1C,
  doorAlarmAlertMsgType = 0x1D,
  iceMakerBucketStatusMsgType = 0x1E,
  odorFilterCalendarTimerMsgType = 0x1F,
  odorFilterPercentUsedMsgType = 0x20,
  odorFilterHoursRemainingMsgType = 0x21,
  doorStatusMsgType = 0x22,
  dcSwitchStateMsgType = 0x23,
  acInputStateMsgType = 0x24,
  iceMakerMoldThermistorTemperatureMsgType = 0x25,
  iceCabinetThermistorTemperatureMsgType = 0x26,
  hotWaterThermistor1TemperatureMsgType = 0x27,
  hotWaterThermistor2TemperatureMsgType = 0x28,
  dctSwitchStateMsgType = 0x29,
  relayStatusMsgType = 0x2A,
  ductDoorStatusMsgType = 0x2B,
  iceMakerStateSelectionMsgType = 0x2C,
  iceMakerOperationalStateMsgType = 0x2D
  // 0x2E-0x4F Reserved for Future Use
  // 0x50-0xFF User Defined Messages
};

#define CHILLHUB_RESV_MSG_MAX 0x4F

extern chInterface ChillHub;

#endif
