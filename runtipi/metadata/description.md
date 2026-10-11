# PostPush

PostPush announces new mail on selected HomePods and AirPlay speakers.

- receives mailbox events from Home Assistant through MQTT
- generates any configured message locally with Piper or plays an uploaded audio file
- plays in sync on all or selected AirPlay speakers
- provides a master switch, active hours, volume, and duplicate-event cooldown
- keeps speech, audio, event data, and settings on the local server

The current Runtipi package reuses the OwnTone service from **Ring HomePod Doorbell**, which must run on the same Runtipi host. This avoids a conflicting second mDNS stack. The server and speakers must be reachable on the same network, and Apple Home must allow speaker access for **Anyone On the Same Network**.
