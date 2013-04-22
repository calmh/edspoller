var fs = require('fs');
var express = require('express');
var mongo = require('mongodb');

var config = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));

var srv = new mongo.Server(config.mongodb.host, config.mongodb.port, {auto_reconnect: true});
var db = new mongo.Db(config.mongodb.db, srv, {w: -1});

function setupApp(err, client) {
    if (err)
        throw err;

    var app = express();

    app.get('/monthly', function (req, res) {
        if (err)
            throw err;
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

    app.get('/daily/:days', function (req, res) {
        if (err)
            throw err;
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


    app.get('/hourly/:days', function (req, res) {
        if (err)
            throw err;
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

    app.get('/latest/:seconds', function (req, res) {
        if (err)
            throw err;
        var coll = new mongo.Collection(client, config.mongodb.collection);

        var cut = Math.floor(Date.now() / 1000) - parseInt(req.params.seconds, 10);
        coll.find({_id: {$gt: cut}}).sort({_id: 1}).toArray(function (err, docs) {
            if (err)
                throw err;
            res.json(docs);
            res.end();
        });
    });

    app.listen(8042);
}

db.open(setupApp);
