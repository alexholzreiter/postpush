# PostPush

PostPush ist eine selbst gehostete Briefkasten-Ansage für HomePods:

```text
Briefkastensensor → Home Assistant → MQTT → PostPush → HomePods
```

Die App erzeugt einen frei wählbaren deutschen Ansagetext lokal mit Piper TTS
und spielt ihn über OwnTone/AirPlay synchron auf allen oder ausgewählten
HomePods ab. Die Weboberfläche verwaltet Hauptschalter, Zeitplan, Sperrzeit,
Lautstärke und HomePod-Auswahl.

## Voraussetzungen

- Home Assistant mit funktionierendem Briefkastensensor
- MQTT-Broker, den Home Assistant und PostPush erreichen können
- Runtipi-Server und HomePods im selben lokalen Netzwerk/VLAN
- Apple Home: **Einstellungen des Zuhauses → Lautsprecher & TVs → Jeder im selben Netzwerk**

PostPush verwendet die Ports `8586` für die Weboberfläche und `3690` für die
eigene OwnTone-Instanz. Damit kann es parallel zur Ring HomePod Doorbell laufen.

## Installation über Runtipi

Dieses Repository ist zugleich ein eigener Runtipi App Store. Unter
**Runtipi → Einstellungen → App Stores** wird folgende Adresse hinzugefügt:

```text
https://github.com/alexholzreiter/postpush
```

Danach erscheint **PostPush** im App Store. Bei der Installation werden
MQTT-Adresse, Benutzername, Passwort und Topic abgefragt. Empfohlen wird ein
eigener MQTT-Benutzer `postpush`, der das Topic `postpush/events/mail` lesen darf.

## Home Assistant verbinden

Eine zweite Automation veröffentlicht das Ereignis. Die bestehende Handy-Push-
Automation bleibt unverändert; PostPush verwaltet seinen eigenen Schalter und
Zeitplan.

```yaml
alias: "Briefkasten: PostPush"
triggers:
  - trigger: state
    entity_id: binary_sensor.0xa4c138dd803d5113_occupancy
    from: "off"
    to: "on"
actions:
  - action: mqtt.publish
    data:
      topic: postpush/events/mail
      payload: '{"event":"mail","source":"home_assistant"}'
      retain: false
mode: single
```

Alternativ kann die Automation vollständig über die Home-Assistant-Oberfläche
erstellt werden: Auslöser **Zustand**, Aktion **MQTT: Publish**. Retain muss aus
bleiben, damit nach einem Neustart keine alte Meldung abgespielt wird.

## Lokal entwickeln

```bash
cp .env.example .env
npm install
npm test
docker compose up -d --build
```

Danach ist die Weboberfläche unter `http://SERVER-IP:8586` erreichbar.
Persistente Einstellungen und die erzeugte WAV-Datei liegen in `data/`.

## MQTT-Payload

Das konfigurierte Topic akzeptiert nicht-retained Nachrichten mit einem der
folgenden Inhalte:

```json
{"event":"mail"}
```

Ebenfalls gültig sind `mail`, `on`, `true`, `1` oder `{"post":true}`.

## Datenschutz und Verhalten

- Die Sprachsynthese läuft mit Piper und der deutschen Thorsten-Stimme lokal.
- Der Ansagetext wird nicht an einen Cloud-TTS-Dienst übertragen.
- Die Weboberfläche enthält keine externen Schriften, Tracker oder CDNs.
- Eine AirPlay-Ansage kann laufende Musik kurz unterbrechen.
- Gespeicherte MQTT-Nachrichten werden absichtlich ignoriert.

## Veröffentlichung

Der Workflow `.github/workflows/container.yml` baut `amd64`- und `arm64`-Images
für GHCR, sobald ein Tag wie `v0.1.0` gepusht wird. Das Container-Paket muss
öffentlich sein, damit Runtipi es ohne Registry-Anmeldung laden kann.

## Lizenz

MIT. Piper selbst wird unter GPL-3.0 bereitgestellt; das verwendete
Thorsten-Sprachmodell ist separat lizenziert und wird beim Image-Build geladen.
