import {Utils} from "@eluvio/elv-client-js";

const PlayerProfiles = {
  default: {
    label: "Default",
    hlsSettings: Utils.HLSJSSettings({profile: "default"}),
  },
  low_latency: {
    label: "Low Latency Live",
    hlsSettings: Utils.HLSJSSettings({profile: "ll"})
  },
  ultra_low_latency: {
    label: "Ultra Low Latency Live",
    hlsSettings: Utils.HLSJSSettings({profile: "ull"})
  },
  custom: {
    label: "Custom",
    hlsSettings: {}
  }
};

/**
 * The Eluvio Player has a full set of APIs to control the video and retrieve information about the current state. Access player controls via `player.controls`
 */
class PlayerControls {
  constructor({player}) {
    this.player = player;
    this.visible = true;
    this.allowRotation = true;
  }

  /**
   * Check if the player controls are currently visible (not auto-hidden)
   *
   * @methodGroup Controls
   * @returns {boolean} - Whether or not the controls are visible
   */
  IsVisible() {
    return this.visible;
  }

  /**
   * Check if the player has finished loading
   *
   * @methodGroup Playback
   * @returns {boolean} - Whether or not the player has finished loading
   */
  IsReady() {
    return !this.player.loading;
  }

  /**
   * Check if the video is currently playing
   *
   * @methodGroup Playback
   * @returns {boolean} - Whether or not the video is currently playing
   */
  IsPlaying() {
    return !this.player.video.paused;
  }

  /**
   * Check if video playback has been started since the content was loaded
   *
   * @methodGroup Playback
   * @returns {boolean} - Whether or not playback has been started
   */
  HasPlaybackStarted() {
    return this.player.playbackStarted;
  }

  /**
   * Play the video
   *
   * @methodGroup Playback
   *
   * @returns {boolean} - Whether or not the video was able to start playing. Browser autoplay policies may block video from playing without user interaction.
   */
  async Play() {
    return await this.player.__Play();
  }

  /**
   * Pause the video
   *
   * @methodGroup Playback
   */
  Pause() {
    this.player.video.pause();
  }

  /**
   * Play the video if not playing, otherwise pause the video
   *
   * @methodGroup Playback
   * @returns {boolean} - False if the video was paused, true if playback was started
   */
  TogglePlay() {
    if(this.player.video.paused) {
      this.Play();
      return true;
    } else {
      this.Pause();
      return false;
    }
  }

  /**
   * Stop playback, return the seek position to the start, and reset 'playback started' to false
   *
   * @methodGroup Playback
   */
  Stop() {
    this.Pause();
    this.Seek({time: 0});
    this.player.playbackStarted = false;

    this.player.__SettingsUpdate();
  }

  /**
   * Retrieve the current time of the video
   *
   * @methodGroup Seek
   *
   * @returns {number} - The current time of the video
   */
  GetCurrentTime() {
    return this.player.video.currentTime;
  }

  /**
   * Retrieve the duration of the video
   *
   * @methodGroup Seek
   *
   * @returns {number} - The duration of the video. May be Infinity if content is live
   */
  GetDuration() {
    return this.player.video.duration;
  }

  /**
   * Seek the video to the specified time
   *
   * @methodGroup Seek
   * @namedParams
   * @param {number=} time - Seek to the specified time
   * @param {number=} relativeSeconds- Seek relative to the current time, e.g. `10` to skip 10 seconds ahead, or `-30` for 30 seconds back
   * @param {number=} fraction - Specify a fraction of the video to seek to, e.g. `0.5` for the halfway point
   *
   * @returns {boolean} - False if the video was paused, true if playback was started
   */
  Seek({fraction, time, relativeSeconds}) {
    if(!this.player.video || (fraction && !this.player.video.duration)) {
      return;
    }

    const originalTime = this.player.video.currentTime;

    if(relativeSeconds) {
      this.player.video.currentTime = Math.max(
        0,
        Math.min(
          this.player.video.duration,
          this.player.video.currentTime + relativeSeconds
        )
      );
    } else if(typeof fraction !== "undefined") {
      this.player.video.currentTime = this.player.video.duration * fraction;
    } else {
      this.player.video.currentTime = time;
    }

    return originalTime <= this.player.video.currentTime;
  }

  /**
   * Retrieve the current volume of the video. Note that if the video is muted, this value may still be > 0
   *
   * @methodGroup Volume
   *
   * @returns {number} - The current volume of the video
   */
  GetVolume() {
    return this.player.video.volume;
  }

  /**
   * Set the video volume
   *
   * @methodGroup Volume
   * @namedParams
   * @param {number=} fraction - Set the volume to the specified amount - `0` for muted, `1` for for volume
   * @param {number=} relativeFraction - Adjust the volume by the specified fraction, e.g. `0.1` for +10%
   *
   * @returns {boolean} - The resulting volume of the video
   */
  SetVolume({fraction, relativeFraction}) {
    if(relativeFraction) {
      this.player.video.volume = Math.min(1, Math.max(0, this.GetVolume() + relativeFraction));
    } else {
      this.player.video.volume = fraction;
    }

    if(this.player.video.volume > 0) {
      this.Unmute(false);
    }

    return this.player.video.volume;
  }

  /**
   * Retrieve whether or not the video is currently muted
   *
   * @methodGroup Volume
   *
   * @returns {boolean} - Whether or not the video is currently muted
   */
  IsMuted() {
    return this.player.video.muted;
  }

  /**
   * Mute the video
   *
   * @methodGroup Volume
   */
  Mute() {
    this.player.video.muted = true;
  }

  /**
   * Unmute the video
   *
   * @methodGroup Volume
   */
  Unmute() {
    this.player.video.muted = false;
  }

  /**
   * Toggle whether or not the video is muted
   *
   * @methodGroup Volume
   *
   * @returns {boolean} - True if the video was muted, false if unmuted
   */
  ToggleMuted() {
    this.player.video.muted = !this.player.video.muted;
    return this.player.video.muted;
  }

  /**
   * Retrieve whether or not the player is currently fullscreen
   *
   * @methodGroup Fullscreen
   *
   * @returns {boolean} - Whether or not the player is currently fullscreen
   */
  IsFullscreen() {
    return (
      document.fullscreenElement ||
      document.mozFullScreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    ) === this.player.target;
  }

  /**
   * Request the player go fullscreen
   *
   * @methodGroup Fullscreen
   */
  Fullscreen() {
    if(this.player.target.requestFullscreen) {
      this.player.target.requestFullscreen({navigationUI: "hide"});
    } else if(this.player.target.mozRequestFullScreen) {
      this.player.target.mozRequestFullScreen({navigationUI: "hide"});
    } else if(this.player.target.webkitRequestFullscreen) {
      this.player.target.webkitRequestFullscreen({navigationUI: "hide"});
    } else if(this.player.target.msRequestFullscreen) {
      this.player.target.msRequestFullscreen({navigationUI: "hide"});
    } else {
      // iPhone - Use native fullscreen on video element only
      this.player.target.querySelector("video").webkitEnterFullScreen();
    }
  }

  /**
   * Exit fullscreen
   *
   * @methodGroup Fullscreen
   */
  ExitFullscreen() {
    if(document.exitFullscreen) {
      document.exitFullscreen();
    } else if(document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if(document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if(document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }

  /**
   * Request the player go fullscreen if not currently, otherwise exit fullscreen
   *
   * @methodGroup Fullscreen
   *
   * @returns {boolean} - True if fullscreen video was requested, false if fullscreen was exited
   */
  ToggleFullscreen() {
    if(this.IsFullscreen()) {
      this.ExitFullscreen();
      return false;
    } else {
      this.Fullscreen();
      return true;
    }
  }

  // Collections

  /**
   * Retrieve info about the current collection
   *
   * @methodGroup Collections
   *
   * @returns {Object | undefined} - Info about the current collection if present, undefined if no collection is present
   */
  GetCollectionInfo() {
    if(!this.player.collectionInfo) { return; }

    const collectionInfo = {...this.player.collectionInfo };
    collectionInfo.content = collectionInfo.content.map(content => ({
      ...content,
      active: content.mediaIndex === collectionInfo.mediaIndex
    }));

    collectionInfo.active = collectionInfo.content[collectionInfo.mediaIndex];

    return collectionInfo;
  }

  /**
   * Play the specified collection item
   *
   * @methodGroup Collections
   * @namedParams
   * @param {number=} mediaIndex - Specify a collection item by its index in the collection
   * @param {string=} mediaId - Specify a collection item by its ID
   * @param {boolean=} autoplay - Whether or not the video should automatically start playing when the collection item starts. If omitted, autoplay state will depend on whether the video is currently playing.
   */
  CollectionPlay({mediaIndex, mediaId, autoplay}) {
    if(this.player.loading) { return; }

    this.player.__CollectionPlay({mediaId, mediaIndex, autoplay});

    this.player.__SettingsUpdate();
  }

  /**
   * Play the next item in the collection, if present
   *
   * @methodGroup Collections
   * @namedParams
   * @param {boolean=} autoplay - Whether or not the video should automatically start playing when the collection item starts. If omitted, autoplay state will depend on whether the video is currently playing.
   */
  CollectionPlayNext({autoplay}={}) {
    const collectionInfo = this.GetCollectionInfo();

    if(!collectionInfo) { return; }

    const nextIndex = Math.min(collectionInfo.mediaIndex + 1, collectionInfo.mediaLength - 1);

    if(nextIndex === collectionInfo.mediaIndex) { return; }

    this.CollectionPlay({mediaIndex: nextIndex, autoplay});
  }

  /**
   * Play the previous item in the collection, if present
   *
   * @methodGroup Collections
   * @namedParams
   * @param {boolean=} autoplay - Whether or not the video should automatically start playing when the collection item starts. If omitted, autoplay state will depend on whether the video is currently playing.
   */
  CollectionPlayPrevious({autoplay}={}) {
    const collectionInfo = this.GetCollectionInfo();

    if(!collectionInfo) { return; }

    const previousIndex = Math.max(0, collectionInfo.mediaIndex - 1);

    if(previousIndex === collectionInfo.mediaIndex) { return; }

    this.CollectionPlay({mediaIndex: previousIndex, autoplay});
  }

  // Content

  /**
   * Retrieve whether or not the current content is a live video
   *
   * @methodGroup Content Info
   *
   * @returns {boolean} - Whether or not the current content is a live video
   */
  IsLive() {
    return this.player.isLive;
  }

  /**
   * Retrieve information about the current content, including title, description, icon and poster images, and header texts
   *
   * @methodGroup Content Info
   *
   * @returns {Object} - Information about the current content
   */
  GetContentInfo() {
    if(this.player.playerOptions.title !== false) {
      const collectionInfo = this.GetCollectionInfo();
      if(collectionInfo && collectionInfo.active) {
        return {
          title: collectionInfo.active.title || "",
          subtitle: collectionInfo.active.title || "",
          description: collectionInfo.active.description || "",
          image: (collectionInfo.active.image && collectionInfo.active.image.url) || "",
          posterImage: (collectionInfo.active.poster_image && collectionInfo.active.poster_image.url) || "",
          headers: collectionInfo.active.headers || []
        };
      } else if(this.player.sourceOptions.contentInfo) {
        return {
          title: this.player.sourceOptions.contentInfo.title,
          subtitle: this.player.sourceOptions.contentInfo.subtitle,
          description: this.player.sourceOptions.contentInfo.description,
          image: this.player.sourceOptions.contentInfo.image,
          posterImage: this.player.sourceOptions.contentInfo.posterImage,
          headers: this.player.sourceOptions.contentInfo.headers || []
        };
      }
    }
  }

  // Menu items

  /**
   * Retrieve the currently available video quality levels
   *
   * @methodGroup Quality
   *
   * @returns {Object} - All options, as well as the active option.
   */
  GetQualityLevels() {
    let levels = [];
    if(this.player.hlsPlayer) {
      levels = this.player.hlsPlayer.levels
        .map((level, index) => ({
          index,
          active: this.player.hlsPlayer.currentLevel === index && !this.player.hlsPlayer.autoLevelEnabled,
          resolution: level.attrs.RESOLUTION,
          bitrate: level.bitrate,
          audioTrack: !level.videoCodec,
          label:
            level.audioTrack ?
              `${level.bitrate / 1000}kbps` :
              `${level.attrs.RESOLUTION} (${(level.bitrate / 1000 / 1000).toFixed(1)}Mbps)`,
          activeLabel:
            level.audioTrack ?
              `${level.bitrate / 1000}kbps` :
              `${level.attrs.RESOLUTION}`
        }))
        .sort((a, b) => a.bitrate < b.bitrate ? 1 : -1);

      if(levels.length > 0) {
        const activeLevel = levels.find(level => this.player.hlsPlayer.currentLevel === level.index);
        levels.unshift({
          index: -1,
          label: "Auto",
          activeLabel: activeLevel ? `Auto (${activeLevel.activeLabel})` : "Auto",
          active: this.player.hlsPlayer.autoLevelEnabled
        });
      }
    } else if(this.player.dashPlayer) {
      levels = this.player.dashPlayer.getBitrateInfoListFor("video")
        .map((level) => ({
          index: level.qualityIndex,
          active: level.qualityIndex === this.player.dashPlayer.getQualityFor("video"),
          resolution: `${level.width}x${level.height}`,
          bitrate: level.bitrate,
          label: `${level.width}x${level.height} (${(level.bitrate / 1000 / 1000).toFixed(1)}Mbps)`,
          activeLabel: `${level.width}x${level.height}`,
        }))
        .sort((a, b) => a.bitrate < b.bitrate ? 1 : -1);
    }

    return {
      options: levels,
      active: levels.find(level => level.active)
    };
  }

  /**
   * Set the video quality to the specified level
   *
   * @methodGroup Quality
   *
   * @param levelIndex - The index of the quality level to set
   */
  SetQualityLevel(levelIndex) {
    if(this.player.hlsPlayer) {
      this.player.hlsPlayer.nextLevel = levelIndex;
      this.player.hlsPlayer.streamController.immediateLevelSwitch();
    } else if(this.player.dashPlayer) {
      this.player.dashPlayer.setQualityFor("video", levelIndex);
      this.player.dashPlayer.updateSettings({
        streaming: {
          trackSwitchMode: "alwaysReplace",
          buffer: {
            fastSwitchEnabled: true,
            flushBufferAtTrackSwitch: true
          },
          abr: {
            autoSwitchBitrate: {
              video: levelIndex === -1
            }
          }
        }
      });
    }

    this.player.__SettingsUpdate();
  }

  /**
   * Retrieve the currently available audio tracks
   *
   * @methodGroup Audio Tracks
   *
   * @returns {Object} - All options, as well as the active option.
   */
  GetAudioTracks() {
    let tracks = [];
    if(this.player.nativeHLS) {
      tracks = Array.from(this.player.video.audioTracks).map(track => ({
        index: track.id,
        label: track.label || track.language,
        active: track.enabled
      }));
    } else if(this.player.hlsPlayer) {
      tracks = this.player.hlsPlayer.audioTracks.map(track => ({
        index: track.id,
        label: track.name,
        active: track.id === this.player.hlsPlayer.audioTrack
      }));
    } else if(this.player.dashPlayer) {
      tracks = this.player.dashPlayer.getTracksFor("audio").map(track => ({
        index: track.index,
        label: track.labels && track.labels.length > 0 ? track.labels[0].text : track.lang,
        active: track.index === this.player.dashPlayer.getCurrentTrackFor("audio").index
      }));
    }

    return {
      options: tracks,
      active: tracks.find(track => track.active)
    };
  }

  /**
   * Set the audio track to the specified level
   *
   * @methodGroup Audio Tracks
   *
   * @param index - The index of the audio track to set
   */
  SetAudioTrack(index) {
    if(this.player.nativeHLS) {
      Array.from(this.player.video.audioTracks).forEach(track =>
        track.enabled = index.toString() === track.id
      );
    } else if(this.player.hlsPlayer) {
      this.player.hlsPlayer.audioTrack = index;
      this.player.hlsPlayer.streamController.immediateLevelSwitch();
    } else if(this.player.dashPlayer) {
      const track = this.player.dashPlayer.getTracksFor("audio").find(track => track.index === index);
      this.player.dashPlayer.setCurrentTrack(track);
    }
  }

  /**
   * Retrieve the currently available text/subtitle tracks
   *
   * @methodGroup Text Tracks
   *
   * @returns {Object} - All options, as well as the active option.
   */
  GetTextTracks() {
    let tracks = [];
    let activeTrackIndex;
    if(this.player.nativeHLS || this.player.hlsPlayer) {
      activeTrackIndex = Array.from(this.player.video.textTracks).findIndex(track => track.mode === "showing");

      tracks = Array.from(this.player.video.textTracks).map((track, index) => ({
        index,
        label: track.label || track.language,
        language: track.language,
        active: track.mode === "showing"
      }));
    } else if(this.player.dashPlayer) {
      activeTrackIndex = this.player.dashPlayer.getCurrentTextTrackIndex();
      tracks = this.player.dashPlayer.getTracksFor("text").map((track, index) => ({
        index,
        label: track.labels && track.labels.length > 0 ? track.labels[0].text : track.lang,
        language: track.lang,
        active: index === activeTrackIndex
      }));
    }

    if(tracks.length > 0) {
      tracks.unshift({
        index: -1,
        label: "Disabled",
        active: activeTrackIndex < 0
      });
    }

    return {
      options: tracks,
      active: tracks.find(track => track.active)
    };
  }

  /**
   * Set the text track to the specified track
   *
   * @methodGroup Text Tracks
   *
   * @param index - The index of the text track to set
   */
  SetTextTrack(index) {
    index = parseInt(index);

    if(this.player.nativeHLS || this.player.hlsPlayer) {
      const tracks = Array.from(this.player.video.textTracks);
      tracks.map(track => track.mode = "disabled");

      if(index >= 0) {
        tracks[index].mode = "showing";
      }
    } else if(this.player.dashPlayer) {
      this.player.dashPlayer.setTextTrack(parseInt(index));
    }

    if(index >= 0) {
      this.__lastTextTrackIndex = index;
    }
  }

  /**
   * Toggle the last used or most appropriate text track on or off.
   *
   * The text track will be selected based on the following:
   * - The most recently enabled track
   * - The first track matching the user's specified language as specified in `navigator.languages` in priority order (e.g. if the navigator.languages specifies `["pt-br", "en"]`, a pt-br track will be selected if present, otherwise an en track will be selected)
   * - If no appropriate language tracks are found, the first available text track
   *
   * @methodGroup Text Tracks
   *
   * @returns {boolean} - Whether the text track was enabled or disabled
   */
  ToggleTextTrack() {
    const {active, options} = this.GetTextTracks();

    if(options.length === 0) { return; }

    if(active && active.index >= 0) {
      this.SetTextTrack(-1);
      return false;
    } else if(this.__lastTextTrackIndex >= 0) {
      this.SetTextTrack(this.__lastTextTrackIndex);
      return true;
    } else {
      // Try to find a text track that matches one of the user's languages
      for(const languageCode of navigator.languages) {
        const matchingTrack = options.find(option => option.language === languageCode || option.language === languageCode.split("-")[0]);

        if(matchingTrack) {
          this.SetTextTrack(matchingTrack.index);
          return true;
        }
      }

      // No matching tracks found, just enable first in list
      this.SetTextTrack(0);
      return true;
    }
  }

  /**
   * Retrieve the currently available playback rates
   *
   * @methodGroup Playback Rate
   *
   * @returns {Object} - All options, as well as the active option.
   */
  GetPlaybackRates() {
    const options = ["0.25", "0.5", "0.75", "1", "1.25", "1.5", "1.75", "2"]
      .map((speed, index) => ({
        index,
        rate: parseFloat(speed),
        label: `${speed}x`,
        active: this.player.video.playbackRate.toFixed(2) === parseFloat(speed).toFixed(2)
      }));

    let active = options.find(option => option.active);

    if(!active) {
      active = {
        index: -1,
        rate: this.player.video.playbackRate,
        label: `${this.player.video.playbackRate}x`,
        active: true
      };
    }

    return {
      options,
      active
    };
  }

  /**
   * Set the player's playback rate
   *
   * @methodGroup Playback Rate
   * @namedParams
   * @param {number=} index - The index of the rate in the options list of `player.controls.GetPlaybackRates()`
   * @param {number=} rate - The playback rate to set. Does not need to match any options in `player.controls.GetPlaybackRates()`
   *
   * @returns {Object} - The rate that was set, as well as whether the rate was increased or decreased
   */
  SetPlaybackRate({index, rate}) {
    const originalSpeed = this.player.video.playbackRate;

    if(rate) {
      this.player.video.playbackRate = rate;

      this.player.__SettingsUpdate();

      return { rate, increase: originalSpeed <= rate };
    } else {
      const option = this.GetPlaybackRates().options[index];

      if(option) {
        this.player.video.playbackRate = option.rate;

        this.player.__SettingsUpdate();

        return { rate: option.rate, increase: originalSpeed <= option.rate };
      }
    }
  }

  /**
   * Retrieve the currently available player profiles
   *
   * @methodGroup Player Profile
   *
   * @returns {Object} - All options, as well as the active option.
   */
  GetPlayerProfiles() {
    let options = [];
    if(this.player.hlsPlayer) {
      options = Object.keys(PlayerProfiles)
        .map(key => ({
          index: key,
          label: PlayerProfiles[key].label,
          active: this.player.playerOptions.playerProfile === key,
        }));
    }

    return {
      options,
      active: options.find(option => option.active)
    };
  }

  /**
   * Set the player profile
   *
   * @methodGroup Player Profile
   * @namedParams
   * @param {string} profile - The name of the profile to set
   * @param {Object=} customOptions - If using a custom profile, custom player options to set
   */
  SetPlayerProfile({profile, customOptions={}}) {
    this.player.SetPlayerProfile({profile, customHLSOptions: customOptions});
  }

  /**
   * Show the custom player profile form
   *
   * @methodGroup Player Profile
   */
  ShowPlayerProfileForm() {
    this.player.__showPlayerProfileForm = true;
    this.player.__SettingsUpdate();
  }

  /**
   * Hide the custom player profile form
   *
   * @methodGroup Player Profile
   */
  HidePlayerProfileForm() {
    this.player.__showPlayerProfileForm = false;
    this.player.__SettingsUpdate();
  }

  /**
   * Retrieve content verification status
   *
   * @methodGroup Content Verification
   *
   * @returns {boolean} - Whether or not the content is verified
   */
  ContentVerified() {
    return this.player.contentVerified || false;
  }


  /**
   * Retrieve content verification audit details
   *
   * @methodGroup Content Verification
   *
   * @returns {Object} - Details about the content audit
   */
  GetContentVerificationDetails() {
    return this.player.contentAudit || false;
  }


  GetOptions() {
    let options = {
      quality: this.GetQualityLevels(),
      audio: this.GetAudioTracks(),
      text: this.GetTextTracks(),
      profile: this.GetPlayerProfiles(),
      rate: this.GetPlaybackRates()
    };

    options.hasQualityOptions = options.quality.options.length > 0;
    options.hasAudioOptions = options.audio.options.length > 0;
    options.hasTextOptions = options.text.options.length > 0;
    options.hasProfileOptons = options.profile.options.length > 0;
    options.hasRateOptions = !this.IsLive();

    options.hasAnyOptions =
      options.hasQualityOptions ||
      options.hasAudioOptions ||
      options.hasTextOptions ||
      options.hasProfileOptons ||
      options.hasRateOptions;

    return options;
  }

  AllowRotation() {
    return this.allowRotation;
  }

  SetAllowRotation(allowRotation) {
    this.allowRotation = allowRotation;

    this.player.__SettingsUpdate();
  }

  IsRotatable() {
    return (
      this.IsFullscreen() &&
      window.innerWidth < 900 &&
      window.innerHeight > window.innerWidth &&
      this.player.video.videoWidth > this.player.video.videoHeight
    );
  }

  /**
   * Register a listener for a <a href="https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video#events" target="_blank">standard HTML video event on the player's video element.
   *
   * Equivalent to `video.addEventListener(event, callback)`, but returns a disposal function that can be used to remove the listener
   *
   * @methodGroup Events
   * @param event - HTML video event name
   * @param callback - Event callback
   *
   * @returns {function} - A disposal function that, when called, will remove the listener
   */
  RegisterVideoEventListener(event, callback) {
    return this.player.__RegisterVideoEventListener(event, callback);
  }

  /**
   * Register a listener to be called when player state changes. State includes controls visibility, play/pause state, manual quality/audio/subtitle/playback speed changes, track changes
   *
   * @methodGroup Events
   * @param callback - Settings update callback
   *
   * @returns {function} - A disposal function that, when called, will remove the listener
   */
  RegisterSettingsListener(callback) {
    return this.player.__RegisterSettingsListener(callback);
  }

  /**
   * Fully reset the player to its initial state
   *
   * @methodGroup Constructor
   */
  Reset() {
    this.player.Reset();
  }

  /**
   * Stop playback and fully remove the player.
   *
   * @methodGroup Constructor
   */
  Destroy() {
    this.player.Destroy();
  }
}

export default PlayerControls;
