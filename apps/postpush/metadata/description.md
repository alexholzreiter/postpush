# PostPush

PostPush announces new mail on selected HomePods and AirPlay speakers.

- receives mailbox events from Home Assistant through MQTT
- generates any configured message locally with Piper or plays an uploaded audio file
- plays in sync on all or selected AirPlay speakers
- provides a master switch, active hours, volume, and duplicate-event cooldown
- keeps speech, audio, event data, and settings on the local server

**Requires Ring HomePod Doorbell on the same host.** Install it first from the store `https://github.com/alexholzreiter/ring-homepod-doorbell`, added under the name `doorbell`. HomePod OS 27 allows only one OwnTone instance per host (AirPlay 2 timing uses the fixed ports 319 and 320), so PostPush plays through the DoorBell's OwnTone and stores its audio in the DoorBell's media folder. Stopping or reinstalling the DoorBell app stops PostPush announcements.

The server and speakers must be reachable on the same network, and Apple Home must allow speaker access for **Anyone On the Same Network**.

**Tested with:** HOBEIAN ZG-204ZL Zigbee motion sensor in the mailbox, Zigbee2MQTT, Mosquitto, Home Assistant, and HomePods on HomePod OS 27.

