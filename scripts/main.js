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

                let target = null;

                // Priority 1: Enemy Unit
                if (closest != null) {
                    target = closest;
                    this.moveTo(closest, this.unit.type.range * 0.8);
                }
                // Priority 2: Enemy/Neutral Building (Core or any building)
                else {
                    let closestBuilding = null;
                    let minBuildingDist = 999999;

                    Groups.build.each(b => {
                        if (b.team != this.unit.team) {
                            let dist = Mathf.dst(this.unit.x, this.unit.y, b.x, b.y);
                            if (dist < minBuildingDist) {
                                minBuildingDist = dist;
                                closestBuilding = b;
                            }
                        }
                    });

                    if (closestBuilding != null) {
                        target = closestBuilding;
                        this.moveTo(closestBuilding, this.unit.type.range * 0.8);
                    }
                }

                // If we have a target, look at it
                if (target != null) {
                    this.unit.lookAt(target);
                    this.target = target; // Ensure targeting is set for weapons
                } else {
                    this.target = null;
                }
            },

            updateTargeting() {
                // Force shooting if target is in range
                if (this.target != null) {
                    const weaponRange = this.unit.type.maxRange;
                    const dist = Mathf.dst(this.unit.x, this.unit.y, this.target.x, this.target.y);

                    // Compensate for target size (approximate radius)
                    let targetRadius = 4; // Default

                    // Buildings have block.size, units have hitSize
                    if (this.target.block != null && this.target.block.size != null) {
                        // Building: use block size (in tiles) * 8 (world units per tile) / 2 (radius)
                        targetRadius = (this.target.block.size * 8) / 2;
                    } else if (this.target.hitSize != null) {
                        // Unit: use hitSize / 2
                        targetRadius = this.target.hitSize / 2;
                    }

                    // Effective range check: Distance to surface of target <= range
                    if (dist - targetRadius <= weaponRange) {
                        this.unit.isShooting = true;

                        // Aim and shoot all mounts
                        for (let i = 0; i < this.unit.mounts.length; i++) {
                            let mount = this.unit.mounts[i];
                            mount.shoot = true;
                            mount.aimX = this.target.x;
                            mount.aimY = this.target.y;
                        }
                    } else {
                        this.unit.isShooting = false;
                    }
                } else {
                    this.unit.isShooting = false;
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
                        // Too close, back away slightly
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
                // Find nearest enemy/neutral building globally
                let closestBuilding = null;
                let minBuildingDist = 999999;
                Groups.build.each(b => {
                    if (b.team != this.unit.team) {
                        let dist = Mathf.dst(this.unit.x, this.unit.y, b.x, b.y);
                        if (dist < minBuildingDist) {
                            minBuildingDist = dist;
                            closestBuilding = b;
                        }
                    }
                });

                // Always move towards nearest building
                if (closestBuilding != null) {
                    this.moveTo(closestBuilding, this.unit.type.range * 0.8);
                }
            },

            updateTargeting() {
                const weaponRange = this.unit.type.maxRange;
                let targetToAim = null;

                // 1. Find nearest enemy/neutral building globally
                let closestBuilding = null;
                let minBuildingDist = 999999;
                Groups.build.each(b => {
                    if (b.team != this.unit.team) {
                        let dist = Mathf.dst(this.unit.x, this.unit.y, b.x, b.y);
                        if (dist < minBuildingDist) {
                            minBuildingDist = dist;
                            closestBuilding = b;
                        }
                    }
                });

                // 2. Find nearest enemy unit globally
                let closestUnit = null;
                let minUnitDist = 999999;
                Groups.unit.each(u => {
                    if (u.team != this.unit.team && !u.dead && u.type.targetable) {
                        let dist = Mathf.dst(this.unit.x, this.unit.y, u.x, u.y);
                        if (dist < minUnitDist) {
                            minUnitDist = dist;
                            closestUnit = u;
                        }
                    }
                });

                // 3. Determine target based on priorities
                // Priority 1: Building in Range
                if (closestBuilding != null && minBuildingDist <= weaponRange) {
                    targetToAim = closestBuilding;
                }
                // Priority 2: Unit in Range (only if no building in range)
                else if (closestUnit != null && minUnitDist <= weaponRange) {
                    targetToAim = closestUnit;
                }
                // Priority 3: Nothing in range - aim at closest entity
                else {
                    if (closestBuilding != null && closestUnit != null) {
                        targetToAim = (minBuildingDist < minUnitDist) ? closestBuilding : closestUnit;
                    } else if (closestBuilding != null) {
                        targetToAim = closestBuilding;
                    } else if (closestUnit != null) {
                        targetToAim = closestUnit;
                    }
                }

                // 4. Apply target (activates rotation) and check shooting
                if (targetToAim != null) {
                    this.target = targetToAim;
                    this.unit.lookAt(targetToAim);

                    // Explicitly enable shooting if target is within range
                    const dist = Mathf.dst(this.unit.x, this.unit.y, targetToAim.x, targetToAim.y);
                    if (dist <= weaponRange) {
                        this.unit.isShooting = true;

                        // Force weapon update to ensure it shoots
                        for (let i = 0; i < this.unit.mounts.length; i++) {
                            let mount = this.unit.mounts[i];
                            mount.shoot = true;
                            mount.aimX = targetToAim.x;
                            mount.aimY = targetToAim.y;
                        }
                    } else {
                        this.unit.isShooting = false;
                        for (let i = 0; i < this.unit.mounts.length; i++) {
                            this.unit.mounts[i].shoot = false;
                        }
                    }
                } else {
                    this.target = null;
                    this.unit.isShooting = false;
                }
            }
        });
    }
});

// Apply custom AI to Circlet unit
Events.on(EventType.ContentInitEvent, () => {
    const circlet = Vars.content.getByName(ContentType.unit, "tes-circlet");
    if (circlet != null) {
        circlet.controller = u => extend(AIController, {
            updateMovement() {
                // Find nearest enemy unit
                let closestUnit = null;
                let minUnitDist = 999999;

                Groups.unit.each(u => {
                    if (u.team != this.unit.team && !u.dead && u.type.targetable) {
                        let dist = Mathf.dst(this.unit.x, this.unit.y, u.x, u.y);
                        if (dist < minUnitDist) {
                            minUnitDist = dist;
                            closestUnit = u;
                        }
                    }
                });

                // Find nearest enemy/neutral building
                let closestBuilding = null;
                let minBuildingDist = 999999;

                Groups.build.each(b => {
                    if (b.team != this.unit.team) {
                        let dist = Mathf.dst(this.unit.x, this.unit.y, b.x, b.y);
                        if (dist < minBuildingDist) {
                            minBuildingDist = dist;
                            closestBuilding = b;
                        }
                    }
                });

                // Choose closest target (unit or building)
                let target = null;
                let targetDist = 999999;

                if (closestUnit != null && minUnitDist < minBuildingDist) {
                    target = closestUnit;
                    targetDist = minUnitDist;
                } else if (closestBuilding != null) {
                    target = closestBuilding;
                    targetDist = minBuildingDist;
                }

                // Movement: Maintain distance at maxRange
                if (target != null) {
                    const optimalRange = this.unit.type.maxRange * 0.9; // Slightly less than max for safety
                    const minRange = this.unit.type.maxRange * 0.7; // Don't get too far

                    if (targetDist > optimalRange) {
                        // Too far - move closer
                        this.moveTo(target, optimalRange);
                    } else if (targetDist < minRange) {
                        // Too close - back away
                        const angle = this.unit.angleTo(target) + 180; // Opposite direction from target
                        const moveX = this.unit.x + Mathf.cosDeg(angle) * this.unit.speed() * 2;
                        const moveY = this.unit.y + Mathf.sinDeg(angle) * this.unit.speed() * 2;
                        this.pathfind(Pathfinder.fieldCore);
                        this.unit.moveAt(new Packages.arc.math.geom.Vec2(moveX - this.unit.x, moveY - this.unit.y));
                    }
                    // else: in optimal range, don't move (or minimal adjustment)

                    this.unit.lookAt(target);
                    this.target = target;
                } else {
                    this.target = null;
                }
            },

            updateTargeting() {
                // Force shooting if target is in range
                if (this.target != null) {
                    const weaponRange = this.unit.type.maxRange;
                    const dist = Mathf.dst(this.unit.x, this.unit.y, this.target.x, this.target.y);

                    // Compensate for target size
                    let targetRadius = 4;
                    if (this.target.block != null && this.target.block.size != null) {
                        targetRadius = (this.target.block.size * 8) / 2;
                    } else if (this.target.hitSize != null) {
                        targetRadius = this.target.hitSize / 2;
                    }

                    if (dist - targetRadius <= weaponRange) {
                        this.unit.isShooting = true;
                        for (let i = 0; i < this.unit.mounts.length; i++) {
                            let mount = this.unit.mounts[i];
                            mount.shoot = true;
                            mount.aimX = this.target.x;
                            mount.aimY = this.target.y;
                        }
                    } else {
                        this.unit.isShooting = false;
                    }
                } else {
                    this.unit.isShooting = false;
                }
            }
        });
    }
});

// Apply custom AI to Quartermaster unit - SIMPLIFIED VERSION
Events.on(EventType.ContentInitEvent, () => {
    const quartermaster = Vars.content.getByName(ContentType.unit, "tes-quartermaster");
    if (quartermaster != null) {
        quartermaster.controller = u => extend(AIController, {
            updateMovement() {
                // Constant rotation
                this.unit.rotation += 0.02;

                // Find nearest enemy (unit or core)
                let target = null;
                let minDist = 999999;

                // Check enemy units
                Groups.unit.each(u => {
                    if (u.team != this.unit.team && !u.dead && u.type.targetable) {
                        let dist = Mathf.dst(this.unit.x, this.unit.y, u.x, u.y);
                        if (dist < minDist) {
                            minDist = dist;
                            target = u;
                        }
                    }
                });

                // If no unit, target enemy core
                if (target == null) {
                    target = Vars.state.teams.closestEnemyCore(this.unit.x, this.unit.y, this.unit.team);
                    if (target != null) {
                        minDist = Mathf.dst(this.unit.x, this.unit.y, target.x, target.y);
                    }
                }

                const holdDistance = 120;

                if (target != null) {
                    if (minDist > holdDistance) {
                        // Too far - approach
                        this.moveTo(target, holdDistance);
                    } else if (minDist < holdDistance - 32) {
                        // Too close - back away
                        const angle = this.unit.angleTo(target);
                        const vec = new Packages.arc.math.geom.Vec2();
                        vec.trns(angle + 180, this.unit.speed());
                        this.unit.moveAt(vec);
                    }
                }
            },

            updateRotation() {
                // Do nothing, rotation handled in updateMovement
            }
        });
    }
});
