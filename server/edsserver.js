var fs = require('fs');
var express = require('express');
var mongo = require('mongodb');

var config = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));

var srv = new mongo.Server(config.mongodb.host, config.mongodb.port, {auto_reconnect: true});
var db = new mongo.Db(config.mongodb.db, srv, {w: -1});

function allowCrossDomain(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type,X-Requested-With');
    if (req.method == 'OPTIONS') {
        res.send(200);
    }
    else {
        next();
    }
}

function setupApp(err, client) {
    if (err)
        throw err;

    var app = express();
    app.use(allowCrossDomain);
    app.use(express.static(__dirname + '/../viewer'));

    app.get('/grouped/hourly/:days', function (req, res) {
        var coll = new mongo.Collection(client, config.mongodb.collection);

        var cut = Math.floor(Date.now() / 1000) - 86400 * parseInt(req.params.days, 10);
        var match = {$match: {_id: {$gt: cut}}};
        var group = {$group: {_id: {hour: {$hour: '$t'}},
            maxT: {$max: '$d.outC'},
            avgT: {$avg: '$d.outC'},
            minT: {$min: '$d.outC'},
            avgWh: {$avg: '$d.Wh'},
            maxWh: {$max: '$d.Wh'},
            totWh: {$sum: '$d.Wh'}
        }};
        var sort = {$sort: {'_id.hour': 1}};

        coll.aggregate(match, group, sort, function (err, docs) {
            if (err)
                throw err;
            res.json(docs);
            res.end();
        });
    });

    app.get('/aggregated/daily/:days', function (req, res) {
        var coll = new mongo.Collection(client, config.mongodb.collection);

        var cut = Math.floor(Date.now() / 1000) - 86400 * parseInt(req.params.days, 10);
        var match = {$match: {_id: {$gt: cut}}};
        var group = {$group: {_id: {year: {$year: '$t'}, month: {$month: '$t'}, day: {$dayOfMonth: '$t'}},
            maxT: {$max: '$d.outC'},
            avgT: {$avg: '$d.outC'},
            minT: {$min: '$d.outC'},
            avgWh: {$avg: '$d.Wh'},
            maxWh: {$max: '$d.Wh'},
            totWh: {$sum: '$d.Wh'}
        }};
        var sort = {$sort: {'_id.year': 1, '_id.month': 1, '_id.day': 1}};

        coll.aggregate(match, group, sort, function (err, docs) {
            if (err)
                throw err;
            res.json(docs);
            res.end();
        });
    });

    app.get('/aggregated/monthly', function (req, res) {
        var coll = new mongo.Collection(client, config.mongodb.collection);

        var group = {$group: {_id: {year: {$year: '$t'}, month: {$month: '$t'}},
            maxT: {$max: '$d.outC'},
            avgT: {$avg: '$d.outC'},
            minT: {$min: '$d.outC'},
            avgWh: {$avg: '$d.Wh'},
            maxWh: {$max: '$d.Wh'},
            totWh: {$sum: '$d.Wh'}
        }};
        var sort = {$sort: {'_id.year': 1, '_id.month': 1}};

        coll.aggregate(group, sort, function (err, docs) {
            if (err)
                throw err;
            res.json(docs);
            res.end();
        });
    });

    app.get('/raw/:seconds', function (req, res) {
        var coll = new mongo.Collection(client, config.mongodb.collection);

        var cut = Math.floor(Date.now() / 1000) - parseInt(req.params.seconds, 10);
        coll.find({_id: {$gt: cut}}).sort({_id: 1}).toArray(function (err, docs) {
            if (err)
                throw err;
            res.json(docs);
            res.end();
        });
    });

    app.listen(8042, '::');
}

db.open(setupApp);
