import browser_cookie3
import json
import os
from pathlib import Path

def generate_cookies():
    """Generate cookie files for various platforms"""
    try:
        # Create cookies directory if it doesn't exist
        cookies_dir = Path("cookies")
        cookies_dir.mkdir(exist_ok=True)

        # Get YouTube cookies from Chrome
        youtube_cookies = browser_cookie3.chrome(domain_name='.youtube.com')
        google_cookies = browser_cookie3.chrome(domain_name='.google.com')

        # Combine cookies
        all_cookies = []
        
        # Add YouTube cookies
        for cookie in youtube_cookies:
            all_cookies.append({
                'name': cookie.name,
                'value': cookie.value,
                'domain': cookie.domain,
                'path': cookie.path,
                'secure': cookie.secure,
                'expires': cookie.expires if hasattr(cookie, 'expires') else None,
            })
        
        # Add Google cookies
        for cookie in google_cookies:
            all_cookies.append({
                'name': cookie.name,
                'value': cookie.value,
                'domain': cookie.domain,
                'path': cookie.path,
                'secure': cookie.secure,
                'expires': cookie.expires if hasattr(cookie, 'expires') else None,
            })

        # Save as Netscape format
        with open(cookies_dir / "cookies.txt", "w", encoding="utf-8") as f:
            f.write("# Netscape HTTP Cookie File\n")
            f.write("# https://curl.haxx.se/rfc/cookie_spec.html\n")
            f.write("# This is a generated file!  Do not edit.\n\n")
            
            for cookie in all_cookies:
                # Convert to Netscape format
                domain = cookie['domain']
                domain_initial_dot = domain.startswith('.')
                path = cookie['path']
                secure = cookie['secure']
                expires = cookie['expires'] if cookie['expires'] is not None else 2147483647
                name = cookie['name']
                value = cookie['value']
                
                f.write(f"{domain}\t"
                       f"{'TRUE' if domain_initial_dot else 'FALSE'}\t"
                       f"{path}\t"
                       f"{'TRUE' if secure else 'FALSE'}\t"
                       f"{expires}\t"
                       f"{name}\t"
                       f"{value}\n")

        # Also save as JSON for backup
        with open(cookies_dir / "youtube.cookies", "w", encoding="utf-8") as f:
            json.dump(all_cookies, f, indent=2)

        print("Successfully generated cookie files in cookies directory")
        return True

    except Exception as e:
        print(f"Error generating cookies: {str(e)}")
        return False

if __name__ == "__main__":
    generate_cookies() 