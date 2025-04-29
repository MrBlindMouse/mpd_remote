/**
 * MPD Web Client
 * Main JavaScript file for the Music Player Remote web interface
 */

// Global state
const state = {
    updateIntervalId: null,
    connectionFailed: false,
    currentStatus: {},
    currentSong: {},
    playerState: 'stop',
    elapsedTime: 0,
    duration: 0,
    progressUpdateInterval: null
};

// Constants
const UPDATE_INTERVAL = 5000;  // Status update interval in ms
const NOTIFICATION_DURATION = 3000;  // Time to show notifications in ms
const PROGRESS_UPDATE_INTERVAL = 1000;  // Progress bar update interval in ms

/**
 * Show a notification message
 * @param {string} message - Message to display
 * @param {boolean} isError - Whether this is an error message
 */
function showNotification(message, isError = true) {
    const notification = $('#notification');
    notification.text(message);
    notification.css('background-color', isError ? 'var(--error-color)' : 'var(--success-color)');
    notification.fadeIn();
    
    // Clear any existing timeout
    if (notification.data('timeoutId')) {
        clearTimeout(notification.data('timeoutId'));
    }
    
    // Set new timeout to hide notification
    const timeoutId = setTimeout(() => {
        notification.fadeOut();
    }, NOTIFICATION_DURATION);
    
    notification.data('timeoutId', timeoutId);
}

/**
 * Handle AJAX errors
 * @param {Object} xhr - XHR object
 * @param {string} status - Status text
 * @param {string} error - Error message
 */
function handleAjaxError(xhr, status, error) {
    console.error(`${status}: ${error}`);
    
    if (xhr.status === 0) {
        if (!state.connectionFailed) {
            showNotification('Could not connect to server. Please check if the server is running.');
            state.connectionFailed = true;
        }
    } else {
        let message = 'An error occurred';
        try {
            const response = JSON.parse(xhr.responseText);
            if (response.error) {
                message = response.error;
            }
        } catch (e) {
            message = `Error: ${xhr.status} ${error}`;
        }
        showNotification(message);
    }
}

/**
 * Format seconds to MM:SS
 * @param {number} seconds - Number of seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Update playback progress
 */
function updateProgress() {
    if (state.playerState !== 'play') return;
    
    state.elapsedTime += 1;
    if (state.duration > 0) {
        const percentage = (state.elapsedTime / state.duration) * 100;
        $('#progress').css('width', `${Math.min(percentage, 100)}%`);
    }
    
    $('#current-time').text(formatTime(state.elapsedTime));
}

/**
 * Update the volume icon based on volume level
 * @param {number} volume - Volume level (0-100)
 */
function updateVolumeIcon(volume) {
    const volumeIcon = $('#volume-icon');
    volumeIcon.removeClass('fa-volume-up fa-volume-down fa-volume-off fa-volume-mute');
    
    if (volume >= 70) {
        volumeIcon.addClass('fa-volume-up');
    } else if (volume >= 30) {
        volumeIcon.addClass('fa-volume-down');
    } else if (volume > 0) {
        volumeIcon.addClass('fa-volume-off');
    } else {
        volumeIcon.addClass('fa-volume-mute');
    }
}

/**
 * Update player status
 */
function updateStatus() {
    $.ajax({
        url: '/status',
        method: 'GET',
        timeout: 3000,
        success: function(data) {
            state.connectionFailed = false;
            state.currentSong = data.current_song || {};
            state.currentStatus = data.status || {};
            state.playerState = state.currentStatus.state || 'stop';
            
            // Update current track info
            const trackInfo = state.currentSong.title ? 
                `${state.currentSong.artist || 'Unknown'} - ${state.currentSong.title}` : 
                'No track playing';
            $('#current-track').text(trackInfo);
            
            // Update status and apply active style to now-playing section if playing
            $('#status').text(`Status: ${state.playerState || 'Unknown'}`);
            $('.now-playing').toggleClass('active', state.playerState === 'play');
            
            // Update toggle buttons
            $('#random span').text(`Shuffle: ${state.currentStatus.random === '1' ? 'On' : 'Off'}`);
            $('#random').toggleClass('active', state.currentStatus.random === '1');
            
            $('#repeat span').text(`Repeat: ${state.currentStatus.repeat === '1' ? 'On' : 'Off'}`);
            $('#repeat').toggleClass('active', state.currentStatus.repeat === '1');
            
            // Update volume slider if it's not being adjusted
            if (!$('#volume').is(':active')) {
                const volume = parseInt(state.currentStatus.volume || 0);
                $('#volume').val(volume);
                $('#volume-value').text(`${volume}%`);
                updateVolumeIcon(volume);
            }
            
            // Update progress information
            if (state.currentStatus.duration) {
                state.duration = parseFloat(state.currentStatus.duration);
                state.elapsedTime = parseFloat(state.currentStatus.elapsed || 0);
                
                $('#total-time').text(formatTime(state.duration));
                $('#current-time').text(formatTime(state.elapsedTime));
                
                const percentage = (state.elapsedTime / state.duration) * 100;
                $('#progress').css('width', `${Math.min(percentage, 100)}%`);
            }
            
            // Start or stop progress updates based on play state
            if (state.playerState === 'play' && !state.progressUpdateInterval) {
                state.progressUpdateInterval = setInterval(updateProgress, PROGRESS_UPDATE_INTERVAL);
            } else if (state.playerState !== 'play' && state.progressUpdateInterval) {
                clearInterval(state.progressUpdateInterval);
                state.progressUpdateInterval = null;
            }
        },
        error: handleAjaxError
    });
}

/**
 * Update playlist display
 */
function updatePlaylist() {
    $.ajax({
        url: '/playlist',
        method: 'GET',
        success: function(data) {
            let playlist = $('#playlist').empty();
            
            if (data.length === 0) {
                playlist.append('<li>Playlist is empty</li>');
                return;
            }
            
            data.forEach((track, index) => {
                // Create a list item with track info and play/remove buttons
                let li = $('<li>');
                let trackInfo = $('<div class="track-info">').text(
                    `${track.artist || 'Unknown'} - ${track.title || track.file}`
                );
                
                // Create remove button
                let removeBtn = $('<button>').html('<i class="fas fa-trash"></i>')
                    .attr('title', 'Remove from playlist')
                    .click(function(e) {
                        e.stopPropagation(); // Prevent li click
                        removeFromPlaylist(index);
                    });
                
                li.append(trackInfo).append(removeBtn);
                
                // Make entire row clickable to play that track
                li.css('cursor', 'pointer').click(function() {
                    jumpToTrack(index);
                });
                
                // Highlight current track
                if (state.currentSong && state.currentSong.id === track.id) {
                    li.css('background-color', 'rgba(52, 152, 219, 0.2)');
                }
                
                playlist.append(li);
            });
        },
        error: handleAjaxError
    });
}

/**
 * Perform an action on the server
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Data to send
 * @param {string} successMessage - Message to show on success
 */
function performAction(endpoint, data = {}, successMessage = null) {
    $.ajax({
        url: endpoint,
        method: 'POST',
        data: data,
        beforeSend: function() {
            $('.controls button').addClass('loading');
        },
        success: function(response) {
            if (successMessage) {
                showNotification(successMessage, false);
            }
            // Update immediately instead of waiting for interval
            updateStatus();
            updatePlaylist();
        },
        error: handleAjaxError,
        complete: function() {
            $('.controls button').removeClass('loading');
        }
    });
}

/**
 * Remove a track from the playlist
 * @param {number} position - Position in playlist
 */
function removeFromPlaylist(position) {
    performAction('/playlist/remove', { position: position }, 'Track removed from playlist');
}

/**
 * Jump to a specific track in the playlist
 * @param {number} position - Position in playlist
 */
function jumpToTrack(position) {
    // The server needs an endpoint to play a specific position
    // For now, just console log this action
    console.log(`Jump to track at position ${position}`);
    // TODO: Implement this functionality in the server
}

/**
 * Seek to a position in the current track
 * @param {number} position - Position in seconds
 */
function seekToPosition(position) {
    // The server needs an endpoint to seek to a position
    // For now, just console log this action
    console.log(`Seek to position ${position}`);
    // TODO: Implement this functionality in the server
}

/**
 * Search for tracks
 */
function searchTracks() {
    const query = $('#search-query').val();
    if (!query) {
        $('#search-results').empty();
        return;
    }
    
    $.ajax({
        url: '/search',
        method: 'GET',
        data: { query: query },
        beforeSend: function() {
            $('#search-results').html('<li>Searching...</li>');
        },
        success: function(data) {
            let results = $('#search-results').empty();
            
            if (data.length === 0) {
                results.append('<li>No tracks found</li>');
                return;
            }
            
            data.forEach(track => {
                let li = $('<li>');
                let trackInfo = $('<div class="track-info">').text(
                    `${track.artist || 'Unknown'} - ${track.title || track.file}`
                );
                let addBtn = $('<button>').html('<i class="fas fa-plus"></i>')
                    .attr('title', 'Add to playlist')
                    .click(function() {
                        addToPlaylist(track.file);
                    });
                
                // Add play now button
                let playNowBtn = $('<button>').html('<i class="fas fa-play"></i>')
                    .attr('title', 'Play now')
                    .css('margin-right', '5px')
                    .click(function() {
                        addAndPlayTrack(track.file);
                    });
                
                let buttonGroup = $('<div>').append(playNowBtn).append(addBtn);
                
                li.append(trackInfo).append(buttonGroup);
                results.append(li);
            });
        },
        error: handleAjaxError
    });
}

/**
 * Add a track to the playlist
 * @param {string} uri - Track URI
 */
function addToPlaylist(uri) {
    performAction('/playlist/add', { uri: uri }, 'Track added to playlist');
}

/**
 * Add a track to the playlist and play it immediately
 * @param {string} uri - Track URI
 */
function addAndPlayTrack(uri) {
    // This would require a new endpoint in the server
    console.log(`Add and play: ${uri}`);
    // TODO: Implement this functionality in the server
}

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
    // Playback controls
    $('#play').click(() => performAction('/play', {}, 'Playback started'));
    $('#pause').click(() => performAction('/pause', {}, 'Playback paused'));
    $('#stop').click(() => performAction('/stop', {}, 'Playback stopped'));
    $('#next').click(() => performAction('/next', {}, 'Playing next track'));
    $('#previous').click(() => performAction('/previous', {}, 'Playing previous track'));
    $('#random').click(() => performAction('/random', {}, 'Shuffle toggled'));
    $('#repeat').click(() => performAction('/repeat', {}, 'Repeat toggled'));

    // Volume control
    $('#volume').on('input', function() {
        const volume = this.value;
        $('#volume-value').text(`${volume}%`);
        updateVolumeIcon(volume);
    });
    
    $('#volume').on('change', function() {
        performAction('/volume', { volume: this.value }, `Volume set to ${this.value}%`);
    });

    // Progress bar control
    $('#progress-bar').on('click', function(e) {
        if (!state.duration) return;
        
        const clickPosition = e.pageX - $(this).offset().left;
        const width = $(this).width();
        const percentage = clickPosition / width;
        const seekTime = Math.floor(state.duration * percentage);
        
        seekToPosition(seekTime);
    });

    // Search functionality
    $('#search').click(searchTracks);
    $('#search-query').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            searchTracks();
        }
    });
    
    // Keyboard shortcuts
    $(document).on('keydown', function(e) {
        if (e.target.tagName === 'INPUT') return; // Don't trigger when typing in inputs
        
        switch (e.key) {
            case ' ':  // Space bar for play/pause
                e.preventDefault();
                if (state.playerState === 'play') {
                    $('#pause').click();
                } else {
                    $('#play').click();
                }
                break;
            case 'ArrowRight':  // Right arrow for next track
                $('#next').click();
                break;
            case 'ArrowLeft':  // Left arrow for previous track
                $('#previous').click();
                break;
            case 'n':  // n for next
                $('#next').click();
                break;
            case 'p':  // p for previous
                $('#previous').click();
                break;
            case 's':  // s for stop
                $('#stop').click();
                break;
        }
    });
}

/**
 * Check server health
 */
function checkServerHealth() {
    $.ajax({
        url: '/health',
        method: 'GET',
        timeout: 3000,
        success: function(data) {
            if (data.status === 'ok') {
                showNotification('Connected to music server', false);
            }
        },
        error: function() {
            showNotification('Could not connect to music server');
        }
    });
}

/**
 * Initialize the application
 */
$(document).ready(function() {
    // Initial update
    updateStatus();
    updatePlaylist();
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Setup periodic updates
    state.updateIntervalId = setInterval(() => {
        updateStatus();
        updatePlaylist();
    }, UPDATE_INTERVAL);
    
    // Check server health initially
    checkServerHealth();
});