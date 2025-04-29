from flask import Flask, render_template, request, jsonify, Response, url_for, send_from_directory
from mpd import MPDClient, MPDError, ConnectionError
import logging
import os
from functools import wraps
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("music_player.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Rate limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per minute", "5 per second"],
    storage_uri="memory://",
)

# Configuration - Better to use environment variables in production
MPD_HOST = os.environ.get("MPD_HOST", "localhost")
MPD_PORT = int(os.environ.get("MPD_PORT", 6600))
MPD_PASSWORD = os.environ.get("MPD_PASSWORD", None)
RECONNECT_ATTEMPTS = 3

def get_mpd_client() -> MPDClient:
    """Create and connect an MPD client."""
    client = MPDClient()
    try:
        client.connect(MPD_HOST, MPD_PORT)
        if MPD_PASSWORD:
            client.password(MPD_PASSWORD)
        return client
    except ConnectionError as e:
        logger.error(f"Failed to connect to MPD server: {e}")
        raise

def safe_mpd_operation(operation):
    """Execute an MPD operation with error handling and reconnection attempt."""
    @wraps(operation)
    def wrapper(*args, **kwargs):
        for attempt in range(RECONNECT_ATTEMPTS):
            try:
                client = get_mpd_client()
                try:
                    result = operation(client, *args, **kwargs)
                    client.disconnect()
                    return result
                except MPDError as e:
                    logger.error(f"MPD error: {e}")
                    client.disconnect()
                    return jsonify({'error': str(e)}), 500
            except ConnectionError as e:
                logger.error(f"Connection error (attempt {attempt+1}/{RECONNECT_ATTEMPTS}): {e}")
                if attempt == RECONNECT_ATTEMPTS - 1:
                    return jsonify({'error': 'Could not connect to music server'}), 503
        
    return wrapper

@app.route('/')
def index():
    """Render the main web interface."""
    return render_template('index.html')

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files."""
    return send_from_directory('static', filename)

@app.route('/api/status')
@limiter.limit("10 per second")
@safe_mpd_operation
def status(client):
    """Get current playback status and song info."""
    status = client.status()
    currentsong = client.currentsong()
    return jsonify({'status': status, 'current_song': currentsong})

@app.route('/api/play', methods=['POST'])
@limiter.limit("5 per second")
@safe_mpd_operation
def play(client):
    """Start or resume playback."""
    client.play()
    return jsonify({'success': True}), 200

@app.route('/api/pause', methods=['POST'])
@limiter.limit("5 per second")
@safe_mpd_operation
def pause(client):
    """Pause playback."""
    client.pause()
    return jsonify({'success': True}), 200

@app.route('/api/stop', methods=['POST'])
@limiter.limit("5 per second")
@safe_mpd_operation
def stop(client):
    """Stop playback."""
    client.stop()
    return jsonify({'success': True}), 200

@app.route('/api/next', methods=['POST'])
@limiter.limit("5 per second")
@safe_mpd_operation
def next_track(client):
    """Skip to the next track."""
    client.next()
    return jsonify({'success': True}), 200

@app.route('/api/previous', methods=['POST'])
@limiter.limit("5 per second")
@safe_mpd_operation
def previous_track(client):
    """Go back to the previous track."""
    client.previous()
    return jsonify({'success': True}), 200

@app.route('/api/seek', methods=['POST'])
@limiter.limit("5 per second")
@safe_mpd_operation
def seek(client):
    """Seek to a position in the current song."""
    position = request.form.get('position')
    song_id = request.form.get('id')
    
    if not position or not position.replace('.', '', 1).isdigit():
        return jsonify({'error': 'Invalid position value'}), 400
    
    position = float(position)
    
    if song_id and song_id.isdigit():
        # Seek in specific song
        client.seekid(song_id, position)
    else:
        # Seek in current song
        client.seekcur(position)
        
    return jsonify({'success': True, 'position': position}), 200

@app.route('/api/volume', methods=['POST'])
@limiter.limit("5 per second")
@safe_mpd_operation
def set_volume(client):
    """Set the volume level (0-100)."""
    volume = request.form.get('volume')
    if not volume or not volume.isdigit() or not 0 <= int(volume) <= 100:
        return jsonify({'error': 'Invalid volume value'}), 400
    
    client.setvol(int(volume))
    return jsonify({'success': True, 'volume': int(volume)}), 200

@app.route('/api/playlist')
@limiter.limit("5 per second")
@safe_mpd_operation
def get_playlist(client):
    """Get the current playlist."""
    return jsonify(client.playlistinfo())

@app.route('/api/playlist/add', methods=['POST'])
@limiter.limit("10 per minute")
@safe_mpd_operation
def add_to_playlist(client):
    """Add a track to the current playlist."""
    uri = request.form.get('uri')
    if not uri:
        return jsonify({'error': 'URI is required'}), 400
    
    # Security: URI validation
    if '../' in uri or uri.startswith('/'):
        return jsonify({'error': 'Invalid URI format'}), 400
        
    client.add(uri)
    return jsonify({'success': True, 'uri': uri}), 200

@app.route('/api/playlist/addplay', methods=['POST'])
@limiter.limit("10 per minute")
@safe_mpd_operation
def add_and_play(client):
    """Add a track to the playlist and play it immediately."""
    uri = request.form.get('uri')
    if not uri:
        return jsonify({'error': 'URI is required'}), 400
    
    # Security: URI validation
    if '../' in uri or uri.startswith('/'):
        return jsonify({'error': 'Invalid URI format'}), 400
    
    # Add track and get its position
    current_playlist = client.playlistinfo()
    client.add(uri)
    new_playlist = client.playlistinfo()
    
    # Find the track we just added (should be the last one)
    if len(new_playlist) > len(current_playlist):
        new_position = len(new_playlist) - 1
        client.play(new_position)
        return jsonify({'success': True, 'uri': uri, 'position': new_position}), 200
    else:
        return jsonify({'error': 'Failed to add track'}), 500

@app.route('/api/playlist/remove', methods=['POST'])
@limiter.limit("10 per second")
@safe_mpd_operation
def remove_from_playlist(client):
    """Remove a track from the current playlist by position."""
    position = request.form.get('position')
    if not position or not position.isdigit():
        return jsonify({'error': 'Invalid position'}), 400
    
    client.delete(int(position))
    return jsonify({'success': True}), 200

@app.route('/api/playlist/play', methods=['POST'])
@limiter.limit("5 per second")
@safe_mpd_operation
def play_playlist_position(client):
    """Play a specific track in the playlist by position."""
    position = request.form.get('position')
    if not position or not position.isdigit():
        return jsonify({'error': 'Invalid position'}), 400
    
    client.play(int(position))
    return jsonify({'success': True}), 200

@app.route('/api/playlist/clear', methods=['POST'])
@limiter.limit("3 per minute")
@safe_mpd_operation
def clear_playlist(client):
    """Clear the current playlist."""
    client.clear()
    return jsonify({'success': True}), 200

@app.route('/api/search')
@limiter.limit("3 per second")
@safe_mpd_operation
def search(client):
    """Search for tracks in the music library."""
    query = request.args.get('query', '')
    if not query:
        return jsonify([])
    
    # Security: Limit query length to prevent DOS
    if len(query) > 100:
        query = query[:100]
    
    results = client.search('any', query)
    return jsonify(results)

@app.route('/api/playlists')
@limiter.limit("3 per second")
@safe_mpd_operation
def get_stored_playlists(client):
    """Get all stored playlists."""
    playlists = client.listplaylists()
    return jsonify(playlists)

@app.route('/api/random', methods=['POST'])
@limiter.limit("5 per second")
@safe_mpd_operation
def toggle_random(client):
    """Toggle shuffle mode."""
    current_status = client.status()
    new_state = '0' if current_status.get('random') == '1' else '1'
    client.random(int(new_state))
    return jsonify({'success': True, 'random': new_state == '1'}), 200

@app.route('/api/repeat', methods=['POST'])
@limiter.limit("5 per second")
@safe_mpd_operation
def toggle_repeat(client):
    """Toggle repeat mode."""
    current_status = client.status()
    new_state = '0' if current_status.get('repeat') == '1' else '1'
    client.repeat(int(new_state))
    return jsonify({'success': True, 'repeat': new_state == '1'}), 200

@app.route('/api/health')
def health_check():
    """Simple health check endpoint."""
    try:
        client = get_mpd_client()
        client.ping()
        client.disconnect()
        return jsonify({'status': 'ok', 'service': 'MPD'}), 200
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 503

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    """Handle 405 errors."""
    return jsonify({'error': 'Method not allowed'}), 405

@app.errorhandler(500)
def server_error(error):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(host='192.168.10.100', port=5500, debug=True)