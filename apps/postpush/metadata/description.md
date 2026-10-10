# PostPush

PostPush meldet neue Post mit einer gesprochenen Ansage auf deinen HomePods.

- empfängt Briefkasten-Ereignisse von Home Assistant über MQTT
- erzeugt den frei wählbaren deutschen Ansagetext lokal mit Piper oder spielt eine eigene Audiodatei ab
- spielt synchron auf allen oder ausgewählten HomePods
- bietet Hauptschalter, Ruhezeit, Lautstärke und Sperrzeit
- sendet keine Sprachdaten an einen Cloud-Dienst

Der Runtipi-Server und die HomePods müssen sich im selben lokalen Netzwerk befinden. Für AirPlay muss in Apple Home unter **Einstellungen des Zuhauses → Lautsprecher & TVs** der Zugriff aus demselben Netzwerk erlaubt sein.
