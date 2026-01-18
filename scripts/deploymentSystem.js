// Deployment system - spawns units when deployment blocks are placed
// Only works within range of team cores

const deploymentBlocks = {
    "tes-block-trihedron-deployment": "tes-trihedron",
    "tes-block-overseer-deployment": "tes-overseer",
    "tes-block-disintegrator-deployment": "tes-disintegrator"
};

const maxDeploymentRange = 30; // tiles from core

// Visual range indicator
Events.run(EventType.Trigger.draw, () => {
    // Only draw if player is building
    if (!Vars.control.input.isPlacing()) return;

    const selected = Vars.control.input.block;
    if (selected == null) return;

    // Check if selected block is a deployment block or restricted building
    const isDeploymentBlock = deploymentBlocks[selected.name] != null;
    const isRestrictedBlock = selected.name === "tes-spire-of-shards";

    if (!isDeploymentBlock && !isRestrictedBlock) return;

    const player = Vars.player;
    if (player == null) return;

    const team = player.team();
    const cores = Vars.state.teams.cores(team);
    if (cores.isEmpty()) return;

    // Draw range circles around each core
    cores.each(core => {
        const radiusInWorld = maxDeploymentRange * 8; // Convert tiles to world units

        // Draw outer circle (valid range)
        Draw.color(team.color);
        Draw.alpha(0.3);
        Lines.circle(core.x, core.y, radiusInWorld);

        // Draw thicker line for visibility
        Draw.alpha(0.5);
        Lines.stroke(2);
        Lines.circle(core.x, core.y, radiusInWorld);

        Draw.reset();
    });
});

Events.on(BlockBuildEndEvent, e => {
    // Skip if deconstructing
    if (e.breaking) return;

    const tile = e.tile;
    const block = tile.block();
    if (block == null) return;

    const blockName = block.name;
    const unitType = deploymentBlocks[blockName];
    const isSpireBlock = blockName === "tes-spire-of-shards";

    // Check if this is a deployment block or spire
    if (unitType == null && !isSpireBlock) return;

    print("Deployment block placed: " + blockName);

    const team = e.team;
    const tileX = tile.worldx();
    const tileY = tile.worldy();

    // Find nearest core
    const cores = Vars.state.teams.cores(team);
    if (cores.isEmpty()) {
        print("No cores found, removing block");
        tile.setNet(Blocks.air, team, 0);
        // No cores to refund to
        return;
    }

    // Calculate distance to nearest core
    let nearestDistance = 999999;
    cores.each(core => {
        const dist = Mathf.dst(tileX, tileY, core.x, core.y);
        if (dist < nearestDistance) {
            nearestDistance = dist;
        }
    });

    const distanceInTiles = nearestDistance / 8;

    print("Distance to core: " + distanceInTiles + " tiles");

    // Check if too far from core
    if (distanceInTiles > maxDeploymentRange) {
        print("TOO FAR! Removing block without spawning unit");

        // Refund resources to nearest core
        const nearestCore = Vars.state.teams.closestCore(tileX, tileY, team);
        if (nearestCore != null && block.requirements != null) {
            for (let i = 0; i < block.requirements.length; i++) {
                const stack = block.requirements[i];
                nearestCore.items.add(stack.item, stack.amount);
            }
            print("Resources refunded to core");
        }

        // Remove block
        tile.setNet(Blocks.air, team, 0);

        // Notify player
        if (e.unit != null && e.unit.isPlayer()) {
            e.unit.getPlayer().sendMessage("[scarlet]Deployment blocks can only be placed within " +
                maxDeploymentRange + " tiles of your core! Resources refunded.");
        }
        return;
    }

    // Within range - spawn unit (but not for spire blocks)
    if (isSpireBlock) {
        // Spire stays as a production building, no unit spawn
        print("Spire of Shards placed successfully within range");
        if (e.unit != null && e.unit.isPlayer()) {
            e.unit.getPlayer().sendMessage("[accent]Spire of Shards placed successfully!");
        }
        return;
    }

    print("Within range, spawning unit: " + unitType);

    // Get unit type
    const spawnType = Vars.content.getByName(ContentType.unit, unitType);
    if (spawnType == null) {
        print("ERROR: Unit type not found: " + unitType);
        tile.setNet(Blocks.air, team, 0);
        return;
    }

    // Spawn unit at block position
    const unit = spawnType.spawn(team, tileX, tileY);
    print("Unit spawned successfully!");

    // Remove the deployment block after spawning
    tile.setNet(Blocks.air, team, 0);

    // Notify player
    if (e.unit != null && e.unit.isPlayer()) {
        e.unit.getPlayer().sendMessage("[accent]Unit deployed: " + spawnType.localizedName);
    }
});
