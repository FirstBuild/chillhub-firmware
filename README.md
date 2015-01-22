ChillHub
========
ChillHub is a system for creating USB devices that extend the functionality of your fridge.  It consists of a raspberry pi (http://www.raspberrypi.org/), a green bean (https://firstbuild.com/greenbean/), and a USB hub in a refrigerator door.  ChillHub acts as a mailman the delivers messages from the cloud and the fridge to USB devices and from the USB devices back to the cloud.

This project provides the code running on the refrigerator itself that provides data services to the attached USB peripherals.

Gory Details
============
Hardware
--------

<pre>




                      +------------------------------------------------------+
                      |+----------------+       +---------------------------+|
 5VDC Input from------&gt;|                +-------------------&gt;+5V to GPIO    ||
  &#39;wallwart&#39;          ||Power Distro PCB|       |               Header      ||
                 +---&gt;||  (Upverter)    +------&gt;|                           ||
                 |+--&gt;|+----------------+------&gt;|USB     Raspberry Pi B+    ||
                 ||   |           +------------&gt;|Ports                      ||
                 ||   |           |     +------&gt;|                           ||
   External------+|   |           |     |       |                           ||
     USB----------+   |           |     |       +---------------------------+|
  to hubs in          |           |     |                                    |
    fridge            |           |     |    Chillhub Enclosure              |
                      | +---------+---+ |                                    |
                      | | Wifi Dongle | |        +--------------------------+|
                      | +-------------+ |        |                          ||
                      |                 +--------+   Green Bean            RJ45+-------&gt;To fridge
                      |                          |                          ||            RJ45
                      |                          +--------------------------+|
                      +------------------------------------------------------+</pre>

Link to Upverter project for Power Distribution PCB:
https://upverter.com/firstbuild/7ce96d53e282a1d7/Chillhub-Power-Distribution-Board/

Power Supply: TRIAD MAGNETICS  WSU050-4000  AC-DC CONV, EXTERNAL PLUG IN, 1 O/P, 20W, 4A, 5V

ChillHub to USB Peripheral Interface
------------------------------------
The ChillHub system expects to work with USB devices that are of the CDC (Communications Device Class) ACM (Abstract Control Model) device class.  This class of devices essentially acts as the classical RS-232 serial port.  We select this class because it is easy to understand and is readily available for prototypers as the Arduino platform implements the CDC ACM class by default.  The ChillHub communicates at a baud rate of 115200 bps.

The ChillHub receives and transmits packetized data to/from USB peripherals.  A data packet has the following format.

| **Byte Number** | 0      | 1            | 2-N     |
| --------------- | ------ | ------------ | ------- |
| **Contents**    | Length | Message Type | Payload |

The Length field represents the number of bytes in the packet, not including the length field itself.

Packet Wrapper
--------------
An additional packet wrapper has been added to improve the robustness of communication.  It takes the 
original packet, treats it as a payload, adds a start of packet character, an escape character, the length of the payload,
and a checksum at the end of the payload.  The packet structure is as follows:

| STX | Length | Payload | 16-bit Checksum with MSB first |
|-----|--------|---------|--------------------------------|

- The STX has a value of 0xff (255).
- The length of the payload is the length of the original message including the length, message type, 
and payload of the original message.  The calculated length does not include any escape characters.
- An escape (ESC) character with value 0xfe (254) is used to indicate that the next character is a 
byte happens to be the same value as a control character but should be treated as a portion of the message.
- The checksum is calculated over the original payload and is seeded with the decimal value 42.

**Example:**

_Original message:_ 3, 148, 3, 0

_Wrapped message:_ 255, 4, 3, 148, 3, 0, 0, 196
 
| **Byte** | **Meaning**                                    |
|----------|------------------------------------------------|
|   255    | STX control character                          |
|    4     | Length of the original message                 |
|    3     | First character of original message (length)   |
|   148    | Second byte of original message (message type) |
|    3     | Third byte of original message (data type)     |
|    0     | Fourth byte of original message (data)         |  
|    0     | Most-significant byte of the checksum          |
|   196    | Least-significatn byte of the checksum         |

Checksum calculation: 42 (seed) + 3 + 148 + 3 = 196

**Example with escape characters:**

_Original message:_ 3, 148, 3, 255

_Wrapped message:_ 255, 4, 3, 148, 3, 254, 255, 1, 195

| **Byte** | **Meaning**                                    |
|----------|------------------------------------------------|
|   255    | STX control character                          |
|    4     | Length of the original message                 |
|    3     | First character of original message (length)   |
|   148    | Second byte of original message (message type) |
|    3     | Third byte of original message (data type)     |
|   254    | The escape control character                   | 
|   255    | Fourth byte of original message (data)         |  
|    1     | Most-significant byte of the checksum          |
|   195    | Least-significatn byte of the checksum         |

In this example it can be seen that the original message contains a value of 255, which is the
STX control character.  This character is preceeded by the escape control character, highlighted
above, which is not included in the character count.

If any byte of the original message includes a control character (STX or ESC), it should be 
preceded in the new, wrapped message wth the ESC control character.

Message Types
-------------
The **Message Type** field is a 1-byte value that is meant to indicate to the receiver what sort of data is located in the **Payload** field as an aid to processing that data.  The defined message types are enumerated below.  Note that ChillHub uses Big-Endian or Network Byte Order.

|**Message Type (Hex)**|**Description**|**Data Type of Payload**|
|----------------------|---------------|------------------------|
|0x00                  |Device ID & UUID      |Array                  |
|0x01                  |Subscribe      |Unsigned, 8-bit integer |
|0x02|Unsubscribe|Unsigned, 8-bit integer|
|0x03|Set Alarm|String (see below)|
|0x04|Unset Alarm|Unsigned, 8-bit integer|
|0x05|Alarm Notify|Array of uint8|
|0x06|Get Time|none|
|0x07|Provide Time|Array of uint8|
|0x08|Send Device ID|none|
|0x09|Register Resource|JSON|
|0x0a|Update Resource|JSON|
|0x0b|Resource Updated|JSON|
|0x0c|Set device UUID|String|
|0x0d-0x0F|Reserved for Future Use|n/a|
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

Note that each device that will attach to the ChillHub needs to have a UUID.  The UUID shall be a Version 4 random UUID.  Example: f47ac10b-58cc-4372-a567-0e02b2c3d479.  See this WikiPedia link for more details on UUID Version 4: http://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_.28random.29

Timing Messages
---------------
Messages 0x03, 0x04, 0x05, 0x06 allow the USB peripheral to get information about related to the time of day.  This works through the mechanism of the USB peripheral setting a timer and the ChillHub sending a message back to the USB peripheral letting it know when the matching time has been reached.

Message 0x03 sets a timer using the Unix ‘cron’ syntax.  (See https://github.com/ncb000gt/node-cron).  For the purposes of the ChillHub, we only use the String inputs to cron.  The payload for the message consists of a single character followed immediately by the cron input string.  The first character is not part of the cron string, but instead acts as an identifier for that cron entry.

When a time specified by the string provided in message 0x03 is matched, the ChillHub sends a message to the USB peripheral whose contents are the identifier provided as the first character in the contents of the alarm setting message as well as the current time.

For example, suppose the USB peripheral sends to the ChillHub the string _“p0 */5 * * * *”_.  Every five minutes (at 0 seconds), the ChillHub will send a message to the peripheral of type 0x05 whose contents are “p” followed by the time, formatted as an array of uint8s in the order [month, day, hour, minute].

 
This identifier is also used if the USB peripheral wishes to cancel that cron entry.

Additionally, the USB peripheral may, at any time, request the current time by sending the message type 0x06 to the ChillHub.  The ChillHub will respond with message type 0x07 with an array of uint8s specifying the time in the same format as above.

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
Ex. 1: Send Device ID and UUID (“ChillHub-Demo”, "UUID")

Byte No|Data|Description|
-------|----|-----------|
0|0xXX|Message Length (XX bytes)|
1|0x01|Message Type (Device ID)|
2|0x01|Payload Data Type (Array)|
3|0x02|Number of array elements|
4|0x02|Data type of the elements|
5|0x0C|No of Character in String (13)|
6|0x43|C|
7|0x68|h|
8|0x69|i|
9|0x6C|l|
10|0x6C|l|
|11|0x48|H
|12|0x75|u
|13|0x62|b
|14|0x2D|-
|15|0x44|D
|16|0x65|e
|17|0x6D|m
|18|0x6F|o
|19|0x20|No of characaters in string (32)
|20|Y|First character of UUID
<continue until all UUID charcters are sent>

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
