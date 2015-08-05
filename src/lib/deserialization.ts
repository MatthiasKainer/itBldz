import logging = require('./logging');
var log = new logging.Log();

interface IDeserializeAType {
    type : RegExp;
    deserialize(type, value, call) : any;
}

class DeserializationHelper {
    public static toObject(value) {
        var data = value;
        if (Object.prototype.toString.call(value) === "[object String]") {
            data = JSON.parse(value);
        }
        
        return data;
    }
}

class DeserializeRegex implements IDeserializeAType {
    type : RegExp = /^RegExp$/gi;
    public deserialize(type, value, call) {
        try {
            var data = DeserializationHelper.toObject(value);                
            return new RegExp(data.pattern, data.flags);
        }
        catch(err) {
            return new RegExp(value);
        }
    }
}

class DeserializeModule implements IDeserializeAType {
    type : RegExp = /^modules\./gi;
    modules;
    
    constructor(modules) {
        this.modules = modules;
    }
    
    public deserialize(type : string, value : string, call : string) {
        type = type.replace(this.type, "");
        log.verbose.writeln("DeserializeModule", "Deserializing module " + type + "...");
        var currentModule = this.modules[type];
        var self = this;
        
        if (!currentModule) throw new Error("A module that was specified could not be loaded. Module: " + type);
        if (currentModule.deserialize) {
            return function() { currentModule.deserialize(value); return currentModule[call].apply(currentModule, arguments); };
        }
        
        try {
            var valueAsObject = DeserializationHelper.toObject(value);
            log.verbose.writeln("DeserializeModule", "Applying " + JSON.stringify(value) + " to " + JSON.stringify(currentModule));
            Object.keys(valueAsObject).forEach((key) => {
               currentModule[key] = valueAsObject[key];
            });
            log.verbose.writeln("DeserializeModule", "Result: " + JSON.stringify(currentModule));
            
            return function () { return currentModule[call].apply(currentModule, arguments); };
        } catch (err) {}
        
        return function () { return currentModule[call].apply(currentModule, arguments); };
    }
}

class EmptyDeserializer implements IDeserializeAType {
    type;
    public deserialize(type, value, call) {
        return value;
    }
}

class DeserializerFactory {
    deserializers : IDeserializeAType[] = [new DeserializeRegex()];
        
    public constructor(modules) {
        this.deserializers.push(new DeserializeModule(modules));
    }
        
    public get(type : string) : IDeserializeAType {
        log.verbose.writeln("DeserializerFactory", "Testing type " + type);
        return this.deserializers.filter((item) => item.type.test(type))[0] || 
            new EmptyDeserializer();
    }
}

export class ConfigurationTypeDeserializer {
    config : any;
    deserializerFactory : DeserializerFactory;
    
    public constructor(config, modules) { 
        this.config = config; 
        this.deserializerFactory = new DeserializerFactory(modules);
    }
    
    private serializeByDisriminator(type, value, call) : any {
        return this.deserializerFactory.get(type).deserialize(type, value, call);
    }
    
    private forEachKeyIn(object) : any {
        if (Array.isArray(object)){
            for (var index = 0; index < object.length; index++) {
                object[index] = this.forEachKeyIn(object[index]);
            }
            
            return object;
        }
        
        if (object !== Object(object)) return object;
        log.verbose.writeln("ConfigurationTypeDeserializer", "Current object: " + JSON.stringify(object));
        if (object["serialized:type"]) {
            var serialized = this.serializeByDisriminator(object["serialized:type"], object["serialized:object"], object["serialized:call"]);
            log.verbose.writeln("ConfigurationTypeDeserializer", "Serialized " + object["serialized:type"] + " to " + JSON.stringify(serialized));
            return serialized;
        }
        
        var result = {};
        
        Object.keys(object).forEach((key) => {
            result[key] = this.forEachKeyIn(object[key]);
        });
        
        return result;
    }
    
    public deserialize() : any {
        return this.forEachKeyIn(this.config);
    }
}