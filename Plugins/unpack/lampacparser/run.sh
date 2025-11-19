#!/usr/bin/bash
cd /home/maxsm/lampacparser
node /home/maxsm/lampacparser/releases.js
node /home/maxsm/lampacparser/kinozal.js
cp /home/maxsm/lampacparser/recentTitles.json /home/lampac/wwwroot/maxsm/recentTitles.json
cp /home/maxsm/lampacparser/recentTitlesByCategory.json /home/lampac/wwwroot/maxsm/recentTitlesByCategory.json
