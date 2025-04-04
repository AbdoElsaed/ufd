#!/bin/bash

# Resize the ufd.png to create icons in the required sizes
# This script requires ImageMagick to be installed

echo "Creating extension icons from ufd.png..."

# Source icon file
SOURCE_ICON="ufd-extension/icons/ufd.png"

# Convert to 16x16 icon
convert ${SOURCE_ICON} -resize 16x16 ufd-extension/icons/icon16.png
echo "Created 16x16 icon"

# Convert to 48x48 icon
convert ${SOURCE_ICON} -resize 48x48 ufd-extension/icons/icon48.png
echo "Created 48x48 icon"

# Convert to 128x128 icon
convert ${SOURCE_ICON} -resize 128x128 ufd-extension/icons/icon128.png
echo "Created 128x128 icon"

echo "All icons have been created successfully!"
echo "Icon sizes:"
ls -la ufd-extension/icons/*.png 