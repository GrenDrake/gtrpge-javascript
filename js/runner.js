(function() {
    "use strict";

    const Opcode = {
        Return:                 0,
        Push0:                  1,
        Push1:                  2,
        PushNeg1:               3,
        Push8:                  4,
        Push16:                 5,
        Push32:                 6,
        Store:                  7,
        Say:                    10,
        SayUnsigned:            11,
        SayChar:                12,
        StackPop:               13, // remove the top item from the stack
        StackDup:               14, // duplicate the top item on the stack
        StackPeek:              15, // peek at the stack item X items from the top
        StackSize:              16, // get the current size of the stack
        Call:                   17, // call a value as a function
        CallMethod:             18, // call an object property as a function
        Self:                   19, // get object the current function is a property of
        GetProp:                20,
        HasProp:                21, // check if property is set on object
        SetProp:                22, // set object property to value
        GetItem:                23, // get item from list (index) or map (key)
        HasItem:                24, // check if index (for list) or key (for map) exists
        GetSize:                25, // get size of list or map
        SetItem:                26, // set item in list (by index) of map (by key)
        TypeOf:                 27, // get value type
        CompareTypes:           30, // compare the types of two values and push the result
        Compare:                31, // compare two values and push the result
        Jump:                   32, // unconditional jump
        JumpZero:               33, // jump if top of stack == 0
        JumpNotZero:            34, // jump if top of stack != 0
        JumpLessThan:           35, // jump if top of stack < 0
        JumpLessThanEqual:      36, // jump if top of stack <= 0
        JumpGreaterThan:        37, // jump if top of stack > 0
        JumpGreaterThanEqual:   38, // jump if top of stack >= 0
        Add:                    40,
        Sub:                    41,
        Mult:                   42,
        Div:                    43,
        Mod:                    44,
        Pow:                    45,
        BitLeft:                46,
        BitRight:               47,
        BitAnd:                 48,
        BitOr:                  49,
        BitXor:                 50,
        BitNot:                 51,
        Random:                 52,
        GetKey:                 60,
        GetOption:              61,
        GetLine:                62,
        AddOption:              63,
        SetInfo:                70,
    };
    Object.freeze(Opcode);

    G.callFunction = function callFunction(G, functionId, argList) {
        argList = argList || [];

        if (!G.functions.hasOwnProperty(functionId)) {
            throw new G.RuntimeError("Function does not exist.");
            return;
        }

        const stack = new G.Stack();
        const locals = [];

        const functionDef = G.functions[functionId];
        for (var i = 0; i < functionDef[0] + functionDef[1]; ++i) {
            if (i < argList.length && i < functionDef[0]) {
                locals.push(argList[i]);
            } else {
                locals.push(new G.Value(0,0));
            }
        }
        var IP = functionDef[2];
        var rawType, rawValue, v1, v2, v3, target;

        while (1) {
            const opcode = G.bytecode.getUint8(IP);
            ++IP;
            switch(opcode) {
                case Opcode.Return:
                    if (stack.length > 0) {
                        return stack.top();
                    } else {
                        return new G.Value(G.ValueType.Integer, 0);
                    }
                case Opcode.Push0:
                    rawType = G.bytecode.getUint8(IP);
                    ++IP;
                    stack.push(new G.Value(rawType,0));
                    break;
                case Opcode.Push1:
                    rawType = G.bytecode.getUint8(IP);
                    ++IP;
                    stack.push(new G.Value(rawType,1));
                    break;
                case Opcode.PushNeg1:
                    rawType = G.bytecode.getUint8(IP);
                    ++IP;
                    stack.push(new G.Value(rawType,-1));
                    break;
                case Opcode.Push8:
                    rawType = G.bytecode.getUint8(IP);
                    ++IP;
                    rawValue = G.bytecode.getInt8(IP);
                    ++IP;
                    stack.push(new G.Value(rawType,rawValue));
                    break;
                case Opcode.Push16:
                    rawType = G.bytecode.getUint8(IP);
                    ++IP;
                    rawValue = G.bytecode.getInt16(IP, true);
                    IP += 2;
                    stack.push(new G.Value(rawType,rawValue));
                    break;
                case Opcode.Push32:
                    rawType = G.bytecode.getUint8(IP);
                    ++IP;
                    rawValue = G.bytecode.getInt32(IP, true);
                    IP += 4;
                    stack.push(new G.Value(rawType, rawValue));
                    break;

                case Opcode.Store:
                    var localId = stack.pop();
                    var value = stack.popAsLocal(locals);
                    localId.requireType(G.ValueType.LocalVar);
                    if (localId.value < 0 || localId.value >= locals.length) {
                        throw new G.RuntimeError("Invalid local number.");
                    }
                    locals[localId.value] = value;
                    break;

                case Opcode.Say:
                    v1 = stack.popAsLocal(locals);
                    G.say(v1);
                    break;
                case Opcode.SayUnsigned:
                    var value = stack.popAsLocal(locals);
                    value.requireType(G.ValueType.Integer);
                    G.say(value.value>>>0);
                    break;
                case Opcode.SayChar:
                    var value = stack.popAsLocal(locals);
                    value.requireType(G.ValueType.Integer);
                    G.say(String.fromCodePoint(value.value));
                    break;

                case Opcode.StackPop:
                    stack.pop();
                    break;
                case Opcode.StackDup:
                    const topStackItem = stack.top();
                    stack.push(stack.top().clone());
                    break;
                case Opcode.StackPeek:
                    v1 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    stack.push(stack.peek(v1.value).clone());
                    break;
                case Opcode.StackSize:
                    stack.push(new G.Value(G.ValueType.Integer, stack.length));
                    break;

                case Opcode.Call:
                    target = stack.popAsLocal(locals);
                    v1 = stack.popAsLocal(locals);
                    target.requireType(G.ValueType.Node);
                    v1.requireType(G.ValueType.Integer);
                    const theArgs = [];
                    while (v1.value > 0) {
                        theArgs.push(stack.popAsLocal(locals));
                        v1.value -= 1;
                    }
                    const result = G.callFunction(G, target.value, theArgs);
                    stack.push(result);
                    break;

                case Opcode.GetProp:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Object);
                    v2.requireType(G.ValueType.Property);
                    const propValue = G.getObjectProperty(v1, v2);
                    stack.push(propValue);
                    break;
                case Opcode.HasProp:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Object);
                    v2.requireType(G.ValueType.Property);
                    const propExists = G.objectHasProperty(v1, v2);
                    stack.push(propExists);
                    break;
                case Opcode.SetProp:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v3 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Object);
                    v2.requireType(G.ValueType.Property);
                    G.setObjectProperty(v1, v2, v3);
                    break;

                case Opcode.TypeOf:
                    v1 = stack.popAsLocal(locals);
                    stack.push(new G.Value(G.ValueType.Integer, v1.type));
                    break;
                case Opcode.CompareTypes:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    if (v1.type != v2.type)
                        stack.push(new G.Value(G.ValueType.Integer, 0));
                    else
                        stack.push(new G.Value(G.ValueType.Integer, 1));
                    break;
                case Opcode.Compare:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    if (v1.type != v2.type)
                        stack.push(new G.Value(G.ValueType.Integer, -1));
                    else
                        stack.push(new G.Value(G.ValueType.Integer,
                                               v2.value - v1.value));
                    break;

                case Opcode.Jump:
                    target = stack.popAsLocal(locals);
                    target.requireType(G.ValueType.JumpTarget);
                    IP = functionDef[2] + target.value;
                    break;
                case Opcode.JumpZero:
                    target = stack.popAsLocal(locals);
                    v1 = stack.popAsLocal(locals);
                    target.requireType(G.ValueType.JumpTarget);
                    if (v1.value === 0) {
                        IP = functionDef[2] + target.value;
                    }
                    break;
                case Opcode.JumpNotZero:
                    target = stack.popAsLocal(locals);
                    v1 = stack.popAsLocal(locals);
                    target.requireType(G.ValueType.JumpTarget);
                    if (v1.value !== 0) {
                        IP = functionDef[2] + target.value;
                    }
                    break;
                case Opcode.JumpLessThan:
                    target = stack.popAsLocal(locals);
                    v1 = stack.popAsLocal(locals);
                    target.requireType(G.ValueType.JumpTarget);
                    if (v1.value < 0) {
                        IP = functionDef[2] + target.value;
                    }
                    break;
                case Opcode.JumpLessThanEqual:
                    target = stack.popAsLocal(locals);
                    v1 = stack.popAsLocal(locals);
                    target.requireType(G.ValueType.JumpTarget);
                    if (v1.value <= 0) {
                        IP = functionDef[2] + target.value;
                    }
                    break;
                case Opcode.JumpGreaterThan:
                    target = stack.popAsLocal(locals);
                    v1 = stack.popAsLocal(locals);
                    target.requireType(G.ValueType.JumpTarget);
                    if (v1.value > 0) {
                        IP = functionDef[2] + target.value;
                    }
                    break;
                case Opcode.JumpGreaterThanEqual:
                    target = stack.popAsLocal(locals);
                    v1 = stack.popAsLocal(locals);
                    target.requireType(G.ValueType.JumpTarget);
                    if (v1.value >= 0) {
                        IP = functionDef[2] + target.value;
                    }
                    break;

                case Opcode.Add:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    v2.requireType(G.ValueType.Integer);
                    stack.push(new G.Value(G.ValueType.Integer,
                                           v1.value + v2.value));
                    break;
                case Opcode.Sub:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    v2.requireType(G.ValueType.Integer);
                    stack.push(new G.Value(G.ValueType.Integer,
                                           v2.value - v1.value));
                    break;
                case Opcode.Mult:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    v2.requireType(G.ValueType.Integer);
                    stack.push(new G.Value(G.ValueType.Integer,
                                           v1.value * v2.value));
                    break;
                case Opcode.Div:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    v2.requireType(G.ValueType.Integer);
                    stack.push(new G.Value(G.ValueType.Integer,
                                           v2.value / v1.value));
                    break;
                case Opcode.Mod:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    v2.requireType(G.ValueType.Integer);
                    stack.push(new G.Value(G.ValueType.Integer,
                                           v2.value % v1.value));
                    break;
                case Opcode.Pow:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    v2.requireType(G.ValueType.Integer);
                    stack.push(new G.Value(G.ValueType.Integer,
                                           Math.pow(v2.value, v1.value)));
                    break;
                case Opcode.BitLeft:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    v2.requireType(G.ValueType.Integer);
                    stack.push(new G.Value(G.ValueType.Integer,
                                           v2.value << v1.value));
                    break;
                case Opcode.BitRight:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    v2.requireType(G.ValueType.Integer);
                    stack.push(new G.Value(G.ValueType.Integer,
                                           v2.value >>> v1.value));
                    break;
                case Opcode.BitAnd:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    v2.requireType(G.ValueType.Integer);
                    stack.push(new G.Value(G.ValueType.Integer,
                                           v2.value & v1.value));
                    break;
                case Opcode.BitOr:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    v2.requireType(G.ValueType.Integer);
                    stack.push(new G.Value(G.ValueType.Integer,
                                           v2.value | v1.value));
                    break;
                case Opcode.BitXor:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    v2.requireType(G.ValueType.Integer);
                    stack.push(new G.Value(G.ValueType.Integer,
                                           v2.value ^ v1.value));
                    break;
                case Opcode.BitNot:
                    v1 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    stack.push(new G.Value(G.ValueType.Integer, ~v1.value));
                    break;
                case Opcode.Random:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    v2.requireType(G.ValueType.Integer);
                    const randomValue = Math.floor(Math.random()
                                                   * (v1.value - v2.value)
                                                   + v2.value);
                    stack.push(new G.Value(G.ValueType.Integer, randomValue));
                    break;

                case Opcode.GetKey:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Node);
                    v2.requireType(G.ValueType.String);
                    G.optionType = G.OptionType.KeyInput;
                    G.optionFunction = v1.value;
                    G.options = [ new G.Option(v2, v1) ];
                    break;
                case Opcode.GetOption:
                    v1 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Node);
                    G.optionType = G.OptionType.MenuItem;
                    G.optionFunction = v1.value;
                    break;
                case Opcode.AddOption:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Node);
                    v2.requireType(G.ValueType.String);
                    G.options.push(new G.Option(v2, v1));
                    break;

                case Opcode.SetInfo:
                    v1 = stack.popAsLocal(locals);
                    v2 = stack.popAsLocal(locals);
                    v1.requireType(G.ValueType.Integer);
                    G.setInfo(v1.value, v2);
                    break;

                default:
                    throw new G.RuntimeError("Unknown opcode " + opcode + ".");
            }
        }
    }
})();