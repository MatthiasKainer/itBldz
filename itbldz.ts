﻿import grunt = require('grunt');
import path = require('path');
import engines = require('./src/lib/Engine');
import config = require('./src/lib/configs');
import logging = require('./src/lib/logging');
var log = new logging.Log();
var nopt = require('nopt');
var pkg = require('./package.json');

// CLI options we care about.
var known = { help: Boolean, version: Boolean, completion: String };
var aliases = { h: '--help', V: '--version', v: '--verbose' };

var _args = nopt(known, aliases, process.argv, 2);

process.title = 'itbldz';

global["basedir"] = process.cwd();
global["relativeDir"] = __dirname;
global["requireRoot"] = function (name) {
    return require(__dirname + '/' + name);
};

log.writeln("itbldz", "Environment set up successfully.");
log.verbose.writeln("itbldz", "\tBaseDir\t\t" + global["basedir"]);
log.verbose.writeln("itbldz", "\tRelativeDir\t" + global["relativeDir"]);
log.verbose.writeln("itbldz", "\tGruntVersion\t" + grunt["requireRoot"]);

export function itbldz(args) {

    log.writeln("itbldz", "Loading engine...");
    var engine = engines.Engine.get(grunt);

    log.writeln("itbldz", "Loading steps...");
    var currentConfig = config.ConfigurationLoaderServiceFactory.get().load(grunt);
    log.verbose.writeln("itbldz", "Config loaded: " + JSON.stringify(currentConfig, undefined, 2));

    if (engine) {
        var gruntFile = path.join(global["relativeDir"], "src/grunt-utils/gruntfile.js");
        args["gruntfile"] = gruntFile;
        try {
            engine.startUp(currentConfig, (tasks) => {
                if (_args.help) {
                    log.writeln("itbldz", "==== All Tasks ====");
                    tasks.forEach(task => log.writeln("task", "\t" + task));
                    process.exit(0);
                } else {
                    (<any>grunt).tasks(tasks, args, () => {
                        log.writeln("itbldz", "Completed successfully");
                        process.exit(0);
                    });
                }
            });
        } catch (error) {
            log.error("itbldz", _args.stack ? error.stack : error);
            process.exit(1);
        }
    } else {
        log.error("itbldz", "Missing engine action.");
        process.exit(1);
    }
}

if (_args.version) {
    log.writeln("itbldz", "\titbldz Version\t" + pkg.version);
    log.writeln("itbldz", "\tGrunt Version\t" + grunt["version"]);
    log.writeln("itbldz", "\tNode Version\t" + process.version);
}
else {
    itbldz(process.argv);
}
