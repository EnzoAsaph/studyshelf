#!/usr/bin/env bash
# Copies StudyShelf to both web servers.
# Usage (from the project folder):  ./deploy/deploy.sh ~/.ssh/id_rsa
set -e

KEY="${1:-$HOME/.ssh/id_rsa}"
SERVERS="3.82.203.173 13.221.226.57"   # web-01 and web-02
FILES="index.html css js"

for IP in $SERVERS; do
    echo "==> Deploying to $IP"
    # 1. Copy the app files to a temporary folder on the server
    ssh -i "$KEY" ubuntu@"$IP" "rm -rf /tmp/studyshelf && mkdir -p /tmp/studyshelf"
    scp -i "$KEY" -r $FILES ubuntu@"$IP":/tmp/studyshelf/

    # 2. Move them into the web folder and reload Nginx
    ssh -i "$KEY" ubuntu@"$IP" "sudo mkdir -p /var/www/studyshelf \
        && sudo rm -rf /var/www/studyshelf/* \
        && sudo cp -r /tmp/studyshelf/* /var/www/studyshelf/ \
        && sudo chown -R www-data:www-data /var/www/studyshelf \
        && sudo nginx -t && sudo systemctl reload nginx"

    # 3. Check the page answers
    curl -s -o /dev/null -w "    http://$IP/studyshelf/ -> %{http_code}\n" "http://$IP/studyshelf/"
done

echo "Done. Open https://www.enzoasaph.tech/studyshelf/"
