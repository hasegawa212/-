#!/usr/bin/env bash
# gas-call.sh — Generic cURL wrapper for a Google Apps Script Web App (exec URL).
#
# Supports:
#   - GET with query string parameters
#   - POST with JSON body (default) or raw/form body
#   - Apps Script 302 redirects to googleusercontent.com (-L follows them)
#   - Overriding the target URL via $GAS_URL env var or --url flag
#
# Usage:
#   ./scripts/gas-call.sh [options]
#
# Options:
#   -X, --method METHOD     HTTP method: GET (default) or POST
#   -u, --url URL           Override exec URL (defaults to baked-in value or $GAS_URL)
#   -q, --query "k=v&..."   Query string appended to the URL (both GET and POST)
#   -d, --data DATA         Request body. JSON string, @file.json, or raw text.
#                           Ignored for GET.
#   -t, --content-type TYPE Content-Type header for POST (default: application/json)
#   -H, --header "K: V"     Extra header (repeatable)
#   -o, --output FILE       Write response body to FILE instead of stdout
#   -i, --include           Include response headers in output
#   -s, --silent            Silence curl progress meter (default: on)
#   -v, --verbose           Verbose curl output (debugging)
#       --no-follow         Do not follow redirects
#       --raw               Print response as-is (skip jq pretty-print)
#   -h, --help              Show this help
#
# Examples:
#   # Simple GET
#   ./scripts/gas-call.sh
#
#   # GET with query params
#   ./scripts/gas-call.sh -q "action=list&limit=10"
#
#   # POST JSON body
#   ./scripts/gas-call.sh -X POST -d '{"action":"add","name":"山田"}'
#
#   # POST JSON from file
#   ./scripts/gas-call.sh -X POST -d @payload.json
#
#   # Override URL for one call
#   ./scripts/gas-call.sh --url "https://script.google.com/macros/s/OTHER_ID/exec"
#
#   # Override URL via env
#   GAS_URL="https://script.google.com/macros/s/OTHER_ID/exec" ./scripts/gas-call.sh

set -euo pipefail

DEFAULT_URL="https://script.google.com/macros/s/AKfycbz-jVDnQOxmHXfiNAJv3NgD4EVU4W19Hyii3rRJIJuBf8SDsWglbMnj5JOOkn0MzvSJ/exec"

method="GET"
url="${GAS_URL:-$DEFAULT_URL}"
query=""
data=""
content_type="application/json"
headers=()
output=""
include=0
silent=1
verbose=0
follow=1
raw=0

usage() {
  sed -n '2,45p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -X|--method)       method="${2^^}"; shift 2 ;;
    -u|--url)          url="$2"; shift 2 ;;
    -q|--query)        query="$2"; shift 2 ;;
    -d|--data)         data="$2"; shift 2 ;;
    -t|--content-type) content_type="$2"; shift 2 ;;
    -H|--header)       headers+=("$2"); shift 2 ;;
    -o|--output)       output="$2"; shift 2 ;;
    -i|--include)      include=1; shift ;;
    -s|--silent)       silent=1; shift ;;
    -v|--verbose)      verbose=1; silent=0; shift ;;
    --no-follow)       follow=0; shift ;;
    --raw)             raw=1; shift ;;
    -h|--help)         usage; exit 0 ;;
    *)                 echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$url" ]]; then
  echo "Error: no URL provided (pass --url or set \$GAS_URL)" >&2
  exit 2
fi

# Append query string if supplied
target_url="$url"
if [[ -n "$query" ]]; then
  if [[ "$target_url" == *\?* ]]; then
    target_url="${target_url}&${query}"
  else
    target_url="${target_url}?${query}"
  fi
fi

# Build curl args
curl_args=()
(( follow ))   && curl_args+=(-L)
(( silent ))   && curl_args+=(-sS)
(( verbose ))  && curl_args+=(-v)
(( include ))  && curl_args+=(-i)

curl_args+=(-X "$method")

for h in "${headers[@]:-}"; do
  [[ -n "$h" ]] && curl_args+=(-H "$h")
done

if [[ "$method" == "POST" || "$method" == "PUT" || "$method" == "PATCH" ]]; then
  if [[ -n "$data" ]]; then
    curl_args+=(-H "Content-Type: $content_type")
    curl_args+=(--data-binary "$data")
  fi
elif [[ "$method" != "GET" ]]; then
  echo "Warning: method $method not typically supported by Apps Script Web Apps" >&2
fi

curl_args+=("$target_url")

# Execute
if [[ -n "$output" ]]; then
  curl "${curl_args[@]}" -o "$output"
  echo "Saved response to: $output" >&2
  exit 0
fi

response="$(curl "${curl_args[@]}")"

# Pretty-print JSON if jq exists and --raw not set
if (( ! raw )) && command -v jq >/dev/null 2>&1 && \
   [[ "$response" == "{"* || "$response" == "["* ]]; then
  printf '%s\n' "$response" | jq .
else
  printf '%s\n' "$response"
fi
