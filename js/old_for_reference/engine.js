
const G = {
    UI: {
        inDialog: false,
    },
    noneValue: undefined,
    strings: {},
    vocab: [],
    objects: {},
    lists: {},
    maps: {},
    functions: {},
    raw: {
        objects: [],
        lists: [],
        maps: []
    },

    eOutput: undefined,
    eTopLeft: undefined,
    eTopRight: undefined,
    eBottomLeft: undefined,
    eBottomRight: undefined,
    eButtons: undefined,

    textBuffer: [],

    optionFunction: undefined,
    optionType: -1,
    options: [],
    nextIP: -1,
    gameLoaded: false,

    lastNode: "",
    inPage: false,
    pages: {},
    stored: {
        textBuffer: undefined,
        options: undefined,
    },

    garbageCollectionFrequency: 5,
    eventCount: 0,
    eventStartTime: 0,
    operations: 0,
    callStack: undefined,

    showEventDuration: true,
    showOperationsCount: true,
    showGarbageCollectionDuration: true,
    eventIsUpdateOnly: false,

    gamenameId: -1,
    authorId: -1,
    versionId: -1,
    gameId: -1,
    buildNumber: -1,
    nextIdent: 1,

    propInternalName: 1,
    propIdent: 2,
    propParent: 3,
    extraValue: undefined,
    gameDir: "./games/"
};

(function() {
    "use strict";

// ////////////////////////////////////////////////////////////////////////////
// ENum Values
// ////////////////////////////////////////////////////////////////////////////
    G.StartupSource = {
        NewGame:        0,
        Restore:        1,
    }
    G.Settings = {
        InfobarLeft:    1,
        InfobarRight:   2,
        InfobarFooter:  3,
        Title:          4,
    };
    Object.freeze(G.Settings);

    G.ValueType = {
        None:         0,
        Integer:      1,
        String:       2,
        List:         3,
        Map:          4,
        Function:     5,
        Node:         5,
        Object:       6,
        Property:     7,
        TypeId:       8,
        JumpTarget:   9,
        VarRef:       10,
        Vocab:        11,
        LocalVar:     15,
        MaxType:      15,
        Any:          32,
    };
    Object.freeze(G.ValueType);

    G.typeNames = [
        "None",         // 0
        "Integer",      // 1
        "String",       // 2
        "List",         // 3
        "Map",          // 4
        "Function",     // 5
        "Object",       // 6
        "Property",     // 7
        "TypeId",       // 8
        "JumpTarget",   // 9
        "Reference",    // 10
        "Vocab",        // 11
        "(unused)",     // 12
        "(unused)",     // 13
        "(unused)",     // 14
        "LocalVar",     // 15
    ];
    Object.freeze(G.typeNames);

    G.OptionType = {
        MenuItem:   0,
        KeyInput:   1,
        LineInput:  2,
    };
    Object.freeze(G.OptionType);


// ////////////////////////////////////////////////////////////////////////////
// Option class
// ////////////////////////////////////////////////////////////////////////////
    G.Option = class Option {
        constructor(displayText, value, extraValue, hotkey) {
            this.displayText = displayText;
            this.value = value;
            this.extra = extraValue || G.noneValue;
            if (hotkey && hotkey.type === G.ValueType.Integer) {
                this.hotkey = hotkey.value;
            } else {
                this.hotkey = 0;
            }
        }

        toString() {
            const dumpStr = [ "(option: \"", this.displayText,
                            "\" -> ", this.value, ")" ];
            return dumpStr.join("");
        }
    }

// ////////////////////////////////////////////////////////////////////////////
// RuntimeError class
// ////////////////////////////////////////////////////////////////////////////
    G.RuntimeError = class RuntimeError {
        constructor(message) {
            this.message = message;
        }

        toString() {
            return "RuntimeError: " + this.message;
        }
    }


// ////////////////////////////////////////////////////////////////////////////
// Stack class
// ////////////////////////////////////////////////////////////////////////////
    G.Stack = class Stack {
        constructor() {
            this.stack = [];
        }

        get length() {
            return this.stack.length;
        }

        toString() {
            const dumpStr = ["STACK:\n    Size:", this.stack.length, "\n"];
            for (var i = 0; i < this.stack.length; ++i) {
                const item = this.stack[i];
                dumpStr.push("    ");
                dumpStr.push(item);
                dumpStr.push("\n");
            };
            dumpStr.push("===");
            return dumpStr.join("");
        }
        peek(position) {
            if (position < 0 || position >= this.stack.length) {
                throw new G.RuntimeError("Invalid stack position.");
            }
            return this.stack[this.stack.length - 1 - position];
        }
        pop() {
            if (this.stack.length <= 0) {
                throw new G.RuntimeError("Stack underflow.");
            }
            return this.stack.pop();
        }
        push(value) {
            if (!(value instanceof G.Value)) {
                if (typeof value === "number") {
                    value = new G.Value(G.ValueType.Integer, value);
                } else if (typeof value === "string") {
                    value = new G.Value(G.ValueType.String, value);
                } else {
                    throw new G.RuntimeError("Bad Stack values; found "
                                             + typeof value + ".");
                }
            }
            this.stack.push(value);
        }
        top() {
            if (this.stack.length <= 0) {
                throw new G.RuntimeError("Stack underflow.");
            }
            return this.stack[this.stack.length - 1];
        }
    }


// ////////////////////////////////////////////////////////////////////////////
// CallStack class
// ////////////////////////////////////////////////////////////////////////////
    G.CallStack = class CallStack {
        constructor() {
            this.frames = [];
        }

        get frameCount() {
            return this.frames.length;
        }

        toString() {
            const callStr = [];
            callStr.push("\nCALL STACK:\n");
            for (var i = 0; i < this.frameCount; ++i) {
                const line = this.frames[i];
                const localStr = [];
                const stackStr = [];
                line.locals.forEach(function(value) {
                    localStr.push(value.toString());
                });
                line.stack.stack.forEach(function(value) {
                    stackStr.push(value.toString());
                });
                callStr.push("  ");
                callStr.push(i);
                callStr.push(" FunctionID:");
                callStr.push(line.functionId);
                if (line.functionId < G.functions.length) {
                    const value = new G.Value(G.ValueType.Function, line.functionId);
                    const sourceStr = G.getSource(value);
                    callStr.push(" @ ");
                    callStr.push(G.getString(sourceStr));
                } else {
                    callStr.push(" (invalid)");
                }
                callStr.push("\n    LOCALS:[");
                callStr.push(localStr.join(", "));
                callStr.push("]\n    STACK:[");
                callStr.push(stackStr.join(", "));
                callStr.push("]\n");
            }
            return callStr.join("");
        }

        get base() {
            return this.topFrame().baseAddress;
        }
        get id() {
            return this.topFrame().functionId;
        }
        get length() {
            return this.frames.length;
        }
        get locals() {
            return this.topFrame().locals;
        }
        get returnAddress() {
            return this.topFrame().returnAddress;
        }
        get returnValue() {
            if (this.stack.length > 0)
                return this.evaluate(this.stack.pop());
            else
                return G.noneValue;
        }
        get stack() {
            return this.topFrame().stack;
        }
        get stackSize() {
            return this.topFrame().stack.length;
        }

        evaluate(value) {
            while (value.type === G.ValueType.LocalVar) {
                if (value.value < 0 || value.value > this.locals.length) {
                    throw new G.RuntimeError("evaluate: Invalid local number " + value.value + ".");
                }
                value = this.locals[value.value];
            }
            return value;
        }

        buildLocals(argList, maxArgs, totalLocals) {
            for (var i = 0; i < totalLocals; ++i) {
                if (i < argList.length && i < maxArgs) {
                    this.locals.push(argList[i]);
                } else {
                    this.locals.push(G.noneValue);
                }
            }
        }
        get(position) {
            if (position < 0 || position > this.locals.length) {
                throw new G.RuntimeError("Tried to read invalid local number " + position + ".");
            }
            return this.locals[position];
        }
        set(position, newValue) {
            newValue = newValue || G.noneValue;
            if (position < 0 || position > this.locals.length) {
                throw new G.RuntimeError("Tried to update invalid local number " + position + ".");
            }
            this.locals[position] = newValue;
        }

        peek(pos) {
            pos = pos || 0;
            if (this.frames.length === 0) {
                throw new G.RuntimeError("Tried to pop with empty callstack.");
            }
            if (pos < 0 || pos >= this.stackSize) {
                throw new G.RuntimeError("Tried to peek invalid stack position.");
            }
            const result = this.stack.stack[this.stackSize - 1 - pos];
            return result;
        }
        pop() {
            if (this.frames.length === 0) {
                throw new G.RuntimeError("Tried to pop with empty callstack.");
            }
            const result = this.popRaw();
            if (result.type == G.ValueType.LocalVar) {
                return this.evaluate(result);
            } else {
                return result;
            }
        }
        popRaw() {
            if (this.frames.length === 0) {
                throw new G.RuntimeError("Tried to pop with empty callstack.");
            }
            return this.stack.pop();
        }
        push(value) {
            if (this.frames.length === 0) {
                throw new G.RuntimeError("Tried to pop with empty callstack.");
            }
            this.stack.push(value);
        }

        popFrame() {
            if (this.frames.length === 0) {
                throw new G.RuntimeError("Tried to pop frame from empty callstack.");
            }
            return this.frames.pop()
        }
        pushFrame(functionId, baseAddress, returnAddress) {
            this.frames.push(new G.CallStackFrame(functionId, baseAddress, returnAddress));
        }
        topFrame() {
            if (this.frames.length === 0) {
                throw new G.RuntimeError("Tried to get top frame of empty callstack.");
            }
            return this.frames[this.frames.length - 1];
        }

    }
    G.CallStackFrame = class CallStackFrame {
        constructor(functionId, baseAddress, returnAddress) {
            this.functionId = functionId;
            this.baseAddress = baseAddress;
            this.returnAddress = returnAddress;
            this.stack = new G.Stack();
            this.locals = [];
        }

    }

// ////////////////////////////////////////////////////////////////////////////
// Value class
// ////////////////////////////////////////////////////////////////////////////
    G.Value = class Value {
        constructor(type, value) {
            if (type == undefined || typeof type !== "number")
                throw new G.RuntimeError("Value must have type, but found "
                                         + typeof type);
            else if (type < 0 || type > G.ValueType.MaxType)
                throw new G.RuntimeError("Value must have valid type; found "
                                         + type);
            if (value == undefined)
                throw new G.RuntimeError("Value must have value");
            this.type = type;
            this.value = value;
            this.selfobj = G.noneValue;
        }

        get type() {
            return this.mType;
        }
        get value() {
            return this.mValue;
        }
        set type(newType) {
            this.mType = newType;
        }
        set value(newValue) {
            this.mValue = newValue;
        }

        clone() {
            return new G.Value(this.mType, this.mValue, this.selfobj);
        }
        isFalse() {
            return !this.isTrue();
        }
        isTrue() {
            if (this.type === G.ValueType.None || this.value === 0) {
                return false;
            } else {
                return true;
            }
        }
        forbidType(type) {
            if (this.type === type) {
                throw new G.RuntimeError(
                    G.typeNames[type] + " is forbidden here.");
            }
        }
        requireType(type) {
            if (this.type !== type) {
                throw new G.RuntimeError(
                    "Expected " + G.typeNames[type] + ", but found " +
                    G.typeNames[this.type] + ".");
            }
        }
        requireEitherType(type1, type2) {
            if (this.type !== type1 && this.type !== type2) {
                throw new G.RuntimeError(
                    "Expected " + G.typeNames[type1] + " or " + G.typeNames[type2] +
                    ", but found " +
                    G.typeNames[this.type] + ".");
            }
        }
        toKey() {
            return this.mType + ":" + this.mValue;
        }
        toString() {
            const dumpStr = [ "<" ]
            if (this.type < 0 || this.type > G.ValueType.MaxType) {
                dumpStr.push("invalid");
            } else {
                dumpStr.push(G.typeNames[this.type]);
            }
            dumpStr.push(": ");
            dumpStr.push(this.value);
            dumpStr.push(">");
            return dumpStr.join("");
        }
    }


// ////////////////////////////////////////////////////////////////////////////
// Core Engine Functions
// ////////////////////////////////////////////////////////////////////////////
    G.addPage = function addPage(pageInfo) {
        const pageId = pageInfo.title.value;
        if (G.pages.hasOwnProperty(pageId)) {
            throw new G.RuntimeError("Tried to add page \"" + G.getString(pageId) + "\" but page already exists.");
        }
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("pageButton");
        button.textContent = G.getString(pageId);
        button.title = G.getString(pageId) + " (" + String.fromCodePoint(pageInfo.hotkey.value) + ")";
        button.addEventListener("click", function() {
            G.doPage(pageId);
        });
        G.eButtons.appendChild(button);
        pageInfo.button = button;
        G.pages[pageId] = pageInfo;
    }

    G.asString = function asString(aValue) {
        if (!(aValue instanceof G.Value)) {
            throw new G.RuntimeError("Called asString() on non-value.");
        }
        switch(aValue.type) {
            case G.ValueType.String:
                return G.getString(aValue.value);
            case G.ValueType.Vocab:
                return G.getVocab(aValue.value);
            case G.ValueType.Integer:
                return ""+aValue.value;
            default:
                var text = "<" + G.typeNames[aValue.type];
                if (aValue.type != G.ValueType.None) {
                    text += " " + aValue.value;
                }
                text += ">";
                return text;
        }
    }

    G.clearOutput = function clearOutput() {
        while (G.eOutput.childElementCount > 0) {
            G.eOutput.removeChild(G.eOutput.firstChild);
        }
    }
    G.gc = {};
    G.gc.markObject = function markObject(object, xtra) {
        if (!object || object.marked || !object.data) return;
        object.marked = true;
        const keys = Object.keys(object.data);
        keys.forEach(function(key) {
            G.gc.markValue(object.data[key]);
        });
    }
    G.gc.markList = function markList(list) {
        if (!list || list.marked || !list.data) return;
        list.marked = true;
        list.data.forEach(function(value) {
            G.gc.markValue(value);
        });
    }
    G.gc.markMap = function markMap(map) {
        if (!map || map.marked || !map.data) return;
        map.marked = true;

        const rawKeys = Object.keys(map.data);
        rawKeys.forEach(function(key) {
            const keySep = key.indexOf(":");
            const keyType = +key.substring(0, keySep);
            const keyValue = +key.substring(keySep + 1);
            const value = new G.Value(keyType, keyValue);
            G.gc.markValue(value);
            G.gc.markValue(map.data[key]);
        })
    }
    G.gc.markString = function markString(string) {
        if (!string || string.marked || string.data == undefined) return;
        string.marked = true;
    }
    G.gc.markValue = function markValue(what) {
        if (!what || !(what instanceof G.Value)) return;
        switch(what.type) {
            case G.ValueType.String:
                G.gc.markString(G.strings[what.value]);
                break;
            case G.ValueType.Object:
                G.gc.markObject(G.objects[what.value]);
                break;
            case G.ValueType.List:
                G.gc.markList(G.lists[what.value]);
                break;
            case G.ValueType.Map:
                G.gc.markMap(G.maps[what.value]);
                break;
            case G.ValueType.None:
            case G.ValueType.Integer:
            case G.ValueType.Function:
            case G.ValueType.Property:
            case G.ValueType.TypeId:
            case G.ValueType.JumpTarget:
            case G.ValueType.VarRef:
            case G.ValueType.LocalVar:
            case G.ValueType.Vocab:
                // no need to mark
                break;
            default:
                console.error("Found unknown type ", what.type, " during garbage collection.");
        }
        what.marked = true;
    }
    G.gc.collect = function collect(theList) {
        const ids = Object.keys(theList);
        let count = 0;
        ids.forEach(function (id) {
            if (theList[id].static) return;
            if (theList[id].marked) return;
            delete theList[id];
            ++count;
        });
        // let count = 0;
        // for (var i = start; i < theList.length; ++i) {
        //     if (!theList[i] || theList[i].data == undefined) {
        //         continue;
        //     }
        //     if (!theList[i].marked) {
        //         theList[i] = undefined;
        //         ++count;
        //     }
        // }
        return count;
    }
    G.collectGarbage = function collectGarbage() {
        ////////////////////////////////////////
        // GET EXISTING IDENT LISTS
        const listIds = Object.keys(G.lists);
        const mapIds = Object.keys(G.maps);
        const objectIds = Object.keys(G.objects);
        const stringIds = Object.keys(G.strings);

        ////////////////////////////////////////
        // UNMARK ALL
        listIds.forEach(function(ident)   { const item = G.lists[ident];    if (item) item.marked = false; });
        mapIds.forEach(function(ident)    { const item = G.maps[ident];     if (item) item.marked = false; });
        objectIds.forEach(function(ident) { const item = G.objects[ident];  if (item) item.marked = false; });
        stringIds.forEach(function(ident) { const item = G.strings[ident];  if (item) item.marked = false; });

        ////////////////////////////////////////
        // MARK ACCESSABLE
        for (var i = 0; i <= G.objectCount; ++i)    G.gc.markObject(G.objects[i]);
        for (var i = 0; i <= G.listCount; ++i)      G.gc.markList(G.lists[i]);
        for (var i = 0; i <= G.mapCount; ++i)       G.gc.markMap(G.maps[i]);
        G.options.forEach(function(option) {
            G.gc.markValue(option.displayText);
            G.gc.markValue(option.extra);
            G.gc.markValue(option.value);
        });
        G.callStack.frames.forEach(function(callFrame) {
            callFrame.stack.stack.forEach(function(stackItem) {
                G.gc.markValue(stackItem);
            });
            callFrame.locals.forEach(function(localItem) {
                G.gc.markValue(localItem);
            });
        });

        ////////////////////////////////////////
        // COLLECTING
        let count = 0;
        count += G.gc.collect(G.objects,  G.objectCount + 1);
        count += G.gc.collect(G.lists,    G.listCount + 1);
        count += G.gc.collect(G.maps,     G.mapCount + 1);
        count += G.gc.collect(G.strings,  G.stringCount);

        // ////////////////////////////////////////
        // // TRIMMING
        // while (G.objects.length > 0
        //         && G.objects[G.objects.length - 1] == undefined) {
        //     G.objects.pop();
        // }
        // while (G.maps.length > 0
        //         && G.maps[G.maps.length - 1] == undefined) {
        //     G.maps.pop();
        // }
        // while (G.strings.length > 0
        //         && G.strings[G.strings.length - 1] == undefined) {
        //     G.strings.pop();
        // }
        // while (G.lists.length > 0
        //         && G.lists[G.lists.length - 1] == undefined) {
        //     G.lists.pop();
        // }

        return count;
    }

    G.delPage = function delPage(pageId) {
        if (G.pages.hasOwnProperty(pageId.value)) {
            G.eButtons.removeChild(G.pages[pageId.value].button);
            delete G.pages[pageId.value];
        }
    }

    G.doCompare = function doCompare(left, right) {
        if (left.type !== right.type) {
            return 1;
        } else {
            switch(right.type) {
                case G.ValueType.Integer:
                    return left.value - right.value;
                case G.ValueType.None:
                    return 0;
                default:
                    return (right.value === left.value) ? 0 : 1;
            }
        }
    }

    G.doEvent = function doEvent(argsList) {
        if (G.inPage) {
            G.doPage(G.inPage, argsList, functionId);
            return;
        }

        let updateOnly = false;
        if (!G.eventIsUpdateOnly) {
            G.optionType = -1;
            if (G.eventStartTime <= 0)
                G.eventStartTime = performance.now();
            G.options = [];
            G.textBuffer = [];
        }

        let errorDiv = undefined;
        try {
            if (G.resumeExec(argsList) === 1) {
                updateOnly = true;
            }
        } catch (error) {
            if (!(error instanceof G.RuntimeError))    throw error;
            errorDiv = document.createElement("pre");
            errorDiv.classList.add("error");
            const errorMessage = [];

            if (G.callStack) {
                errorMessage.push(G.callStack.toString());
            }
            if (G.stack) {
                errorMessage.push("\n");
                errorMessage.push(G.stack.toString());
            }

            errorDiv.textContent = errorMessage.join("");
            const fatalErrorText = document.createElement("span");
            fatalErrorText.classList.add("errorTitle");
            fatalErrorText.textContent = error.toString() + "\n";
            errorDiv.insertBefore(fatalErrorText, errorDiv.firstChild);
        }

        const end = performance.now();
        if (updateOnly) {
            const runtime = Math.round((end - G.eventStartTime) * 1000) / 1000000;
            G.doEventUpdateStatus(runtime, G.operations, -1, 0);
            setTimeout(doEvent, 0);
            G.eventIsUpdateOnly = true;
            return;
        }
        G.eventIsUpdateOnly = false;

        G.doOutput(errorDiv);
        ++G.eventCount;
        const runGC = G.eventCount % G.garbageCollectionFrequency ===  0;
        const gcStart = performance.now();
        let gcCollected = 0;
        if (runGC) {
            gcCollected = G.collectGarbage();
        }
        const gcEnd = performance.now();

        const eventRuntime = Math.round((end - G.eventStartTime) * 1000) / 1000000;
        const gcRuntime    = Math.round((gcEnd - gcStart) * 1000) / 1000000;
        G.doEventUpdateStatus(eventRuntime, G.operations, runGC ? gcRuntime : -1, gcCollected);
        G.eventStartTime = 0;
    }

    G.doEventUpdateStatus = function doEventUpdateStatus(eventRuntime, operations, gcRuntime, gcCollected) {
        const systemInfo = [];
        if (G.showEventDuration) {
            systemInfo.push("Runtime: " + eventRuntime + "s");
        }
        if (G.showOperationsCount) {
            systemInfo.push(operations.toLocaleString() + " opcodes");
        }
        if (gcRuntime >= 0 && G.showGarbageCollectionDuration) {
            systemInfo.push("GC: " + gcRuntime + "s");
            systemInfo.push(gcCollected + " collected");
        }
        G.eBottomLeft.textContent = systemInfo.join("; ");
    }

    G.doOutput = function doOutput(errorMessage) {
        let line = G.textBuffer.join("").replace(/&/g, "&amp;");
        line = line.replace(/</g, "&lt;");
        line = line.replace(/>/g, "&gt;");

        const result = G.formatter(line);
        if (result.errors.length > 0) {
            if (!errorMessage) {
                errorMessage = document.createElement("div");
                errorMessage.classList.add("error");
            }
            const errText = ["<span class='errorTitle'>Formatting Errors Occured</span><br>"];
            result.errors.forEach(function(err) {
                errText.push(err, "<br>");
            });
            errorMessage.innerHTML += errText.join("");
        }

        const nextDiv = document.createElement("div");
        nextDiv.classList.add("sceneNode");
        nextDiv.innerHTML = result.text;
        G.eOutput.appendChild(nextDiv);

        if (errorMessage) {
            G.eOutput.appendChild(errorMessage);
            errorMessage.scrollIntoView();
        } else {
            G.showOptions();
            nextDiv.scrollIntoView();
        }
    }

    G.doPage = function doPage(pageId, argsList, fromEvent) {
        if (G.inPage && G.inPage !== pageId) return;
        if (!G.inPage) {
            G.stored.textBuffer = G.textBuffer;
            G.stored.options = G.options;
            G.stored.optionType = G.optionType;
            G.stored.optionFunction = G.optionFunction;
            G.inPage = pageId;
        }
        G.options = [];
        G.textBuffer = [];
        while (G.eOutput.childElementCount > 0) {
            G.eOutput.removeChild(G.eOutput.firstChild);
        }
        G.textBuffer.push("# ");
        G.textBuffer.push(G.getString(pageId));
        G.textBuffer.push("\n");
        if (fromEvent) {
            G.resumeExec(G, fromEvent, argsList);
        } else {
            G.resumeExec(G, G.pages[pageId].callback, argsList);
        }
        G.doOutput();
        G.eBottomLeft.textContent = "Event run time: (unavailable)";
    }

    G.endPage = function endPage() {
        if (!G.inPage) {
            throw new G.RuntimeError("Tried to end page while not in a page");
        }
        G.textBuffer = G.stored.textBuffer;
        G.options = G.stored.options;
        G.optionType = G.stored.optionType;
        G.optionFunction = G.stored.optionFunction;
        G.stored = {};
        G.inPage = false;
    }

    G.getData = function getData(type, dataArray, index) {
        if (index instanceof G.Value) {
            index.requireType(type);
            index = index.value;
        }
        if (index < 0 || index >= dataArray.length ||
                (type !== G.ValueType.String && index === 0) ||
                dataArray[index] == undefined) {
            throw new G.RuntimeError("Tried to access invalid " + G.typeNames[type] + " #" + index);
        }
        return dataArray[index].data;
    }

    G.getFunction = function getString(functionNumber) {
        return G.getData(G.ValueType.Function, G.functions, functionNumber);
    }

    G.getList = function getList(listNumber) {
        return G.getData(G.ValueType.List, G.lists, listNumber);
    }

    G.getMap = function getMap(mapNumber) {
        return G.getData(G.ValueType.Map, G.maps, mapNumber);
    }

    G.getObject = function getString(objectNumber) {
        return G.getData(G.ValueType.Object, G.objects, objectNumber);
    }

    G.getObjectProperty = function getObjectProperty(objectId, propertyId) {
        if (objectId instanceof G.Value) {
            objectId.requireType(G.ValueType.Object);
            objectId = objectId.value;
        }
        if (propertyId instanceof G.Value) {
            propertyId.requireType(G.ValueType.Property);
            propertyId = propertyId.value;
        }
        const theObject = G.getObject(objectId);
        if (theObject.hasOwnProperty(propertyId)) {
            const result = theObject[propertyId];
            result.selfobj = new G.Value(G.ValueType.Object, objectId);
            return result;
        } else {
            if (theObject.hasOwnProperty(G.propParent)) {
                return G.getObjectProperty(theObject[G.propParent], propertyId);
            } else {
                return new G.Value(G.ValueType.Integer, 0);
            }
        }
    }

    G.getSetting = function getSetting(settingNumber) {
        switch(settingNumber.value) {
            default:
                throw new G.RuntimeError("Tried to get unknown setting " + settingNumber.value + ".");
        }
    }

    G.getSource = function getSource(ofWhat) {
        var stringData = undefined;
        var data;
        switch(ofWhat.type) {
            case G.ValueType.String:        return G.noneValue;
            case G.ValueType.Integer:       return G.noneValue;
            case G.ValueType.JumpTarget:    return G.noneValue;
            case G.ValueType.LocalVar:      return G.noneValue;
            case G.ValueType.VarRef:        return G.noneValue;
            case G.ValueType.Property:      return G.noneValue;
            case G.ValueType.Map:
                if (ofWhat.value < 0 || ofWhat.value >= G.maps.length)
                    throw new G.RuntimeError("Tried to get origin of invalid map.");
                data = G.maps[ofWhat.value];
                break;
            case G.ValueType.List:
                if (ofWhat.value < 0 || ofWhat.value >= G.lists.length)
                    throw new G.RuntimeError("Tried to get origin of invalid list.");
                data = G.lists[ofWhat.value];
                break;
            case G.ValueType.Object:
                if (ofWhat.value < 0 || ofWhat.value >= G.objects.length)
                    throw new G.RuntimeError("Tried to get origin of invalid object.");
                data = G.objects[ofWhat.value];
                break;
            case G.ValueType.Function:
                if (ofWhat.value < 0 || ofWhat.value >= G.functions.length)
                    throw new G.RuntimeError("Tried to get origin of invalid function.");
                data = G.functions[ofWhat.value];
                break;
            default:
                stringData = "(unhandled type " + G.typeNames[ofWhat.type] + ")";
        }
        const newStr = G.makeNew(G.ValueType.String);
        if (stringData === undefined) {
            if (data.sourceFile === -1)
                stringData = "no debug info";
            else if (data.sourceFile === -2)
                stringData = "dynamic";
            else {
                if (data.hasOwnProperty("sourceName")) {
                    stringData = "\"" + G.getString(data.sourceName) + "\" ";
                } else {
                    stringData = "";
                }

                if (data.sourceLine === -1)
                    stringData += G.getString(data.sourceFile);
                else
                    stringData += G.getString(data.sourceFile) + ":" + data.sourceLine;
            }
        }
        G.strings[newStr.value].data = stringData;
        return newStr;
    }

    G.getString = function getString(stringNumber) {
        if (stringNumber instanceof G.Value) {
            stringNumber.requireType(G.ValueType.String);
            stringNumber = stringNumber.value;
        }
        return G.getData(G.ValueType.String, G.strings, stringNumber);
    }

    G.getVocab = function getVocab(index) {
        if (index < 0 || index >= G.vocab.length) {
            return "invalid vocab " + index;
        }
        return G.vocab[index].data;
    }
    G.getVocabNumber = function getVocabNumber(theWord) {
        let i = 0;
        while (i < G.vocab.length) {
            if (G.vocab[i].data === theWord) return i;
            ++i;
        }
        return -1;
    }

    G.isStatic = function isStatic(what) {
        if (!(what instanceof G.Value)) {
            throw new G.RuntimeError("Used isStatic on non-Value");
        }
        switch(what.type) {
            case G.ValueType.Object:
                if (G.objects.hasOwnProperty(what.value)) return new G.Value(G.ValueType.Integer, G.objects[what.value].static ? 1 : 0);
                return false;
            case G.ValueType.Map:
                if (G.maps.hasOwnProperty(what.value)) return new G.Value(G.ValueType.Integer, G.maps[what.value].static ? 1 : 0);
                return false;
            case G.ValueType.List:
                if (G.lists.hasOwnProperty(what.value)) return new G.Value(G.ValueType.Integer, G.lists[what.value].static ? 1 : 0);
                return false;
            case G.ValueType.String:
                if (G.strings.hasOwnProperty(what.value)) return new G.Value(G.ValueType.Integer, G.strings[what.value].static ? 1 : 0);
                return false;
            default:
                return new G.Value(G.ValueType.Integer, 1);
        }
    }

    G.isValid = function isValid(value) {
        switch(value.type) {
            case G.ValueType.None:
            case G.ValueType.Integer:
            case G.ValueType.Property:
            case G.ValueType.JumpTarget:
            case G.ValueType.VarRef:
            case G.ValueType.LocalVar:
            case G.ValueType.TypeId:
                return true;

            case G.ValueType.Vocab:
                if (value.value < 0 || value.value >= G.vocab.length) return false;
                return true;

            case G.ValueType.List:
                if (value.value <= 0 || value.value >= G.lists.length) return false;
                if (G.lists[value.value] === undefined) return false;
                return true;
            case G.ValueType.Map:
                if (value.value <= 0 || value.value >= G.maps.length) return false;
                if (G.maps[value.value] === undefined) return false;
                return true;
            case G.ValueType.Object:
                if (value.value <= 0 || value.value >= G.objects.length) return false;
                if (G.objects[value.value] === undefined) return false;
                return true;
            case G.ValueType.String:
                if (value.value <= 0 || value.value >= G.strings.length) return false;
                if (G.strings[value.value] === undefined) return false;
                return true;
            case G.ValueType.Function:
                if (value.value <= 0 || value.value >= G.functions.length) return false;
                if (G.functions[value.value] === undefined) return false;
                return true;
        }
        return false;
    }

    G.makeNew = function makeNew(type) {
        if (type instanceof G.Value) {
            type.requireType(G.ValueType.TypeId);
            type = type.value;
        }
        let nextId = G.nextIdent;
        G.nextIdent++;
        switch (type) {
            case G.ValueType.List:
                G.lists[nextId] = {data:[], sourceFile: -2, sourceLine: -1, static: false};
                return new G.Value(G.ValueType.List, nextId);
            case G.ValueType.Map:
                G.maps[nextId] = {data:{}, sourceFile: -2, sourceLine: -1, static: false};
                return new G.Value(G.ValueType.Map, nextId);
            case G.ValueType.Object:
                G.objects[nextId] = {data:{}, sourceFile: -2, sourceLine: -1, static: false};
                return new G.Value(G.ValueType.Object, nextId);
            case G.ValueType.String:
                G.strings[nextId] = {data:"", static: false};
                return new G.Value(G.ValueType.String, nextId);
            default:
                throw new G.RuntimeError("Cannot instantiate objects of type "
                                        + G.typeNames[type]);
        }
    }

    G.say = function say(value, ucFirst) {
        ucFirst = ucFirst || false;
        if (!(value instanceof G.Value)) {
            if (typeof value === "string" || typeof value === "number") {
                G.textBuffer.push(value);
            }
            return;
        }

        let text = G.asString(value);
        if (ucFirst) text = G.ucFirst(text);
        G.textBuffer.push(text);
    }

    G.setExtra = function setExtra(newExtraValue) {
        if (G.extraValue && G.extraValue.type === G.ValueType.VarRef) {
            G.callStack.set(G.extraValue.value, newExtraValue);
        }
    }

    G.setObjectProperty = function setObjectProperty(objectId, propertyId,
                                                     newValue) {
        if (objectId instanceof G.Value) {
            objectId.requireType(G.ValueType.Object);
            objectId = objectId.value;
        }
        if (propertyId instanceof G.Value) {
            propertyId.requireType(G.ValueType.Property);
            propertyId = propertyId.value;
        }
        if (!(newValue instanceof G.Value)) {
            throw new RuntimeError("Tried to set property value to non-Value");
        }
        const theObject = G.getObject(objectId);
        theObject[propertyId] = newValue;
    }

    G.setSetting = function setSetting(settingNumber, settingValue) {
        if (settingNumber instanceof G.Value) {
            settingNumber.requireType(G.ValueType.Integer);
            settingNumber = settingNumber.value;
        }

        switch(settingNumber) {
            case G.Settings.InfobarLeft:
                if (settingValue instanceof G.Value)
                    G.eTopLeft.textContent = G.getString(settingValue);
                else
                    G.eTopLeft.textContent = settingValue;
                break;
            case G.Settings.InfobarRight:
                if (settingValue instanceof G.Value)
                    G.eTopRight.textContent = G.getString(settingValue);
                else
                    G.eTopRight.textContent = settingValue;
                break;
            case G.Settings.InfobarFooter:
                if (settingValue instanceof G.Value)
                    G.eBottomRight.textContent = G.getString(settingValue);
                else
                    G.eBottomRight.textContent = settingValue;
                break;
            case G.Settings.Title:
                if (settingValue instanceof G.Value)
                    document.title = G.getString(settingValue);
                else
                    document.title = settingValue;
                break;
            default:
                throw new G.RuntimeError("Tried to set unknown setting " + settingNumber + ".");
        }
    }

    G.setStatus = function setStatus(toValue) {
        if (toValue instanceof G.Value) {
            toValue.requireType(G.ValueType.String);
            toValue = G.getString(toValue.value);
        }
        G.eBottomLeft = toValue;
    }

    G.sortList = function sortList(theList) {
        theList.sort(function(left, right) {
            if (left.type < right.type) return -1;
            if (left.type > right.type) return 1;
            if (left.type === G.ValueType.String) {
                const l = G.getString(left.value).toLowerCase();
                const r = G.getString(right.value).toLowerCase();
                if (l < r) return -1;
                if (l > r) return 1;
                return 0;
            } else {
                return left.value - right.value;
            }
        });
    }

    G.stringAppend = function stringAppend(left, right, ucFirst) {
        left.requireType(G.ValueType.String);
        if (G.isStatic(left).value) {
            throw new G.RuntimeError("Cannot modify static string");
        }

        let text = G.asString(right);
        if (ucFirst) text = G.ucFirst(text);
        const result = G.strings[left.value].data + text;
        G.strings[left.value].data = result.normalize("NFC");
    }

    G.objectByIdent = function objectByIdent(objectId) {
        if (objectId instanceof G.Value) {
            objectId.requireType(G.ValueType.Integer);
            objectId = objectId.value;
        }
        if (objectId <= 0) return G.noneValue;

        for (var i = 1; i < G.objects.length; ++i) {
            const thisIdent = G.getObjectProperty(i, G.propIdent);
            if (thisIdent.value === objectId) {
                return new G.Value(G.ValueType.Object, i);
            }
        }
        return G.noneValue;
    }

    G.objectHasProperty = function objectHasProperty(objectId, propertyId) {
        if (objectId instanceof G.Value) {
            objectId.requireType(G.ValueType.Object);
            objectId = objectId.value;
        }
        if (propertyId instanceof G.Value) {
            propertyId.requireType(G.ValueType.Property);
            propertyId = propertyId.value;
        }
        const theObject = G.getObject(objectId);
        if (theObject.hasOwnProperty(propertyId)) {
            return new G.Value(G.ValueType.Integer, 1);
        } else {
            return new G.Value(G.ValueType.Integer, 0);
        }
    }

    G.showOptions = function showOptions() {
        const oldOptionsCore = document.getElementById("optionsCore");
        if (oldOptionsCore) {
            oldOptionsCore.parentElement.removeChild(oldOptionsCore);
        }

        const optionsCore = document.createElement("div");
        optionsCore.id = "optionsCore";
        G.eOutput.appendChild(optionsCore);

        if (G.options.length === 0) return;

        switch(G.optionType) {
            case G.OptionType.MenuItem:
                const optionsList = document.createElement("div");
                optionsList.id = "optionslist";
                const standardOptions = [];
                const hotkeyOptions = [];
                var nextNum = 1;

                G.options.forEach(function(option, optionIndex) {
                    option.displayText.requireType(G.ValueType.String);
                    const button = document.createElement("button");
                    button.type = "button";
                    button.optionIndex = optionIndex;
                    var keyString;
                    if (option.hotkey) {
                        keyString = String.fromCharCode(option.hotkey).toUpperCase();
                        hotkeyOptions.push(button);
                    } else {
                        if (nextNum < 10) {
                            option.hotkey = 48 + nextNum;
                        } else if (nextNum == 10) {
                            option.hotkey = 48;
                        }
                        keyString = ""+nextNum;
                        ++nextNum;
                        standardOptions.push(button);
                    }
                    button.textContent = keyString + ") " + G.getString(option.displayText.value);
                    button.classList.add("optionsButton");
                    button.addEventListener("click", G.optionClickHandler);
                });

                function appendOption(optionElement) {
                    if (optionElement) {
                        optionsList.appendChild(optionElement);
                    }
                    const newBr = document.createElement("br");
                    optionsList.appendChild(newBr);
                }
                standardOptions.forEach(appendOption);
                hotkeyOptions.forEach(appendOption);
                optionsCore.appendChild(optionsList);
                break;

            case G.OptionType.LineInput: {
                const theOption = G.options[0];
                const options = document.createElement("div");
                options.id = "optionslist";
                options.classList.add("optionslist");
                options.classList.add("optionslineinput");

                const prompt = document.createElement("label");
                prompt.for = "lineinput";
                prompt.textContent = G.getString(theOption.displayText.value);
                options.append(prompt);

                const textLine = document.createElement("input");
                textLine.type = "text";
                textLine.id = "lineinput";
                options.appendChild(textLine);

                const goButton = document.createElement("button");
                goButton.type = "button";
                goButton.id = "gobutton";
                goButton.textContent = "Enter";
                goButton.addEventListener("click", G.goButtonHandler);
                options.appendChild(goButton);

                optionsCore.appendChild(options);
                textLine.focus();
                break; }
            case G.OptionType.KeyInput:
                const theOption = G.options[0];
                const options = document.createElement("p");
                options.id = "optionslist";
                options.classList.add("optionslist");
                options.textContent = G.getString(theOption.displayText.value);
                optionsCore.appendChild(options);
                break;
        }
    }

    G.ucFirst = function ucFirst(strText) {
        if (!strText || strText === "") return "";
        return strText.substring(0,1).toUpperCase() + strText.substring(1);
    }


// ////////////////////////////////////////////////////////////////////////////
// Keyboard input handler
// ////////////////////////////////////////////////////////////////////////////
    G.execOption = function(optionNumber) {
        const optionText = document.createElement("p");
        optionText.classList.add("optionNode");
        optionText.textContent = "> " + G.getString(G.options[optionNumber].displayText.value);
        G.eOutput.appendChild(optionText);
        G.setExtra(G.options[optionNumber].extra);
        G.doEvent(G.options[optionNumber].value);
    }
    G.goButtonHandler = function goButtonHandler() {
        if (G.options.length >= 1) {
            const eInput = document.getElementById("lineinput");

            const optionText = document.createElement("p");
            optionText.classList.add("optionNode");
            optionText.textContent = G.getString(G.options[0].displayText.value) + " " + eInput.value;
            G.eOutput.appendChild(optionText);

            const newStr = G.makeNew(G.ValueType.String);
            G.strings[newStr.value].data = eInput.value;

            G.doEvent(newStr);
        }
    }
    G.optionClickHandler = function optionClickHandler(event) {
        G.execOption(event.target.optionIndex);
    }
    G.keyPressHandler = function keyPressHandler(event) {
        // handle dialog keyboard events
        if (G.UI.inDialog) {
            if (event.key === "Enter" || event.key === "Escape"
                    || (event.key === " " && G.UI.inDialog.allowSpace)) {
                G.UI.inDialog.close();
                event.preventDefault();
            }
            return;
        }

        // only handle events if the game is actually running
        if (!G.gameLoaded) return;

        var code = -1;
        if (event.key.length === 1) code = event.key.toLowerCase().codePointAt(0);

        if (G.optionType === G.OptionType.LineInput) {
            if (event.key === "Enter") {
                G.goButtonHandler();
                return;
            }
            document.getElementById("lineinput").focus();
            return;
        }

        if (G.options.length === 0) return;

        switch (G.optionType) {
            case G.OptionType.MenuItem:
                // handle space/enter for activating single options
                if (code == 32 || event.key === "Enter") {
                    if (G.options.length == 1) {
                        G.execOption(0);
                        event.preventDefault();
                    }
                    return;
                }

                if (code <= 0) break;
                for (var i = 0; i < G.options.length; ++i) {
                    if (G.options[i].hotkey === code) {
                        G.execOption(i);
                        event.preventDefault();
                        break;
                    }
                }
                break;
            case G.OptionType.KeyInput:
                if (code === -1) {
                    switch(event.key) {
                        case "Backspace":   code = 8;   break;
                        case "Tab":         code = 9;   break;
                        case "Enter":       code = 10;  break;
                        case "Spacebar":    code = 32;  break;
                        case "ArrowLeft":   code = -1;  break;
                        case "ArrowRight":  code = -2;  break;
                        case "ArrowDown":   code = -3;  break;
                        case "ArrowUp":     code = -4;  break;
                        case "End":         code = -5;  break;
                        case "Home":        code = -6;  break;
                        case "PageDown":    code = -7;  break;
                        case "PageUp":      code = -8;  break;
                        case "Delete":      code = -9;  break;
                        default:            return;
                    }
                }

                const keyValue = new G.Value(G.ValueType.Integer, code);
                G.doEvent(keyValue);
                event.preventDefault();
                return;
        }

        if (code == 111) {
            G.UI.showSettings();
            event.preventDefault();
            return;
        }

        const pageKeys = Object.keys(G.pages);
        for (var i = 0; i < pageKeys.length; ++i) {
            const page = G.pages[pageKeys[i]];
            if (page.hotkey.value == code) {
                G.doPage(page.title.value);
                event.preventDefault();
            }
        }
    }

})();
