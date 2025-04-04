#!/usr/bin/env python3
"""
Script to update yt-dlp to the latest version.
This is useful when YouTube changes their website structure
which breaks video extraction.

Usage:
    python update_ytdlp.py
"""

import subprocess
import sys
import os
from datetime import datetime

def update_ytdlp():
    print("Updating yt-dlp to the latest version...")
    
    try:
        # Record current version
        current_version = subprocess.check_output(
            [sys.executable, "-m", "pip", "show", "yt-dlp"], 
            text=True
        )
        for line in current_version.splitlines():
            if line.startswith("Version:"):
                current_version = line.split(":", 1)[1].strip()
                print(f"Current version: {current_version}")
                break
        
        # Run pip to update yt-dlp
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"],
            capture_output=True,
            text=True,
            check=True
        )
        
        print(result.stdout)
        
        # Get new version
        new_version = subprocess.check_output(
            [sys.executable, "-m", "pip", "show", "yt-dlp"], 
            text=True
        )
        for line in new_version.splitlines():
            if line.startswith("Version:"):
                new_version = line.split(":", 1)[1].strip()
                print(f"Updated to version: {new_version}")
                break
        
        # Log the update
        log_dir = "logs"
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, "ytdlp_updates.log")
        
        with open(log_file, "a") as f:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"[{timestamp}] Updated yt-dlp from {current_version} to {new_version}\n")
        
        print(f"Update successful! yt-dlp has been updated from {current_version} to {new_version}")
        print("You need to restart your backend service for changes to take effect.")
        return True
    
    except subprocess.CalledProcessError as e:
        print(f"Error updating yt-dlp: {e}")
        print(f"Error output: {e.stderr}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False

if __name__ == "__main__":
    update_ytdlp() 