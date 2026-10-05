#!/bin/bash
cd /home/user/utopia

# stop any running server by PID (never pkill by pattern - it kills this shell)
for pid in $(ps -eo pid,cmd | grep 'node server.js' | grep -v grep | awk '{print $1}'); do kill "$pid" 2>/dev/null; done
sleep 1

nohup node server.js > server.log 2>&1 &
sleep 2
echo "--- server log ---"; cat server.log

echo "--- e2e test ---"
timeout 45 node test/e2e.js
echo "e2e_exit=$?"

# ---- persistence check: restart server, history must survive ----
for pid in $(ps -eo pid,cmd | grep 'node server.js' | grep -v grep | awk '{print $1}'); do kill "$pid" 2>/dev/null; done
sleep 1
nohup node server.js > server2.log 2>&1 &
sleep 2
echo "--- persistence after restart ---"
TOKEN=$(curl -s -X POST localhost:3000/api/login -H 'Content-Type: application/json' -d '{"username":"alice","password":"secret123"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")
ROOM=$(curl -s localhost:3000/api/rooms -H "Authorization: Bearer $TOKEN" | node -pe "JSON.parse(require('fs').readFileSync(0)).rooms.find(r=>r.name==='general').id")
curl -s localhost:3000/api/rooms/$ROOM/messages -H "Authorization: Bearer $TOKEN" | node -pe "JSON.parse(require('fs').readFileSync(0)).messages.map(m=>m.username+': '+m.text).join('\n')"

# ---- package ----
cd /home/user
rm -f utopia.zip
zip -rq utopia.zip utopia -x "utopia/node_modules/*" -x "utopia/data/*"
echo "--- zip ---"
ls -lh utopia.zip
