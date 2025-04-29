# MPD Web Remote

A responsive web interface for controlling the Music Player Daemon (MPD) from any device. This application provides a modern, feature-rich web client that lets you manage your music playback through an intuitive UI.

## Features

- **Real-time Playback Control**: Play, pause, stop, and navigate between tracks
- **Playlist Management**: View, add to, and modify your current playlist
- **Music Library Search**: Search your music collection by any field
- **Volume Control**: Adjust volume with an interactive slider
- **Playback Modes**: Toggle shuffle and repeat modes
- **Progress Bar**: View and seek through the current track
- **Responsive Design**: Works on desktop and mobile devices
- **Keyboard Shortcuts**: Control playback using keyboard keys
- **Notifications**: Get feedback on actions with an unobtrusive notification system
- **Error Handling**: Robust error handling with reconnection logic

## Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS, JavaScript (with jQuery)
- **Communication**: RESTful API
- **MPD Interaction**: python-mpd2 library

## Screenshots

*[Insert screenshots here]*

## Installation

### Prerequisites

- Python 3.6+
- MPD (Music Player Daemon) running somewhere accessible
- pip (Python package manager)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/mpd-web-remote.git
   cd mpd-web-remote
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure the application:
   Set the following environment variables or modify the defaults in `app.py`:
   - `MPD_HOST`: The hostname or IP address of your MPD server (default: localhost)
   - `MPD_PORT`: The port your MPD server is listening on (default: 6600)
   - `MPD_PASSWORD`: Password for MPD if required (default: None)

4. Run the application:
   ```bash
   python app.py
   ```

5. Access the web interface:
   Open your browser and go to `http://localhost:5000`

## API Endpoints

The application provides a RESTful API for interacting with MPD:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Get current playback status and song info |
| `/api/play` | POST | Start or resume playback |
| `/api/pause` | POST | Pause playback |
| `/api/stop` | POST | Stop playback |
| `/api/next` | POST | Skip to the next track |
| `/api/previous` | POST | Go back to the previous track |
| `/api/seek` | POST | Seek to a position in the current song |
| `/api/volume` | POST | Set the volume level (0-100) |
| `/api/playlist` | GET | Get the current playlist |
| `/api/playlist/add` | POST | Add a track to the current playlist |
| `/api/playlist/remove` | POST | Remove a track from the current playlist |
| `/api/playlist/play` | POST | Play a specific track in the playlist |
| `/api/playlist/clear` | POST | Clear the current playlist |
| `/api/search` | GET | Search for tracks in the music library |
| `/api/playlists` | GET | Get all stored playlists |
| `/api/random` | POST | Toggle shuffle mode |
| `/api/repeat` | POST | Toggle repeat mode |
| `/api/health` | GET | Check server health |

## Security Features

- Input validation and sanitization
- Rate limiting to prevent abuse
- URI validation to prevent path traversal

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| Right Arrow | Next track |
| Left Arrow | Previous track |
| N | Next track |
| P | Previous track |
| S | Stop playback |

## Configuration

The application includes several configurable parameters:

- Update interval for status polling
- Notification duration
- Progress bar update frequency
- Connection timeout values
- Reconnection attempts

## Contributions

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [MPD](https://www.musicpd.org/) for the awesome music server
- [python-mpd2](https://github.com/Mic92/python-mpd2) for the Python MPD client library
- [Flask](https://flask.palletsprojects.com/) for the lightweight web framework
- [Font Awesome](https://fontawesome.com/) for the icons

## Todo

- Add support for stored playlists
- Implement album art display
- Add music library browsing by folders/albums/artists
- Support for custom themes
- Add user authentication for multi-user setups
