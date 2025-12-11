#!/bin/bash
cd /home/kavia/workspace/code-generation/lexisearch-dictionary-221743-221752/dictionary_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

