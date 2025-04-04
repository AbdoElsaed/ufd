#!/bin/bash

# Resize the ufd-logo.png to create icons in the required sizes
# This script requires ImageMagick to be installed

echo "Creating extension icons from ufd-logo.png..."

# Convert to 16x16 icon
convert icons/ufd-logo.png -resize 16x16 icons/icon16.png
echo "Created 16x16 icon"

# Convert to 48x48 icon
convert icons/ufd-logo.png -resize 48x48 icons/icon48.png
echo "Created 48x48 icon"

# Convert to 128x128 icon
convert icons/ufd-logo.png -resize 128x128 icons/icon128.png
echo "Created 128x128 icon"

echo "All icons have been created successfully!"
echo "Icon sizes:"
ls -la icons/*.png 