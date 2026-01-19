// Deployment system - spawns units when deployment blocks are placed
// Only works within range of team cores

const deploymentBlocks = {
    "tes-block-trihedron-deployment": "tes-trihedron",
    "tes-block-overseer-deployment": "tes-overseer",
    "tes-block-disintegrator-deployment": "tes-disintegrator",
    "tes-block-circlet-deployment": "tes-circlet",
    "tes-block-quartermaster-deployment": "tes-quartermaster"
};

const maxDeploymentRange = 30; // tiles from core
const hexaNodeRange = 10; // tiles from hexa node

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
        let radiusTiles = maxDeploymentRange;
        let shouldDraw = true;

        if (core.block.name === "tes-hexa-node") {
            radiusTiles = hexaNodeRange;
            // Only draw for Hexa Node if placing Trihedron, Circlet deployment or Spire
            if (selected.name !== "tes-block-trihedron-deployment" &&
                selected.name !== "tes-block-circlet-deployment" &&
                !isRestrictedBlock) {
                shouldDraw = false;
            }
        }

        if (shouldDraw) {
            const radiusInWorld = radiusTiles * 8; // Convert tiles to world units

            // Draw outer circle (valid range)
            Draw.color(team.color);
            Draw.alpha(0.3);
            Lines.circle(core.x, core.y, radiusInWorld);

            // Draw thicker line for visibility
            Draw.alpha(0.5);
            Lines.stroke(2);
            Lines.circle(core.x, core.y, radiusInWorld);

            Draw.reset();
        }
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

    const team = e.team;
    const tileX = tile.worldx();
    const tileY = tile.worldy();

    // Find nearest core
    const nearestCore = Vars.state.teams.closestCore(tileX, tileY, team);

    if (nearestCore == null) {
        print("No core found, removing block");
        tile.setNet(Blocks.air, team, 0);
        return;
    }

    const dist = Mathf.dst(tileX, tileY, nearestCore.x, nearestCore.y);
    const distanceInTiles = dist / 8;

    // Determine allowed range based on core type
    let allowedRange = maxDeploymentRange;
    if (nearestCore.block.name === "tes-hexa-node") {
        allowedRange = hexaNodeRange;
    }

    print("Deployment: Block=" + blockName + " Core=" + nearestCore.block.name + " Dist=" + distanceInTiles + " Allowed=" + allowedRange);

    // Check range
    if (distanceInTiles > allowedRange) {
        print("TOO FAR! Removing block without spawning unit");

        // Refund resources to nearest core
        if (block.requirements != null) {
            for (let i = 0; i < block.requirements.length; i++) {
                const stack = block.requirements[i];
                nearestCore.items.add(stack.item, stack.amount);
            }
        }

        // Remove block
        tile.setNet(Blocks.air, team, 0);

        // Notify player
        if (e.unit != null && e.unit.isPlayer()) {
            e.unit.getPlayer().sendMessage("[scarlet]Too far! Max range to core: " + allowedRange + " tiles.");
        }
        return;
    }

    // Check specific restrictions for Hexa Node
    if (nearestCore.block.name === "tes-hexa-node") {
        // Hexa Node can ONLY deploy Trihedron and Circlet
        if (unitType !== "tes-trihedron" && unitType !== "tes-circlet" && !isSpireBlock) {
            print("RESTRICTION: Hexa Node can only deploy Trihedrons and Circlets, not " + unitType);

            // Refund
            if (block.requirements != null) {
                for (let i = 0; i < block.requirements.length; i++) {
                    const stack = block.requirements[i];
                    nearestCore.items.add(stack.item, stack.amount);
                }
            }

            tile.setNet(Blocks.air, team, 0);

            if (e.unit != null && e.unit.isPlayer()) {
                e.unit.getPlayer().sendMessage("[scarlet]Hexa Node can only deploy Trihedrons and Circlets! Resources refunded.");
            }
            return;
        }
    }

    // Check specific restrictions for Nucleus
    if (nearestCore.block.name === "tes-nucleus") {
        // Nucleus CANNOT deploy Trihedron or Circlet (they're for hexa-node)
        if (unitType === "tes-trihedron" || unitType === "tes-circlet") {
            print("RESTRICTION: Nucleus cannot deploy " + unitType);

            // Refund
            if (block.requirements != null) {
                for (let i = 0; i < block.requirements.length; i++) {
                    const stack = block.requirements[i];
                    nearestCore.items.add(stack.item, stack.amount);
                }
            }

            tile.setNet(Blocks.air, team, 0);

            if (e.unit != null && e.unit.isPlayer()) {
                e.unit.getPlayer().sendMessage("[scarlet]Nucleus cannot deploy Trihedrons or Circlets! Resources refunded.");
            }
            return;
        }
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
