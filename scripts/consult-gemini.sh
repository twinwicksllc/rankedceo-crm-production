#!/bin/bash

# Secure Gemini Consultation Script
# This script NEVER logs or commits the API key

set -e

# Get API key from environment (NEVER from command line arguments)
API_KEY="${GEMINI_API_KEY}"

# Validate
if [ -z "$API_KEY" ]; then
    echo "ERROR: GEMINI_API_KEY environment variable not set"
    echo "Usage: GEMINI_API_KEY=your_key_here ./scripts/consult-gemini.sh 'your question'"
    exit 1
fi

# Get question from argument
QUESTION="$1"

if [ -z "$QUESTION" ]; then
    echo "ERROR: No question provided"
    echo "Usage: GEMINI_API_KEY=your_key_here ./scripts/consult-gemini.sh 'your question'"
    exit 1
fi

# Make the API call (NEVER log the key)
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    &quot;contents&quot;: [{
      &quot;parts&quot;: [{
        &quot;text&quot;: &quot;${QUESTION}&quot;
      }]
    }],
    &quot;generationConfig&quot;: {
      &quot;temperature&quot;: 0.7,
      &quot;topK&quot;: 40,
      &quot;topP&quot;: 0.95,
      &quot;maxOutputTokens&quot;: 4096
    }
  }" | jq -r '.candidates[0].content.parts[0].text' 2>/dev/null || echo "Error calling Gemini API"

# Note: The API key is passed in the URL but this is standard practice
# The key is never logged to file or committed to git