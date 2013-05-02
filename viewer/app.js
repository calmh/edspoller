'use strict';

var API = 'http://zedspoller.nym.se:8042';
//var API = 'http://ext.nym.se:8042';

var tempRanges = [
    [30, 'Hot', 'alert-error'],
    [25, 'Warm', ''],
    [15, 'Cool', 'alert-success'],
    [0, 'Freezing', 'alert-info'],
]

function EDSController($scope, $http) {
    function updateLatest() {
        $http.get(API + '/latest/600').success(function (data) {
            $scope.latest = data[data.length - 1];
            $scope.currentWattage = $scope.latest.d.Wh * 3600 / 300;
            $scope.currentTime = Date.parse($scope.latest.t);
            $scope.currentHour = (new Date($scope.currentTime)).getUTCHours();
            $scope.currentTemp = $scope.latest.d.outC;

            $scope.$watch('tempProfile + currentHour + currentTemp', function () {
                if ('tempProfile' in $scope) {
                    $scope.currentDiff = $scope.currentTemp - $scope.tempProfile[$scope.currentHour]
                    $scope.currentTrend = 0;
                    if ($scope.currentDiff > 1) {
                        $scope.currentTrend = 1;
                    } else if ($scope.currentDiff < -1) {
                        $scope.currentTrend = -1;
                    }
                }
            });

            tempRanges.forEach(function (r) {
                if ($scope.latest.d.outC < r[0]) {
                    $scope.tempComment = r[1];
                    $scope.tempClass = r[2];
                }
            });

            setTimeout(updateLatest, 30 * 000);
        });
    }

    function updateProfile() {
        $http.get(API + '/hourly/14').success(function (data) {
            $scope.tempProfile = []
            data.forEach(function (d) {
                $scope.tempProfile[d._id.hour] = d.avgT;
            });
        });

        setTimeout(updateLatest, 3600 * 000);
    }

    updateProfile();
    updateLatest();
}

function drawIn(selector, data, options) {
    options = options || {};

    var margin = {top: 10, right: 20, bottom: 30, left: 40};

    var svg = d3.select(selector);
    svg.text('');
    var width = parseInt(svg.style('width'), 10) - margin.left - margin.right;
    var height = parseInt(svg.style('height'), 10) - margin.top - margin.bottom;
    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    if (options.isTime) {
        var x = d3.time.scale().range([0, width]);
    } else {
        var x = d3.scale.linear().range([0, width]);
    }
    var y = d3.scale.linear().range([height, 0]);
    var xAxis = d3.svg.axis().scale(x).orient('bottom');
    var yAxis = d3.svg.axis().scale(y).orient('left');
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

    if ('min' in options) {
        var d = y.domain();
        d[0] = options.min;
        y.domain(d);
    }

    g.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + height + ')')
        .call(xAxis);

    g.append('g')
        .attr('class', 'y axis')
        .call(yAxis);

    g.append('path')
        .datum(data)
        .attr('class', 'line')
        .attr('d', line);
}

function update3Hours() {
    d3.json(API + '/latest/14400', function (error, data) {
        var ms = data.map(function (d) {
            return [
                Date.parse(d.t),
                d.d.outC
            ];
        });
        drawIn('#tempShort', ms, {isTime: true});

        var ps = data.map(function (d) {
            return [
                Date.parse(d.t),
                d.d.Wh * 3600 / 300
            ];
        });
        drawIn('#powerShort', ps, {isTime: true, min: 0});
    });

    setTimeout(update3Hours, 30 * 1000);
}

function update48Hours() {
    d3.json(API + '/latest/172800', function (error, data) {
        var ms = data.map(function (d) {
            return [
                Date.parse(d.t),
                d.d.outC
            ];
        });
        drawIn('#tempLong', ms, {isTime: true});

        var ps = data.map(function (d) {
            return [
                Date.parse(d.t),
                d.d.Wh * 3600 / 300
            ];
        });
        drawIn('#powerLong', ps, {isTime: true, min: 0});
    });

    setTimeout(update48Hours, 300 * 1000);
}

function updateProfiles() {
    d3.json(API + '/hourly/14', function (error, data) {
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

    d3.json(API + '/monthly', function (error, data) {
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
        ms = ms.filter(function (r) {
            return r[1] !== 0;
        });
        drawIn('#tempProfileLong', ms);
    });

    setTimeout(update48Hours, 3600 * 1000);
}

update3Hours();
updateProfiles();
update48Hours();
