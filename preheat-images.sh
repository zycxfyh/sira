#!/bin/bash

# =================================================================
#
#           NEXUS-VERSE - DOCKER IMAGE CACHE PRE-HEATER (BASH Version)
#
# =================================================================
echo "This script will pull all necessary base images from the internet"
echo "and push them to your local registry (localhost:5000)."
echo ""
echo "This is the LAST time you will need a slow, unstable download."
echo "This process might take a long time. Please be patient."
echo "================================================================="
echo ""

# List of all base images required by the project
IMAGES=(
    "node:20"
    "node:20-slim"
    "nginx:stable-alpine"
    "pgvector/pgvector:pg15"
    "rabbitmq:3-management"
)

# Loop through each image and process it
for image in "${IMAGES[@]}"; do
    echo ""
    echo "-----------------------------------------------------------------"
    echo "Processing image: $image"
    echo "-----------------------------------------------------------------"
    
    echo "[Step 1/3] Pulling from official registry (this may be slow)..."
    docker pull "$image"
    
    echo "[Step 2/3] Tagging for local registry..."
    docker tag "$image" "localhost:5000/$image"
    
    echo "[Step 3/3] Pushing to local registry (this will be fast)..."
    docker push "localhost:5000/$image"
done

echo ""
echo "================================================================="
echo ""
echo "          SUCCESS! All base images are now in your local registry."
echo ""
echo "================================================================="
echo ""