#!/bin/sh
# Synology DSM 3rd-party App Entry CGI
echo "Content-Type: text/html"
echo "X-Frame-Options: SAMEORIGIN"
echo ""

# Extract host IP or hostname from incoming environment
HOST_IP=$(echo "$HTTP_HOST" | cut -d: -f1)

cat <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SynDirStat</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #14171f;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe src="http://${HOST_IP}:8742/" allowfullscreen></iframe>
</body>
</html>
EOF
