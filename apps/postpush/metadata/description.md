# PostPush

**English** · Deutsch weiter unten

PostPush announces new mail on selected HomePods and AirPlay speakers.

- receives mailbox events from Home Assistant through MQTT
- generates any configured message locally with Piper or plays an uploaded audio file
- plays in sync on all or selected AirPlay speakers
- provides a master switch, active hours, volume, and duplicate-event cooldown
- keeps speech, audio, event data, and settings on the local server

The current Runtipi package reuses the OwnTone service from **Ring HomePod Doorbell**, which must run on the same Runtipi host. This avoids a conflicting second mDNS stack. The server and speakers must be reachable on the same network, and Apple Home must allow speaker access for **Anyone On the Same Network**.

**Tested with:** HOBEIAN ZG-204ZL Zigbee motion sensor in the mailbox, Zigbee2MQTT, Mosquitto, Home Assistant, and HomePods on HomePod OS 27.

---

## Deutsch

PostPush kündigt neue Post auf ausgewählten HomePods und AirPlay-Lautsprechern an.

- empfängt Briefkasten-Ereignisse von Home Assistant über MQTT
- erzeugt eine frei wählbare Ansage lokal mit Piper oder spielt eine hochgeladene Audiodatei ab
- spielt synchron auf allen oder ausgewählten AirPlay-Lautsprechern
- bietet Hauptschalter, aktive Zeiten, Lautstärke und eine Sperrzeit gegen doppelte Ereignisse
- Sprache, Audio, Ereignisdaten und Einstellungen bleiben auf dem lokalen Server

Das aktuelle Runtipi-Paket nutzt den OwnTone-Dienst von **Ring HomePod Doorbell** mit, der auf demselben Runtipi-Host laufen muss. So entsteht kein zweiter, konkurrierender mDNS-Stack. Server und Lautsprecher müssen im selben Netzwerk erreichbar sein, und in Apple Home muss der Lautsprecherzugriff auf **Alle im selben Netzwerk** stehen.

**Getestet mit:** HOBEIAN ZG-204ZL Zigbee-Bewegungsmelder im Briefkasten, Zigbee2MQTT, Mosquitto, Home Assistant und HomePods mit HomePod OS 27.
