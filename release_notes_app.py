"""
Flask application for fetching, caching, and serving Google BigQuery release notes.
Parsed updates are split into individual entries to allow selecting, searching, and sharing.
"""

from datetime import datetime
import logging
import re
import urllib.parse
from flask import Flask, jsonify, render_template
import feedparser
from bs4 import BeautifulSoup, Tag

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# In-memory cache for release notes
# Structure: { "updates": [...], "last_fetched": "YYYY-MM-DD HH:MM:SS" }
_notes_cache = None
_last_fetched = None

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"


def clean_html_content(html_str):
    """
    Cleans up HTML snippet to ensure standard formatting.
    Ensures that all links target '_blank' for secure external opening.
    """
    if not html_str:
        return ""
    soup = BeautifulSoup(html_str, "html.parser")
    for a in soup.find_all("a"):
        a["target"] = "_blank"
        a["rel"] = "noopener noreferrer"
    return str(soup)


def extract_plain_text(html_str):
    """
    Converts HTML snippet to plain text, cleaning up spacing.
    Useful for searches and tweet previews.
    """
    if not html_str:
        return ""
    soup = BeautifulSoup(html_str, "html.parser")
    # Replace links with text (or text + url if we wanted, but text is cleaner for snippet extraction)
    # Get text and clean up whitespaces
    text = soup.get_text(separator=" ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_release_notes():
    """
    Fetches the BigQuery Atom feed and parses it.
    Splits multi-item date entries into individual structured updates.
    """
    logger.info("Fetching BigQuery release notes feed from %s", FEED_URL)
    feed = feedparser.parse(FEED_URL)
    
    parsed_updates = []
    
    for entry in feed.entries:
        date_str = entry.get("title", "Unknown Date")
        updated_time = entry.get("updated", "")
        link = entry.get("link", "")
        
        # Get raw content html
        content_html = entry.get("summary") or ""
        if not content_html and hasattr(entry, "content") and entry.content:
            content_html = entry.content[0].value
            
        soup = BeautifulSoup(content_html, "html.parser")
        
        # Split updates by headers (h3 is standard in GCP feeds)
        current_type = "Update"
        current_nodes = []
        entry_updates = []
        
        for child in soup.children:
            if not isinstance(child, Tag):
                continue
            if child.name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
                # Save previous update if exists
                if current_nodes or current_type != "Update":
                    entry_updates.append((current_type, current_nodes))
                current_type = child.get_text().strip()
                current_nodes = []
            else:
                current_nodes.append(child)
                
        # Append the last update
        if current_nodes or current_type != "Update":
            entry_updates.append((current_type, current_nodes))
            
        # If no updates were extracted (no headers found), fallback to treating the entire entry as a single update
        if not entry_updates:
            entry_updates.append(("Update", list(soup.children)))
            
        # Convert node lists back to clean HTML strings and build list
        for idx, (utype, nodes) in enumerate(entry_updates):
            # Reconstruct HTML content
            html_content = "".join(str(n) for n in nodes if isinstance(n, Tag) or str(n).strip())
            html_content = clean_html_content(html_content)
            
            # Extract clean plain text snippet
            plain_text = extract_plain_text(html_content)
            
            # Generate unique ID for frontend selection
            # Replace spaces and special characters in date and type to make it clean
            safe_date = re.sub(r"[^a-zA-Z0-9]", "_", date_str)
            safe_type = re.sub(r"[^a-zA-Z0-9]", "_", utype)
            update_id = f"{safe_date}_{safe_type}_{idx}"
            
            parsed_updates.append({
                "id": update_id,
                "date": date_str,
                "updated": updated_time,
                "type": utype,
                "content": html_content,
                "plain_text": plain_text,
                "link": link
            })
            
    return parsed_updates


def get_updates(force_refresh=False):
    """
    Retrieves updates from cache or fetches them if cache is empty or expired.
    """
    global _notes_cache, _last_fetched
    
    if _notes_cache is None or force_refresh:
        try:
            updates = parse_release_notes()
            _notes_cache = updates
            _last_fetched = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        except Exception as e:
            logger.error("Error parsing release notes: %s", str(e))
            # Return cached version if exists, otherwise raise
            if _notes_cache is not None:
                return _notes_cache, _last_fetched
            raise e
            
    return _notes_cache, _last_fetched


@app.route("/")
def index():
    """Renders the main web interface."""
    return render_template("index.html")


@app.route("/api/notes", methods=["GET"])
def api_notes():
    """API endpoint to get parsed release notes."""
    try:
        updates, last_fetched = get_updates(force_refresh=False)
        return jsonify({
            "success": True,
            "updates": updates,
            "last_fetched": last_fetched
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/api/notes/refresh", methods=["POST"])
def api_refresh():
    """API endpoint to force-refresh release notes."""
    try:
        updates, last_fetched = get_updates(force_refresh=True)
        return jsonify({
            "success": True,
            "updates": updates,
            "last_fetched": last_fetched
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


if __name__ == "__main__":
    # For direct execution, run local Flask development server
    app.run(host="127.0.0.1", port=5000, debug=True)
