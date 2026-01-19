// Passive resource generation system and Economy Display
// Adds 1 shard to every core every 5 seconds
// Displays shard income rate per second

let shardTimer = 0;
const shardInterval = 60 * 5; // 5 seconds (assuming 60 ticks/sec)

let fragmentTimer = 0;
const fragmentInterval = 60 * 10; // 10 seconds

// Economy tracking variables
let lastCheckTime = 0;
let historyObj = []; // usage: [ {time, count} ]
const historyWindow = 5.0; // seconds window for average
let currentRate = 0.0;
let table = null; // UI Table

Events.run(EventType.Trigger.update, () => {
    // Only run when game is active and not paused
    if (!Vars.state.isGame() || Vars.state.isPaused()) return;

    // --- GENERATION LOGIC ---
    // Get the item definitions once per update cycle
    const shardItem = Vars.content.getByName(ContentType.item, "tes-shard");
    const fragmentItem = Vars.content.getByName(ContentType.item, "tes-fragment");

    if (shardItem == null || fragmentItem == null) return; // Don't proceed if items aren't found

    // Update timers
    shardTimer += Time.delta;
    fragmentTimer += Time.delta;

    // Generate shards
    if (shardTimer >= shardInterval) {
        shardTimer = 0;

        // Add shards to all cores EXCEPT hexa-node
        Vars.state.teams.active.each(team => {
            const cores = Vars.state.teams.cores(team.team);
            cores.each(core => {
                // Skip shard generation for hexa-node
                if (core.block.name === "tes-hexa-node") {
                    return; // Skip this core
                }

                core.items.add(shardItem, 1);
            });
        });
    }

    // Generate fragments (only for hexa-node)
    if (fragmentTimer >= fragmentInterval) {
        fragmentTimer = 0;

        // Add fragments only to hexa-node cores
        Vars.state.teams.active.each(team => {
            const cores = Vars.state.teams.cores(team.team);
            cores.each(core => {
                // Only generate fragments for hexa-node
                if (core.block.name === "tes-hexa-node") {
                    core.items.add(fragmentItem, 1);
                }
            });
        });
    }

    // --- RATE CALCULATION ---
    // Run update every ~10 ticks to reduce overhead, or just every frame (lightweight)
    // Let's do every frame for smoothness but use time window

    const player = Vars.player;
    if (player == null || player.team() == null) return;

    const core = player.team().core();
    if (core == null) return;

    const shard = Vars.content.getByName(ContentType.item, "tes-shard");
    if (shard == null) return;

    const currentItems = core.items.get(shard);
    const currentTime = Time.time / 60.0; // time in seconds

    // Add current snapshot
    // Only add if time changed significant amount or limited buffer? 
    // Just add every 0.5s is enough
    if (currentTime - lastCheckTime > 0.5) {
        historyObj.push({ t: currentTime, c: currentItems });
        lastCheckTime = currentTime;

        // Remove old entries
        while (historyObj.length > 0 && historyObj[0].t < currentTime - historyWindow) {
            historyObj.shift();
        }

        // Calculate rate
        if (historyObj.length > 1) {
            const first = historyObj[0];
            const last = historyObj[historyObj.length - 1];

            const countDiff = last.c - first.c;
            const timeDiff = last.t - first.t;

            if (timeDiff > 0.001) {
                currentRate = countDiff / timeDiff;
            }
        } else {
            currentRate = 0;
        }
    }
});

// Rate Display Logic - Based on reference implementation
// Overrides the standard CoreItemsDisplay to show rates

// State for tracking resource rates
const history = {}; // Stores arrays of past resource counts
const ratesMap = {}; // Current calculated rates

// Snapshot every 5 seconds (300 ticks) to match generation cycle
const snapshotInterval = 300;
// Keep 3 snapshots: [T-10s, T-5s, Current]
// This allows calculating rate over the last 10 seconds or 5 seconds reliably
const windowSize = 3;

let lastUpdate = 0;
const myUsedItems = new Set(); // Track displayed items

Events.on(EventType.ClientLoadEvent, () => {
    // Wait for HUD to be available
    const hudGroup = Vars.ui.hudGroup;
    if (hudGroup == null) return;

    // ... code ...
    // Note: Re-injecting the whole block for context, targeting Lines 89-94


    // Find CoreItemsDisplay instance
    // Standard path: Vars.ui.hudfrag.coreItems is NOT exposed in legacy JS API directly usually, 
    // but in newer versions it might be. In 154.3 (v7?), Vars.ui.hudfrag.coreItems likely doesn't exist or is private.
    // So we search for it like before, but once found, we REPLACE its logic.

    let coreItemsTable = null;

    try {
        const targetClass = Packages.mindustry.ui.CoreItemsDisplay;
        // Breadth-first search
        let queue = [hudGroup];
        while (queue.length > 0) {
            let el = queue.shift();
            if (el instanceof targetClass) {
                coreItemsTable = el;
                break;
            }
            if (el instanceof Packages.arc.scene.Group) {
                let children = el.getChildren();
                for (let i = 0; i < children.size; i++) {
                    queue.push(children.get(i));
                }
            }
        }
    } catch (e) {
        print("Error finding CoreItemsDisplay: " + e);
        return;
    }

    if (coreItemsTable == null) return;

    // --- Custom Rebuild Function ---
    function myRebuild() {
        coreItemsTable.clear();
        coreItemsTable.background(Styles.black6);
        coreItemsTable.margin(4);

        const core = Vars.player.team().core();
        if (core == null) return;

        let i = 0;

        Vars.content.items().each(item => {
            if (myUsedItems.has(item.name)) {
                // Icon
                coreItemsTable.image(item.uiIcon).size(24).padRight(4).tooltip(t => t.background(Styles.black6).margin(4).add(item.localizedName).style(Styles.outlineLabel));

                // Amount Label
                coreItemsTable.label(() => {
                    return core ? UI.formatAmount(core.items.get(item)) : "0";
                }).padRight(4).minWidth(52).left().get();

                // Rate Label (Our Addition)
                coreItemsTable.label(() => {
                    const rate = ratesMap[item.name] || 0;

                    let rateStr = rate;
                    if (Math.abs(rate) < 10 && rate != 0) {
                        rateStr = Strings.fixed(rate, 1);
                    } else {
                        rateStr = Math.round(rate);
                    }

                    // Threshold reduced to 0.01 to prevent flickering for small rates like 0.2
                    if (Math.abs(rate) < 0.01) return "";

                    const sign = rate > 0 ? "+" : "";
                    // Use [yellow] which is standard Mindustry yellow
                    const color = "[yellow]";
                    return color + "(" + sign + rateStr + "/s)[]";
                }).padRight(8).left();

                if (++i % 4 == 0) coreItemsTable.row();
            }
        });
    }

    // --- Override Update Loop ---
    // This replaces the original update() logic of CoreItemsDisplay
    coreItemsTable.update(() => {
        const core = Vars.player.team().core();

        // 1. Rate Calculation Logic (Every 5 seconds)
        if (Time.time - lastUpdate >= snapshotInterval) {
            lastUpdate = Time.time;
            if (core) {
                Vars.content.items().each(item => {
                    const current = core.items.get(item);

                    // Initialize history queue
                    if (!history[item.name]) history[item.name] = [];

                    const queue = history[item.name];
                    queue.push(current);

                    if (queue.length > windowSize) queue.shift();

                    // Calculate rate
                    if (queue.length > 1) {
                        const oldest = queue[0];
                        const diff = current - oldest;
                        // Time span is strictly defined by number of intervals
                        // (queue.length - 1) intervals of 5 seconds each
                        const seconds = (queue.length - 1) * (snapshotInterval / 60.0);

                        if (seconds > 0) {
                            // Rate per second
                            ratesMap[item.name] = diff / seconds;
                        }
                    } else {
                        ratesMap[item.name] = 0;
                    }
                });
            }
        }

        // 2. Item Detection Logic (Rebuild Trigger)
        let changed = false;
        if (core) {
            Vars.content.items().each(item => {
                if (core.items.get(item) > 0 && !myUsedItems.has(item.name)) {
                    myUsedItems.add(item.name);
                    changed = true;
                }
            });
        }

        // Also check if we need to rebuild because we are empty (first load)
        if (coreItemsTable.getChildren().size == 0 && myUsedItems.size > 0) {
            changed = true;
        }

        // 3. Rebuild if needed
        if (changed) {
            myRebuild();
        }
    });
});
