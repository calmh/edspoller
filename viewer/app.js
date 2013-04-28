"use strict";

function EDSController($scope, $http) {
    function updateLatest() {
        $http.get('http://zedspoller.int.nym.se:8042/latest/600').success(function (data) {
            $scope.latest = data[data.length - 1];
            $scope.currentWattage = $scope.latest.d.Wh * 3600 / 300;
            $scope.currentTime = Date.parse($scope.latest.t);
            setTimeout(updateLatest, 30000);
        });
    }

    updateLatest();
}

function drawIn(selector, data, isTime) {
    var margin = {top: 10, right: 20, bottom: 30, left: 40};

    var svg = d3.select(selector);
    var width = svg.attr('width') - margin.left - margin.right;
    var height = svg.attr('height') - margin.top - margin.bottom;
    var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    if (isTime) {
        var x = d3.time.scale().range([0, width]);
    } else {
        var x = d3.scale.linear().range([0, width]);
    }
    var y = d3.scale.linear().range([height, 0]);
    var xAxis = d3.svg.axis().scale(x).orient("bottom");
    var yAxis = d3.svg.axis().scale(y).orient("left");
    var line = d3.svg.line()
        .x(function (d) {
            return x(d[0]);
        })
        .y(function (d) {
            return y(d[1]);
        });

    x.domain(d3.extent(data, function (d) {
        return d[0];
    }));
    y.domain(d3.extent(data, function (d) {
        return d[1];
    })).nice();

    g.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    g.append("g")
        .attr("class", "y axis")
        .call(yAxis);

    g.append("path")
        .datum(data)
        .attr("class", "line")
        .attr("d", line);
}

d3.json("http://zedspoller.int.nym.se:8042/latest/14400", function (error, data) {
    var ms = data.map(function (d) {
        return [
            Date.parse(d.t),
            d.d.outC
        ];
    });
    drawIn('#tempShort', ms, true);

    var ps = data.map(function (d) {
        return [
            Date.parse(d.t),
            d.d.Wh * 3600 / 300
        ];
    });
    drawIn('#powerShort', ps, true);
});

d3.json("http://zedspoller.int.nym.se:8042/latest/172800", function (error, data) {
    var ms = data.map(function (d) {
        return [
            Date.parse(d.t),
            d.d.outC
        ];
    });
    drawIn('#tempLong', ms, true);

    var ps = data.map(function (d) {
        return [
            Date.parse(d.t),
            d.d.Wh * 3600 / 300
        ];
    });
    drawIn('#powerLong', ps, true);
});

d3.json("http://zedspoller.int.nym.se:8042/hourly/14", function (error, data) {
    var ms = data.map(function (d) {
        return [
            (d._id.hour + 2) % 24,
            d.avgT
        ];
    });
    ms.sort(function (a, b) {
        return a[0] - b[0];
    });
    drawIn('#tempProfile', ms);
});

d3.json("http://zedspoller.int.nym.se:8042/monthly", function (error, data) {
    var ms = data.map(function (d) {
        return [
            d._id.month,
            d.avgT
        ];
    });
    ms = ms.slice(-12);
    ms.sort(function (a, b) {
        return a[0] - b[0];
    });
    drawIn('#tempProfileLong', ms);
});
