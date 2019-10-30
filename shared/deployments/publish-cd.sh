#!/bin/bash
IFS=$'\n'
#APP_CIDs=($(lerna run publish:cd --no-ci --stream| grep -o "Qm[[:alnum:]]\{44\}$"))
lerna run publish:cd --no-ci --stream | tee publishLog.txt
APP_CIDs=($(grep -o "Qm[[:alnum:]]\{44\}$" publishLog.txt))
unset IFS
echo number of apps published: ${#APP_CIDs[*]}

for cid in "${APP_CIDs[@]}"
do
  echo pinning $cid...
  curl "https://ipfs.autark.xyz:5001/api/v0/pin/add?arg=$cid&progress=true"
  echo propagating $cid ... $'\n'
  aragon ipfs propagate $cid
done
