#!/usr/bin/env node

var fs = require('fs');
var http = require('http');
var path = require('path');
var mongo = require('mongodb');

var stateFile = path.normalize(path.join(process.env.HOME || '/var/tmp', 'counterstate.json'))

var config = loadConfig();
var state = loadState();
var stateDirty = false;

function nextInterval(ms, off) {
    off = off || 0;
    var now = Date.now();
    var next = Math.floor((now + 1.5 * ms) / ms) * ms;
    var wait = next - now + off;
    console.log(now, next, wait);
    return wait;
}

function get(cb) {
    var req = http.get(config.edsUrl, function (res) {
        var data = '';
        res.on('data', function (chunk) { data += chunk; });
        res.on('end', function () { cb(data); });
    });
}

function stateSaveLoop() {
    if (stateDirty) {
        fs.writeFileSync(stateFile, JSON.stringify(state), 'utf-8');
        stateDirty = false;
    }

    setTimeout(stateSaveLoop, 1000);
}

function loadConfig() {
    return JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
}

function loadState() {
    try {
        return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    } catch (e) {
        return {}
    }
}

function counterDiff(name, curValue) {
    var diff;
    if (state[name] !== undefined) {
        diff = curValue - state[name];
    }

    state[name] = curValue;
    stateDirty = true;

    return diff;
}

var collected = {};
config.extractions.forEach(function (ex) {
    collected[ex.name] = [];
});

function pollerLoop() {
    get(function (data) {
        config.extractions.forEach(function (ex) {
            var m = data.match(ex.exp);
            if (m) {
                var value = +m[1];
                if (ex.type == 'counter') {
                    var v = counterDiff(ex.name, value);
                    if (typeof v !== 'undefined') {
                        collected[ex.name].push(v);
                    }
                } else {
                    collected[ex.name].push(value);
                }
            }
        });

        setTimeout(pollerLoop, nextInterval(config.pollInterval, 0));
    });
}

var srv = new mongo.Server(config.mongodb.host, config.mongodb.port, {auto_reconnect: true});
var db = new mongo.Db(config.mongodb.db, srv, {w: -1});

function dataSaveLoop() {
    var stamp = new Date();
    stamp.setMilliseconds(0);
    var s = Math.floor(stamp.getTime() / 1000);

    var result = { _id: s, t: stamp, d: {} }
    var count = 0;
    config.extractions.forEach(function (ex) {
        if (collected[ex.name].length > 0) {
            var sum = collected[ex.name].reduce(function (a, b) { return a + b; }, 0);
            if (ex.type === 'counter' && sum > 0)
                result.d[ex.name] = sum;
            else if (ex.type === 'gauge')
                result.d[ex.name] = Math.round(100 * sum / collected[ex.name].length) / 100;
            count += 1;
        }
        collected[ex.name] = [];
    });

    if (count) {
        db.open(function (err, client) {
            if (err)
                throw err;
            var coll = new mongo.Collection(client, config.mongodb.collection);
            coll.insert(result);
            console.log(JSON.stringify(result));
            client.close();
        });
    }

    setTimeout(dataSaveLoop, nextInterval(config.saveInterval, 500));
}

pollerLoop();
stateSaveLoop();
dataSaveLoop();
