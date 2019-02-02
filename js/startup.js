(function() {
    "use strict";
// ////////////////////////////////////////////////////////////////////////////
// UI Code
// ////////////////////////////////////////////////////////////////////////////
    function showSettings() {
        const overlay = document.getElementById("overlay");
        overlay.style.display = "block";
        const settingsDialog = document.getElementById("settings");
        settingsDialog.style.display = "block";

        document.getElementById("limitWidth").checked = document.getElementById("contentArea").classList.contains("limitWidth");
        document.getElementById("showEventDuration").checked = G.showEventDuration;
        document.getElementById("showOperationsCount").checked = G.showOperationsCount;
        document.getElementById("showGarbageCollectionDuration").checked = G.showGarbageCollectionDuration;
    };

    function closeSettings() {
        const overlay = document.getElementById("overlay");
        overlay.style.display = "none";
        const settingsDialog = document.getElementById("settings");
        settingsDialog.style.display = "none";

        const results = {
            limitWidth: document.getElementById("limitWidth").checked,
            showEventDuration: document.getElementById("showEventDuration").checked,
            showOperationsCount: document.getElementById("showOperationsCount").checked,
            showGarbageCollectionDuration: document.getElementById("showGarbageCollectionDuration").checked,
        };
        localStorage["gtrpge_options"] = JSON.stringify(results);
        applySettings();
    }

    function applySettings() {
        const rawResults = localStorage.getItem("gtrpge_options");
        if (rawResults) {
            const results = JSON.parse(rawResults);
            document.getElementById("contentArea").classList.toggle("limitWidth", results.limitWidth);
            G.showEventDuration = results.showEventDuration;
            G.showOperationsCount = results.showOperationsCount;
            G.showGarbageCollectionDuration = results.showGarbageCollectionDuration;
        }
    }

    function showCredits() {
        const overlay = document.getElementById("overlay");
        overlay.style.display = "block";
        const settingsDialog = document.getElementById("creditsWindow");
        settingsDialog.style.display = "block";
    };

    function closeCredits() {
        const overlay = document.getElementById("overlay");
        overlay.style.display = "none";
        const settingsDialog = document.getElementById("creditsWindow");
        settingsDialog.style.display = "none";
    }

// ////////////////////////////////////////////////////////////////////////////
// Engine Startup Code
// ////////////////////////////////////////////////////////////////////////////
    if (typeof QUnit === "undefined") {
        window.addEventListener("load", function() {
            G.eOutput = document.getElementById("text");
            G.eTopLeft = document.getElementById("top-left");
            G.eTopRight = document.getElementById("top-right");
            G.eBottomLeft = document.getElementById("bottom-left");
            G.eBottomRight = document.getElementById("bottom-right");
            G.eButtons = document.getElementById("bottom-centre");

            if (!G.eOutput || !G.eTopLeft || !G.eTopRight || !G.eButtons ||
                    !G.eBottomLeft || !G.eBottomRight) {
                this.console.error("Failed to find all display regions.");
                return;
            }

            const notImplemented = function() {
                alert("Not implemented yet.");
            }

            document.getElementById("settingsButton")
                .addEventListener("click", showSettings);
            document.getElementById("closeSettings")
                .addEventListener("click", closeSettings);
            document.getElementById("creditsButton")
                .addEventListener("click", showCredits);
            document.getElementById("closeCredits")
                .addEventListener("click", closeCredits);
            document.getElementById("newButton")
                .addEventListener("click", notImplemented);
            document.getElementById("loadButton")
                .addEventListener("click", notImplemented);
            document.getElementById("saveButton")
                .addEventListener("click", notImplemented);

            applySettings();

            var loadGameData = new XMLHttpRequest();
            loadGameData.addEventListener("load", G.parseGameFile);
            loadGameData.addEventListener("error", G.failedToLoadGameData);
            loadGameData.addEventListener("abort", G.failedToLoadGameData);
            loadGameData.open("GET", "./game.bin");
            loadGameData.responseType = "arraybuffer";
            loadGameData.send();
        })

        G.failedToLoadGameData = function failedToLoadGameData(event) {
            G.eOutput.innerHTML += "<div class='error'>[Failed to load game data.]</div>";
        }
    }

// ////////////////////////////////////////////////////////////////////////////
// Game file parser
// ////////////////////////////////////////////////////////////////////////////
    G.parseGameFile = function parseGameFile(event) {
        const rawSource = event.target.response;
        const gamedataSrc = new DataView(rawSource);


        ///////////////////////////////////////////////////////////////////////
        // Read header data from datafile
        G.magicNumber = gamedataSrc.getUint32(0, true);
        G.formatVersion = gamedataSrc.getUint32(4, true);
        G.mainFunction = gamedataSrc.getUint32(8, true);
        G.propInternalName = gamedataSrc.getUint8(12);
        G.propIdent = gamedataSrc.getUint8(13);
        G.propSave = gamedataSrc.getUint8(14);
        G.propLoad = gamedataSrc.getUint8(15);

        ///////////////////////////////////////////////////////////////////////
        // Read strings from datafile
        var filePos = 64;
        G.stringCount = gamedataSrc.getUint32(filePos, true);
        filePos += 4;
        const decoder = new TextDecoder('utf8');
        for (var i = 0; i < G.stringCount; ++i) {
            const stringLength = gamedataSrc.getUint16(filePos, true);
            filePos += 2;
            const rawStringData = new Uint8Array(rawSource, filePos,
                                                 stringLength);
            filePos += stringLength;
            G.strings.push({data:decoder.decode(rawStringData)});
        }

        ///////////////////////////////////////////////////////////////////////
        // Read lists from datafile
        G.listCount = gamedataSrc.getUint32(filePos, true);
        filePos += 4;
        G.lists.push(undefined);
        for (var i = 0; i < G.listCount; ++i) {
            const thisList = [];
            const listSize = gamedataSrc.getUint16(filePos, true);
            filePos += 2;
            for (var j = 0; j < listSize; ++j) {
                const itemType = gamedataSrc.getUint8(filePos, true);
                filePos += 1;
                const itemValue = gamedataSrc.getInt32(filePos, true);
                filePos += 4;
                thisList.push(new G.Value(itemType, itemValue));
            }
            G.lists.push({data:thisList});
        }

        ///////////////////////////////////////////////////////////////////////
        // Read maps from datafile
        G.mapCount = gamedataSrc.getUint32(filePos, true);
        filePos += 4;
        G.maps.push(undefined);
        for (var i = 0; i < G.mapCount; ++i) {
            const thisMap = {};
            const mapSize = gamedataSrc.getUint16(filePos, true);
            filePos += 2;
            for (var j = 0; j < mapSize; ++j) {
                const item1Type = gamedataSrc.getUint8(filePos, true);
                filePos += 1;
                const item1Value = gamedataSrc.getInt32(filePos, true);
                filePos += 4;
                const valueOne = new G.Value(item1Type, item1Value);

                const item2Type = gamedataSrc.getUint8(filePos, true);
                filePos += 1;
                const item2Value = gamedataSrc.getInt32(filePos, true);
                filePos += 4;
                const valueTwo = new G.Value(item2Type, item2Value);

                thisMap[valueOne.toKey()] = valueTwo;
            }
            G.maps.push({data:thisMap});
        }

        ///////////////////////////////////////////////////////////////////////
        // Read game objects from datafile
        G.objectCount = gamedataSrc.getUint32(filePos, true);
        filePos += 4;
        G.objects.push(undefined);
        for (var i = 0; i < G.objectCount; ++i) {
            const thisObject = {};
            // thisObject.key = gamedataSrc.getUint32(filePos, true);
            const objectSize = gamedataSrc.getUint16(filePos, true);
            filePos += 2;
            for (var j = 0; j < objectSize; ++j) {
                const propId = gamedataSrc.getUint16(filePos, true);
                filePos += 2;
                const itemType = gamedataSrc.getUint8(filePos, true);
                filePos += 1;
                const itemValue = gamedataSrc.getInt32(filePos, true);
                filePos += 4;
                thisObject[propId] = new G.Value(itemType, itemValue);
            }
            G.objects.push({data:thisObject});
        }

        ///////////////////////////////////////////////////////////////////////
        // Read function headers from datafile
        G.functionCount = gamedataSrc.getUint32(filePos, true);
        filePos += 4;
        G.functions.push(undefined);
        for (var i = 0; i < G.functionCount; ++i) {
            const argCount = gamedataSrc.getUint16(filePos, true);
            filePos += 2;
            const localCount = gamedataSrc.getUint16(filePos, true);
            filePos += 2;
            const codePosition = gamedataSrc.getUint32(filePos, true);
            filePos += 4;
            G.functions.push({data: [argCount, localCount, codePosition]});
        }

        ///////////////////////////////////////////////////////////////////////
        // Read bytecode section from datafile
        G.bytecodeSize = gamedataSrc.getInt32(filePos, true);
        filePos += 4;
        G.bytecodeBuffer = rawSource.slice(filePos);
        G.bytecode = new DataView(G.bytecodeBuffer);

        G.noneValue = new G.Value(G.ValueType.None, 0);
        document.title = "Untitled Game";
        window.addEventListener("keydown", G.keyPressHandler);
        G.gameLoaded = true;
        G.doEvent(G.mainFunction);
    }

})();