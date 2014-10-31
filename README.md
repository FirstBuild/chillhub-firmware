ChillHub
========
ChillHub is a system for creating USB devices that extend the functionality of your fridge.  It consists of a raspberry pi (http://www.raspberrypi.org/), a green bean (https://firstbuild.com/greenbean/), and a USB hub in a refrigerator door.  ChillHub acts as a mailman the delivers messages from the cloud and the fridge to USB devices and from the USB devices back to the cloud.

The provided code consists of two major pieces.  The first is the code that runs on the raspberry pi itself and makes the refrigerator into a ChillHub.  The second is a library for Arduino that makes it easy to start making ChillHub-compatible USB accessories.

Arduino Library
===============
The Arduino library is contained in the **ChillHub** directory of this repository.  Copy that directory into your Arduino/Libraries directory, and you should see a _chillhub-demo_ example in your Arduino Sketchbook.  That's a good place to look for jump starting your project.

How To Use
----------
Start off your arduino sketch with
```c++
#include "chillhub.h"

void setup() {
 ChillHub.setup("your_name_here", 14);
}

void loop() {
 ChillHub.loop();
}
```
Obviously, replacing "your_name_here" with whatever ID you've selected for your ChillHub accessory.

Available Functions
-------------------
###Data From Fridge
```c++
void subscribe(unsigned char type, chillhubCallbackFunction cb);
void unsubscribe(unsigned char type);
```
These functions allow your USB device to subscribe to or unsubscribe from data originating from the fridge.  ChillHub supports the same data streams as green-bean (https://github.com/GEMakers/gea-plugin-refrigerator).  When using these functions, use values from the ChillHubDataTypes enum (in chillhub.h) for the _type_ field.  When creating your callback function, you'll need to ensure that the argument to your callback function matches the data type returned by the subscription's data stream (see **Message Types** below).

###Alarms and Time
```c++
void setAlarm(unsigned char ID, char* cronString, unsigned char strLength, chillhubCallbackFunction cb);
void unsetAlarm(unsigned char ID);
void getTime(chillhubCallbackFunction cb);
```
These functions give your USB device the ability to find out the current local real-time as well as to be notified when particular times occur.  Note that the ID field in setAlarm and unsetAlarm is a unique identifier for you to manage your device's alarms.  Further, note that the callback functions used here accepts a ```unsigned char[4]``` argument and, as noted below, the argument's contents will be _[month, day, hour, minute]_.

###Data to/from the Cloud
```c++
void addCloudListener(unsigned char msgType, chillhubCallbackFunction cb);
void sendU8Msg(unsigned char msgType, unsigned char payload);
void sendU16Msg(unsigned char msgType, unsigned int payload);
void sendI8Msg(unsigned char msgType, signed char payload);
void sendI16Msg(unsigned char msgType, signed int payload);
void sendBooleanMsg(unsigned char msgType, unsigned char payload);
```
Still under construction.

Gory Details
============
ChillHub to USB Peripheral Interface
------------------------------------
The ChillHub system expects to work with USB devices that are of the CDC (Communications Device Class) ACM (Abstract Control Model) device class.  This class of devices essentially acts as the classical RS-232 serial port.  We select this class because it is easy to understand and is readily available for prototypers as the Arduino platform implements the CDC ACM class by default.  The ChillHub communicates at a baud rate of 115200 bps.

The ChillHub receives and transmits packetized data to/from USB peripherals.  A data packet has the following format.

| **Byte Number** | 0      | 1            | 2-N     |
| --------------- | ------ | ------------ | ------- |
| **Contents**    | Length | Message Type | Payload |

The Length field represents the number of bytes in the packet, not including the length field itself.

Message Types
-------------
The **Message Type** field is a 1-byte value that is meant to indicate to the receiver what sort of data is located in the **Payload** field as an aid to processing that data.  The defined message types are enumerated below.  Note that ChillHub uses Big-Endian or Network Byte Order.

|**Message Type (Hex)**|**Description**|**Data Type of Payload**|
|----------------------|---------------|------------------------|
|0x00                  |Device ID      |String                  |
|0x01                  |Subscribe      |Unsigned, 8-bit integer |
|0x02|Unsubscribe|Unsigned, 8-bit integer|
|0x03|Set Alarm|String (see below)|
|0x04|Unset Alarm|Unsigned, 8-bit integer|
|0x05|Alarm Notify|Array of uint8|
|0x06|Get Time|none|
|0x07|Provide Time|Array of uint8|
|0x08-0x0F|Reserved for Future Use|n/a|
|0x10|filterAlert|Unsigned, 8-bit integer|
|0x11|waterFilterCalendarTimer|Unsigned, 16-bit integer|
|0x12|waterFilterCalendarPercentUsed|Unsigned, 8-bit integer|
|0x13|waterFilterHoursRemaining|Unsigned, 16-bit integer|
|0x14|waterUsageTimer|Unsigned, 32-bit integer|
|0x15|waterFilterUsageTimePercentUsed|Unsigned, 8-bit integer|
|0x16|waterFilterOuncesRemaining|Unsigned, 32-bit integer|
|0x17|commandFeatures|Unsigned, 8-bit integer|
|0x18|temperatureAlert|Unsigned, 8-bit integer|
|0x19|freshFoodDisplayTemperature|Unsigned, 8-bit integer|
|0x1A|freezerDisplayTemperature|Unsigned, 8-bit integer|
|0x1B|freshFoodSetpointTemperature|Unsigned, 8-bit integer|
|0x1C|freezerSetpointTemperature|Unsigned, 8-bit integer|
|0x1D|doorAlarmAlert|Unsigned, 8-bit integer|
|0x1E|iceMakerBucketStatus|Unsigned, 8-bit integer|
|0x1F|odorFilterCalendarTimer|Unsigned, 16-bit integer|
|0x20|odorFilterPercentUsed|Unsigned, 8-bit integer|
|0x21|odorFilterHoursRemaining|Unsigned, 8-bit integer|
|0x22|doorState|Unsigned, 8-bit integer|
|0x23|dcSwitchState|Unsigned, 8-bit integer|
|0x24|acInputState|Unsigned, 8-bit integer|
|0x25|iceMakerMoldThermistorTemperature|Unsigned, 16-bit integer|
|0x26|iceCabinetThermistorTemperature|Unsigned, 16-bit integer|
|0x27|hotWaterThermistor1Temperature|Unsigned, 16-bit integer|
|0x28|hotWaterThermistor2Temperature|Unsigned, 16-bit integer|
|0x29|dctSwitchState|Unsigned, 8-bit integer|
|0x2A|relayStatus|Unsigned, 8-bit integer|
|0x2B|ductDoorStatus|Unsigned, 8-bit integer|
|0x2C|iceMakerStateSelection|Unsigned, 8-bit integer|
|0x2D|iceMakerOperationalState|Unsigned, 8-bit integer|
|0x2E-0x4F|Reserved for Future Use|n/a|
|0x50-0xFF|User Defined Messages|n/a|

Note that messages 0x00-0x4F are reserved for ChillHub defined messages.  Messages 0x50-0xFF are available for use by peripherals to perform arbitrary tasks.  All user defined messages and the ChillHub defined messages that are marked as such will perform no action at the refrigerator but instead will be forwarded directly to the ChillHub Cloud Server for further processing.

For the definition of the payload in message types 0x10-0x2D, refer to the GEA SDK Refrigerator Plugin documentation (https://github.com/GEMakers/gea-plugin-refrigerator#appendix).  The payload of these messages will have the same format as that described in the message of the same name in the Refrigerator Plugin.

Timing Messages
---------------
Messages 0x03, 0x04, 0x05, 0x06 allow the USB peripheral to get information about related to the time of day.  This works through the mechanism of the USB peripheral setting a timer and the ChillHub sending a message back to the USB peripheral letting it know when the matching time has been reached.

Message 0x03 sets a timer using the Unix ‘cron’ syntax.  (See https://github.com/ncb000gt/node-cron).  For the purposes of the ChillHub, we only use the String inputs to cron.  The payload for the message consists of a single character followed immediately by the cron input string.  The first character is not part of the cron string, but instead acts as an identifier for that cron entry.

When a time specified by the string provided in message 0x03 is matched, the ChillHub sends a message to the USB peripheral whose contents are the identifier provided as the first character in the contents of the alarm setting message as well as the current time.

For example, suppose the USB peripheral sends to the ChillHub the string _“p0 */5 * * * *”_.  Every five minutes (at 0 seconds), the ChillHub will send a message to the peripheral of type 0x05 whose contents are “p” followed by the time, formatted as an array of uint8s in the order [month, day, hour, minute].

 
This identifier is also used if the USB peripheral wishes to cancel that cron entry.

Additionally, the USB peripheral may, at any time, request the current time by sending the message 0x06 to the ChillHub.  The ChillHub will respond with an array of uint8s specifying the time in the same format as above.

Payload Types
-------------
The Payload field contains the data of interest to the receiver.  The payload field supports the following data types.

|Type:      |0x01                    |Array                |                 |                 |
|-----------|------------------------|---------------------|-----------------|-----------------|
|Byte Number|0                       |1                    |2-A              |(A+1)-B          |
|Contents   |Number of Array Elements|Data Type of Elements|Array Element [0]|Array Element [1]|

|Type:|0x02|String|||
|-----------|------------------------|---------------------|-----------------|-----------------|
|Byte Number|0|1|2|3-N|
|Contents|Number of Characters in String|First Character|Second Character|Additional Characters (as length dictates)|

|Type:|0x03|Unsigned, 8-bit Integer|||
|-----------|------------------------|---------------------|-----------------|-----------------|
|Byte Number|0|||
|Contents|Value|||

|Type:|0x04|Signed, 8-bit Integer|||
|-----------|------------------------|---------------------|-----------------|-----------------|
|Byte Number|0|||
|Contents|Value|||

|Type:|0x05|Unsigned, 16-bit Integer|||
|-----------|------------------------|---------------------|-----------------|-----------------|
|Byte Number|0|1||
|Contents|MSB|LSB||

|Type:|0x06|Signed, 16-bit Integer|||
|-----------|------------------------|---------------------|-----------------|-----------------|
|Byte Number|0|1|||
|Contents|MSB|LSB|||

|Type:|0x07|Unsigned, 32-bit Integer|||
|-----------|------------------------|---------------------|-----------------|-----------------|
|Byte Number|0|1|2|3|
|Contents|MSB|-|-|LSB|

|Type:|0x08|Signed, 32-bit Integer|||
|-----------|------------------------|---------------------|-----------------|-----------------|
|Byte Number|0|1|2|3|
|Contents|MSB|-|-|LSB|

|Type:|0x09|JavaScript Object Notation (JSON)|||
|-----------|------------------------|---------------------|-----------------|-----------------|
|Byte Number|0|1-A|(A+1)-B|(B+1)-N|
|Contents|Number of Fields|First Field Key (String Data, neglecting data type byte)|First Field Value (as arbitrary data including data type byte)|Additional Key-Value Pairs|

|Type:|0x0A|Boolean|||
|-----------|------------------------|---------------------|-----------------|-----------------|
|Byte Number|0||||
|Contents|0: false, otherwise: true||||

Message Examples
----------------
Ex. 1: Send Device ID (“ChillHub-Demo”)

Byte No|Data|Description|
-------|----|-----------|
0|0x10|Message Length (16 bytes)|
1|0x01|Message Type (Device ID)|
2|0x02|Payload Data Type (String)|
3|0x0C|No of Character in String (13)|
4|0x43|C|
5|0x68|h|
6|0x69|i|
7|0x6C|l|
8|0x6C|l|
|9|0x48|H
|10|0x75|u
|11|0x62|b
|12|0x2D|-
|13|0x44|D
|14|0x65|e
|15|0x6D|m
|16|0x6F|o

Ex. 2: Subscribe to Refrigerator Door Status Events

Byte No|Data|Description
-------|----|-----------
0|0x03|Message Length (3 bytes)
1|0x01|Message Type (Subscribe)
2|0x03|Payload Data Type (U8)
3|0x22|Door State Messages

Ex. 3: Receive Door Status (Freezer Door Open)

Byte No|Data|Description
-------|----|-----------
0|0x03|Message Length (3 bytes)
1|0x22|Message Type (Door Status)
2|0x03|Payload Data Type (U8)
3|0x0A|Door State (Freezer Bottom Door Open)

Ex. 4: Send Array of Integers (U16) via User-Defined Message 0x71

Byte No|Data|Description|
-------|----|-----------
0|0x0E|Message Length (14 bytes)|
1|0x71|Message Type (User Defined)|
2|0x01|Payload Data Type (Array)|
3|0x05|No of Elements in Array (5)|
4|0x05|Type of Elements in Array (U16)|
5|0x04|Array Element #0 = 1059|
6|0x23||
|7|0xF2|Array Element #1 = 62040
|8|0x58|
|9|0x21|Array Element #2 = 8531
|10|0x53|
|11|0x11|Array Element #3 = 4458
|12|0x6A|
|13|0x00|Array Element #4 = 23
14|0x17|

Ex. 5: Send JSON Data via User-Defined Message 0xF0
JSON: { name: ‘PIx100’, val: 314 }
The field val is saved as a signed, 16-bit integer

Byte No|Data|Description|
-------|----|-----------
0|0x17|Message Length ()|
1|0xF0|Message Type (User Defined)|
2|0x09|Payload Data Type (JSON)|
3|0x02|No of Key/Value Pairs in Object (2)|
4|0x04|No of Characters in Key String (4)|
5|0x6E|n|
6|0x61|a|
7|0x6D|m|
8|0x65|e|
9|0x02|Data Type of Value (String)|
10|0x06|No of Characters in String (6)|
11|0x50|P|
|12|0x49|I
|13|0x78|x
|14|0x31|1
|15|0x30|0
|16|0x30|0
|17|0x03|No of Characters in Key String (3)
|18|0x76|v
|19|0x61|a
|20|0x6C|l
|21|0x06|Data Type of Value (I16)
|22|0x01|314
|23|0x3A|

ChillHub Cloud Service
----------------------
As noted above, messages originating from a USB peripheral that have no associated refrigerator-level effect will be forwarded to the ChillHub Cloud Service.  Manufacturers who create such a peripheral must also provide FirstBuild with a node.js module that (some sort of interface to be defined here).

Ultimately the messages delivered to the Cloud Service Module will be of JSON type with the following fields:
 1. device
 2. type
 3. devId
 4. content

The device field will contain the string that the peripheral provides to the ChillHub via the Device ID message (type 0x00).  This string must also match the name of the Cloud Service Module (as it is [possibly] loaded dynamically from the value of this string).

The type field contains the numerical message type that was specified by the USB peripheral.
The devId field represents the index of the USB peripheral.  This identifier uniquely defines a USB peripheral at the ChillHub.  Where multiple devices of the same type are present, the devId field is used to distinguish between those individuals.

The content field contains whatever payload was included with the message originating from the USB peripheral.  The contents of this field are arbitrary.

Note that (whenever a method of delivering data from the Cloud Service to the ChillHub is defined) messages from the ChillHub Cloud Service to an individual ChillHub must have the same four fields.  The value of the devId and device fields must be persistent if a Cloud Service Module wishes to address an individual device.  The value of the content field is again arbitrary, but special considerations are needed for numeric data in the content field.

Because JavaScript lacks numeric data types other than “number,” and the microcontrollers likely to be used in the various USB peripherals will need to know a priori how much memory to allocate, we define a standardized JSON for C-style numeric data types.

A numeric JSON object then has exactly two fields.  The first is numericType and contains one of the self-explaining string values “U8”, “U16”, “U32”, “I8”, “I16”, or “I32”.  The second is numericValue and contains the value of the number in question.

Transfert to Raspberry PI
----------------------
`rsync -avz . --exclude=node_modules/ --exclude=.git/ -e ssh pi@10.202.0.84:/home/pi/chillhub`

once on Pi you can install all the npm dependencies with
`npm install`

then launch the program

`sudo node chillhub.js`