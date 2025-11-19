#!/usr/bin/bash
cd /opt/inq_parser
node /opt/inq_parser/inq_parser_series.js
cp /opt/inq_parser/inq_parser_series.json /home/lampac/wwwroot/inq_parser_series.json
