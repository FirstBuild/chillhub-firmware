#include "Arduino.h"
#include "chillhub.h"

chInterface ChillHub;
unsigned char chInterface::buf[8] = { 
  0 };
chCbTableType* chInterface::callbackTable = NULL;

void chInterface::setup(char* name, unsigned char strLength) {
  Serial.begin(115200); // usb firmware set up as 115200
  delay(200);

  // register device type with chillhub mailman
  setName(name, strLength);
}

void chInterface::sendU8Msg(unsigned char msgType, unsigned char payload) {
  buf[0] = 3;
  buf[1] = msgType;
  buf[2] = unsigned8DataType;
  buf[3] = payload;
  Serial.write(buf, 4);
}

void chInterface::sendI8Msg(unsigned char msgType, signed char payload) {
  buf[0] = 3;
  buf[1] = msgType;
  buf[2] = signed8DataType;
  buf[3] = payload;
  Serial.write(buf, 4);
}

void chInterface::sendU16Msg(unsigned char msgType, unsigned int payload) {
  buf[0] = 4;
  buf[1] = msgType;
  buf[2] = unsigned16DataType;
  buf[3] = (payload >> 8) & 0xff;
  buf[4] = payload & 0xff;
  Serial.write(buf, 5);
}

void chInterface::sendI16Msg(unsigned char msgType, signed int payload) {
  buf[0] = 4;
  buf[1] = msgType;
  buf[2] = signed16DataType;
  buf[3] = (payload >> 8) & 0xff;
  buf[4] = payload & 0xff;
  Serial.write(buf, 5);
}

void chInterface::sendBooleanMsg(unsigned char msgType, unsigned char payload) {
  sendU8Msg(msgType, payload);
}

void chInterface::setName(char* name, unsigned char strLength) {
  buf[0] = strLength + 3; // length of the following message
  buf[1] = deviceIdMsgType;
  buf[2] = stringDataType;
  buf[3] = strLength; // string length
  Serial.write(buf,4); // send all that so that we can use Serial.print for the string
  Serial.print(name);
}

void chInterface::subscribe(unsigned char type, chillhubCallbackFunction callback) {
  storeCallbackEntry(type, CHILLHUB_CB_TYPE_FRIDGE, callback);
  sendU8Msg(subscribeMsgType, type);
}

void chInterface::unsubscribe(unsigned char type) {
  sendU8Msg(unsubscribeMsgType, type);
  callbackRemove(type, CHILLHUB_CB_TYPE_FRIDGE);
}

void chInterface::setAlarm(unsigned char ID, char* cronString, unsigned char strLength, chillhubCallbackFunction callback) {
  storeCallbackEntry(ID, CHILLHUB_CB_TYPE_CRON, callback);  
  buf[0] = strLength + 4; // message length
  buf[1] = setAlarmMsgType;
  buf[2] = stringDataType;
  buf[3] = strLength + 1; // string length
  buf[4] = ID; // callback id... it's best to use a character here otherwise things don't work right
  Serial.write(buf,5); // send all that so that we can use Serial.print for the string
  Serial.print(cronString);
}

void chInterface::unsetAlarm(unsigned char ID) {
  sendU8Msg(unsetAlarmMsgType, ID);
  callbackRemove(ID, CHILLHUB_CB_TYPE_CRON);
}

void chInterface::getTime(chillhubCallbackFunction cb) {
  storeCallbackEntry(0, CHILLHUB_CB_TYPE_TIME, cb);

  buf[0] = 1;
  buf[1] = getTimeMsgType;
  Serial.write(buf,2);
}

void chInterface::addCloudListener(unsigned char ID, chillhubCallbackFunction cb) {
  storeCallbackEntry(ID, CHILLHUB_CB_TYPE_CLOUD, cb);
}

void chInterface::loop() {
  //Serial.write(252);
  if (Serial.available() > 0) {
    //Serial.write(1);
    int msgDataRemaining = Serial.read();
    while (Serial.available() < msgDataRemaining) {
      delay(5);
    }
    //Serial.write(40+msgDataRemaining);
    if (msgDataRemaining > 0) {
      //Serial.write(2);
      unsigned char msgType = Serial.read();
      unsigned char dataType = Serial.read();
      //Serial.write(50+msgType);
      //Serial.write(60+dataType);
      msgDataRemaining -= 2;

      chillhubCallbackFunction callback;
      if ((msgType == alarmNotifyMsgType) || (msgType == timeResponseMsgType)) {
        //Serial.write(3);
        Serial.read(); // discard data type.  this'll be an array
        Serial.read(); //  of unsigned chars
        msgDataRemaining -= 2;
        if (msgType == alarmNotifyMsgType) {
          //Serial.write(4);
          callback = callbackLookup(Serial.read(), CHILLHUB_CB_TYPE_CRON);
          msgDataRemaining--;
        }
        else {
          //Serial.write(5);
          callback = callbackLookup(0, CHILLHUB_CB_TYPE_TIME);
        }

        if (callback) {
          //Serial.write(6);
          unsigned char time[4];
          for (char j = 0; j < 4; j++)
            time[0] = Serial.read();
          ((chCbFcnTime)callback)(time);
          msgDataRemaining -= 4;

          if (msgType == timeResponseMsgType) {
            //Serial.write(7);
            callbackRemove(0, CHILLHUB_CB_TYPE_TIME);
          }
        }
      }
      else {
        //Serial.write(8);
        callback = callbackLookup(msgType, (msgType <= CHILLHUB_RESV_MSG_MAX)?CHILLHUB_CB_TYPE_FRIDGE:CHILLHUB_CB_TYPE_CLOUD);

        if (callback) {
          //Serial.write(9);
          if (dataType == unsigned8DataType) {
            //Serial.write(10);
            ((chCbFcnU8)callback)(Serial.read());
            msgDataRemaining--;
          }
          else if (dataType == unsigned16DataType) {
            //Serial.write(11);
            unsigned int payload = 0;
            payload |= (Serial.read() << 8);
            payload |= Serial.read();
            ((chCbFcnU16)callback)(payload);
            msgDataRemaining -= 2;
          }
          else if (dataType == unsigned32DataType) {
            //Serial.write(12);
            unsigned long payload = 0;
            for (char j = 0; j < 4; j++) {
              payload = payload << 8;
              payload |= Serial.read();
            }
            ((chCbFcnU32)callback)(payload);
            msgDataRemaining -= 4;
          }
        }
      }
      //Serial.write(13);

      // discard any remaining data in this message
      for (char j = 0; j < msgDataRemaining; j++)
        Serial.read();
    }
    //Serial.write(255);
  }
}

void chInterface::storeCallbackEntry(unsigned char sym, unsigned char typ, chillhubCallbackFunction fcn) {
  chCbTableType* newEntry = new chCbTableType;
  newEntry->symbol = sym;
  newEntry->type = typ;
  newEntry->callback = fcn;
  newEntry->rest = callbackTable;
  callbackTable = newEntry;
}

chillhubCallbackFunction chInterface::callbackLookup(unsigned char sym, unsigned char typ) {
  chCbTableType* entry = callbackTable;
  //Serial.write(40);
  //Serial.write(40 + typ);
  //Serial.write(40 + sym);
  while (entry) {
    //Serial.write(40+entry->type);
    //Serial.write(40+entry->symbol);
    if ((entry->type == typ) && (entry->symbol == sym))
      return (entry->callback);
    else
      entry = entry->rest;
  }
  //Serial.write(49);
  return NULL;
}

void chInterface::callbackRemove(unsigned char sym, unsigned char typ) {
  chCbTableType* prev = callbackTable;
  chCbTableType* entry;
  if (prev)
    entry = prev->rest;

  while (entry) {
    if ((entry->type == typ) && (entry->symbol == sym)) {
      prev->rest = entry->rest;
      delete entry;
    }
    else {
      prev = entry;
      entry = entry->rest;
    }
  }
}




