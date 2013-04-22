#!/usr/bin/python

import datetime
import pymongo
import json
from collections import defaultdict

dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
client = pymongo.MongoClient('localhost', 27017)
db = client.cube_env
co = db.reading_events
r = defaultdict(lambda: defaultdict(lambda: []))

imp = []
temp = []
prev_id = None
for doc in co.find().sort('t'):
    id = int((doc['t'] - datetime.datetime(1970,1,1)).total_seconds() / 300) * 300

    if prev_id is None:
        prev_id = id

    if prev_id and id != prev_id:
        t = datetime.datetime.fromtimestamp(prev_id)
        new = {
            '_id': prev_id,
            't': { '$date': prev_id * 1000 },
            'd': {
            }
        }
        if len(imp) > 0:
            new['d']['Wh'] = sum(imp)
        if len(temp) > 0:
            new['d']['outC'] = int(100 * sum(temp) / len(temp)) / 100.0
        print json.dumps(new)
        imp = []
        temp = []
        prev_id = id

    d = doc['d']
    if 'impulses' in d:
        imp.append(d['impulses'])
    if 'temperature' in d:
        temp.append(d['temperature'])
