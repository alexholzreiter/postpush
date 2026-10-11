# PostPush

PostPush announces new mail on selected HomePods and AirPlay speakers.

- receives mailbox events from Home Assistant through MQTT
- generates any configured message locally with Piper or plays an uploaded audio file
- plays in sync on all or selected AirPlay speakers
- provides a master switch, active hours, volume, and duplicate-event cooldown
- keeps speech, audio, event data, and settings on the local server

PostPush brings its own OwnTone instance and uses the host's avahi-daemon for AirPlay discovery, so no other app is required. The server and speakers must be reachable on the same network, and Apple Home must allow speaker access for **Anyone On the Same Network**.

**Tested with:** HOBEIAN ZG-204ZL Zigbee motion sensor in the mailbox, Zigbee2MQTT, Mosquitto, Home Assistant, and HomePods on HomePod OS 27.

