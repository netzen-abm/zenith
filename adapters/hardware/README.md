# Hardware Adapter Boundary

Canonical flow:

`Device → Adapter → Capability Contract → Observation/Measurement → Evidence → Provenance → Core`

Hardware-specific integrations belong behind this boundary. The canonical data model must not depend on a vendor SDK, device identifier, or proprietary representation.

Expected future classes include GNSS/GPS, total stations, LiDAR, UAV/drone systems, photogrammetry, 3D scanners, microscopes, multispectral/hyperspectral sensors, environmental sensors, magnetometers, GPR, mobile/field devices, XR and laboratory instruments.
