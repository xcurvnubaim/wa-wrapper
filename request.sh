#!/bin/bash

curl -X POST \
  http://localhost:3000/send-message \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "6285233550996",
    "message": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  }'