const AIController = Packages.mindustry.entities.units.AIController;
const Mathf = Packages.arc.math.Mathf;

// Load deployment system
require("deploymentSystem");
// Load passive generation system
require("generationSystem");

// Apply custom AI to Trihedron unit
Events.on(EventType.ContentInitEvent, () => {
    const trihedron = Vars.content.getByName(ContentType.unit, "tes-trihedron");
    if (trihedron != null) {
        trihedron.controller = u => extend(AIController, {
            updateMovement() {
                // Find nearest enemy unit
                let closest = null;
                let minDist = 999999;

                Groups.unit.each(u => {
                    if (u.team != this.unit.team && !u.dead && u.type.targetable) {
                        let dist = Mathf.dst(this.unit.x, this.unit.y, u.x, u.y);
                        if (dist < minDist) {
                            minDist = dist;
                            closest = u;
                        }
                    }
                });

                // If we found a target
                // If we found a target
                if (closest != null) {
                    this.moveTo(closest, this.unit.type.range * 0.8);
                    this.unit.lookAt(closest);
                } else {
                    // No enemies found, find nearest enemy core
                    let core = Vars.state.teams.closestEnemyCore(this.unit.x, this.unit.y, this.unit.team);
                    if (core != null) {
                        this.moveTo(core, 1);
                        this.unit.lookAt(core);
                    }
                }
            }
        });
    }

    // Apply custom AI to Overseer unit
    const overseer = Vars.content.getByName(ContentType.unit, "tes-overseer");
    if (overseer != null) {
        overseer.controller = u => extend(AIController, {
            updateMovement() {
                // Constant slow rotation
                this.unit.rotation += 0.02;

                // Find nearest enemy unit
                let closest = null;
                let minDist = 999999;

                Groups.unit.each(u => {
                    if (u.team != this.unit.team && !u.dead && u.type.targetable) {
                        let dist = Mathf.dst(this.unit.x, this.unit.y, u.x, u.y);
                        if (dist < minDist) {
                            minDist = dist;
                            closest = u;
                        }
                    }
                });

                let target = closest;

                // If no unit found, target core
                if (target == null) {
                    target = Vars.state.teams.closestEnemyCore(this.unit.x, this.unit.y, this.unit.team);
                }

                if (target != null) {
                    // 15 tiles = 120 world units
                    const desiredDistance = 120;
                    const currentDist = Mathf.dst(this.unit.x, this.unit.y, target.x, target.y);

                    if (currentDist > desiredDistance) {
                        // Too far, approach
                        this.moveTo(target, desiredDistance);
                    } else if (currentDist < desiredDistance - 10) {
                        // Too close, back away slightly (if possible) or just stop approaching
                        // Simplest "keep distance" without complex vector math: 
                        // move towards angle away from target?
                        // For now, just stopping approach works as a basic "hold distance"
                        // But let's try to back up
                        const angle = this.unit.angleTo(target);
                        const vec = new Packages.arc.math.geom.Vec2();
                        vec.trns(angle + 180, this.unit.speed()); // Move away at unit speed
                        this.unit.moveAt(vec);
                    }

                    // Note: We don't call lookAt because we want constant spinning
                }
            },

            // Override rotation update to prevent auto-facing target
            updateRotation() {
                // Do nothing, rotation is handled in updateMovement
            }
        });
    }

    // Apply custom AI to Disintegrator unit
    const disintegrator = Vars.content.getByName(ContentType.unit, "tes-disintegrator");
    if (disintegrator != null) {
        disintegrator.controller = u => extend(AIController, {
            updateMovement() {
                // Always find and move to nearest enemy or neutral building
                let closestBuilding = null;
                let minBuildingDist = 999999;

                Groups.build.each(b => {
                    // Target enemy buildings and neutral (derelict) buildings
                    if (b.team != this.unit.team) {
                        let dist = Mathf.dst(this.unit.x, this.unit.y, b.x, b.y);
                        if (dist < minBuildingDist) {
                            minBuildingDist = dist;
                            closestBuilding = b;
                        }
                    }
                });

                // Move towards the closest building
                if (closestBuilding != null) {
                    this.moveTo(closestBuilding, this.unit.type.range * 0.8);
                }
            },

            updateTargeting() {
                // Targeting priority system
                const weaponRange = this.unit.type.maxRange;
                let targetToShoot = null;

                // HIGH PRIORITY: Check for enemy/neutral buildings in weapon range
                let closestBuildingInRange = null;
                let minBuildingRangeDist = 999999;

                Groups.build.each(b => {
                    if (b.team != this.unit.team) {
                        let dist = Mathf.dst(this.unit.x, this.unit.y, b.x, b.y);
                        if (dist <= weaponRange && dist < minBuildingRangeDist) {
                            minBuildingRangeDist = dist;
                            closestBuildingInRange = b;
                        }
                    }
                });

                if (closestBuildingInRange != null) {
                    // Building in range - highest priority
                    targetToShoot = closestBuildingInRange;
                } else {
                    // LOW PRIORITY: Check for enemy units in weapon range (only if no buildings in range)
                    let closestEnemyUnit = null;
                    let minUnitDist = 999999;

                    Groups.unit.each(u => {
                        if (u.team != this.unit.team && !u.dead && u.type.targetable) {
                            let dist = Mathf.dst(this.unit.x, this.unit.y, u.x, u.y);
                            if (dist <= weaponRange && dist < minUnitDist) {
                                minUnitDist = dist;
                                closestEnemyUnit = u;
                            }
                        }
                    });

                    if (closestEnemyUnit != null) {
                        targetToShoot = closestEnemyUnit;
                    }
                }

                // Set target and aim (this activates shooting)
                if (targetToShoot != null) {
                    this.target = targetToShoot;
                    this.unit.lookAt(targetToShoot);
                } else {
                    this.target = null;
                }
            }
        });
    }
});
