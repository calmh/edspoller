'use strict';

//var API = 'http://zedspoller.nym.se:8042';
//var API = 'http://ext.nym.se:8042';
var API = '';

function EDSController($scope, $http) {
    function updateLatest() {
        $http.get(API + '/raw/600').success(function (data) {
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

            setTimeout(updateLatest, 30 * 1000);
        });
    }

    function updateDaily() {
        $http.get(API + '/aggregated/daily/2').success(function (data) {
            var throughDay = ((Date.now() / 1000) % 86400) / 86400;
            $scope.today = data[data.length - 1];
            $scope.today.estimatedWh = $scope.today.totWh / throughDay;
            $scope.yesterday = data[data.length - 2];
            setTimeout(updateDaily, 300 * 1000);
        });
    }

    function updateProfile() {
        $http.get(API + '/grouped/hourly/14').success(function (data) {
            $scope.tempProfile = []
            data.forEach(function (d) {
                $scope.tempProfile[d._id.hour] = d.avgT;
            });
        });

        setTimeout(updateLatest, 3600 * 1000);
    }

    updateProfile();
    updateLatest();
    updateDaily();
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
    var xAxis = d3.svg.axis()
        .scale(x)
        .orient('bottom');
    var yAxis = d3.svg.axis()
        .scale(y)
        .orient('left')
        .ticks(6)
        .tickFormat(d3.format('.3s'));

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

    var t = g.append('g')
        .attr('class', 'y axis')
        .call(yAxis);

    if (options.yUnit) {
        t.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text(options.yUnit);
    }

    g.append('path')
        .datum(data)
        .attr('class', 'line ' + (options.lineClass || ''))
        .attr('d', line);
}

function drawBarsIn(selector, data, options) {
    options = options || {};

    var margin = {top: 10, right: 20, bottom: 30, left: 40};

    var svg = d3.select(selector);
    svg.text('');
    var width = parseInt(svg.style('width'), 10) - margin.left - margin.right;
    var height = parseInt(svg.style('height'), 10) - margin.top - margin.bottom;
    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var x = d3.scale.ordinal()
        .rangeRoundBands([0, width], .1);

    var y = d3.scale.linear()
        .range([height, 0]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .tickFormat(d3.format('.2s'));


    x.domain(data.map(function (d) {
        return d[0];
    }));
    y.domain([
        d3.min(data, function (d) {
            return d[1];
        }),
        d3.max(data, function (d) {
            return d[2];
        })
    ]).nice();

    g.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    var t = g.append("g")
        .attr("class", "y axis")
        .call(yAxis);

    if (options.yUnit) {
        t.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text(options.yUnit);
    }

    g.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", function (d) {
            return x(d[0]);
        })
        .attr("width", x.rangeBand())
        .attr("y", function (d) {
            return y(d[2]);
        })
        .attr("height", function (d) {
            return y(d[1]) - y(d[2]);
        });

}

function update3Hours() {
    d3.json(API + '/raw/14400', function (error, data) {
        var ms = data.map(function (d) {
            return [
                Date.parse(d.t),
                d.d.outC
            ];
        });
        drawIn('#tempShort', ms, {isTime: true, lineClass: 'temperature', yUnit: '°C'});

        var ps = data.map(function (d) {
            return [
                Date.parse(d.t),
                d.d.Wh * 3600 / 300
            ];
        });
        drawIn('#powerShort', ps, {isTime: true, min: 0, lineClass: 'power', yUnit: 'W'});
    });

    setTimeout(update3Hours, 30 * 1000);
}

function update48Hours() {
    d3.json(API + '/raw/172800', function (error, data) {
        var ms = data.map(function (d) {
            return [
                Date.parse(d.t),
                d.d.outC
            ];
        });
        drawIn('#tempLong', ms, {isTime: true, lineClass: 'temperature', yUnit: '°C'});

        var ps = data.map(function (d) {
            return [
                Date.parse(d.t),
                d.d.Wh * 3600 / 300
            ];
        });
        drawIn('#powerLong', ps, {isTime: true, min: 0, lineClass: 'power', yUnit: 'W'});
    });

    setTimeout(update48Hours, 300 * 1000);
}

function updateProfiles() {
    d3.json(API + '/grouped/hourly/14', function (error, data) {
        var ms = data.map(function (d) {
            return [
                (d._id.hour + 2) % 24,
                d.avgT
            ];
        });
        ms.sort(function (a, b) {
            return a[0] - b[0];
        });
        drawIn('#tempProfile', ms, {yUnit: '°C'});
    });

    d3.json(API + '/aggregated/monthly', function (error, data) {
        var ms = data.map(function (d) {
            return [
                d._id.month,
                d.minT !== null ? d.minT : 0,
                d.maxT !== null ? d.maxT : 0,
            ];
        });
        ms = ms.slice(-12);
        ms.sort(function (a, b) {
            return a[0] - b[0];
        });
        ms = ms.filter(function (r) {
            return r[1] !== null;
        });
        drawBarsIn('#tempProfileLong', ms, {yUnit: '°C'});
    });

    setTimeout(update48Hours, 3600 * 1000);
}

function updateDays() {
    d3.json(API + '/aggregated/daily/20', function (error, data) {
        var ms = data.map(function (d) {
            return [
                d._id.day,
                0,
                d.totWh
            ];
        });
        drawBarsIn('#powerDays', ms, {yUnit: 'Wh'});

        var ts = data.map(function (d) {
            return [
                d._id.day,
                d.minT,
                d.maxT
            ];
        });
        drawBarsIn('#tempDays', ts, {yUnit: '°C'});
    });

}

update3Hours();
updateProfiles();
update48Hours();
updateDays();
