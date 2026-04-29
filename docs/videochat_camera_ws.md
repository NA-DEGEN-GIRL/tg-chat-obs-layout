# Videochat Camera WS Control

The `videochat_overlay.py` `/ws` endpoint accepts camera control messages and rebroadcasts them to every connected overlay browser as `videochat_camera`.

Absolute camera example:

```json
{"type":"camera","yaw_deg":45,"pitch_deg":22,"distance":9,"target":{"x":0,"y":1.05,"z":0.2}}
```

Incremental camera example:

```json
{"type":"camera","delta":{"yaw_deg":5,"distance":-0.5,"target":{"x":0.1,"z":0}}}
```

Reset example:

```json
{"type":"camera","reset":true}
```

Supported fields:

- `yaw` in radians or `yaw_deg` in degrees
- `pitch` in radians or `pitch_deg` in degrees
- `distance`, `height`, `fov`
- `target: {x, y, z}`
- `delta` with the same numeric fields for relative movement
