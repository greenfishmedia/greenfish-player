import CommonStyles from "../static/stylesheets/common.module.scss";

// eslint-disable-next-line no-unused-vars
import React, {createRef, useEffect, useState} from "react";
import {ACTIONS, SeekSliderKeyDown, VolumeSliderKeydown} from "./Common.js";
import {ObserveVideoBuffer, ObserveVideoTime, RegisterModal} from "./Observers.js";
import * as Icons from "../static/icons/Icons.js";
import {IconButton} from "./WebControls";

// Components

export const Spinner = ({light, className=""}) => (
  <div className={`${className} ${CommonStyles["spinner"]} ${light ? CommonStyles["spinner--light"] : ""}`}>
    <div className={CommonStyles["spinner-inner"]} />
  </div>
);

export const SVG = ({icon, className=""}) => <div className={`${CommonStyles["svg"]} ${className}`} dangerouslySetInnerHTML={{__html: icon}} />;


const icons = {
  [ACTIONS.PLAY]: Icons.PlayIcon,
  [ACTIONS.PAUSE]: Icons.PauseIcon,
  [ACTIONS.MUTE]: Icons.MutedIcon,
  [ACTIONS.UNMUTE]: Icons.VolumeHighIcon,
  [ACTIONS.VOLUME_DOWN]: Icons.VolumeLowIcon,
  [ACTIONS.VOLUME_UP]: Icons.VolumeHighIcon,
  [ACTIONS.SEEK_BACK]: Icons.BackwardIcon,
  [ACTIONS.SEEK_FORWARD]: Icons.ForwardIcon,
  [ACTIONS.PLAYBACK_RATE_DOWN]: Icons.BackwardIcon,
  [ACTIONS.PLAYBACK_RATE_UP]: Icons.ForwardIcon,
  [ACTIONS.SUBTITLES_ON]: Icons.CaptionsIcon,
  [ACTIONS.SUBTITLES_OFF]: Icons.CaptionsOffIcon,
  [ACTIONS.PLAY_PREVIOUS]: Icons.PreviousTrackIcon,
  [ACTIONS.PLAY_NEXT]: Icons.NextTrackIcon
};

// Show a short indication when an action occurs due to keyboard controls etc.
export const UserActionIndicator = ({action}) => {
  if(!action || !icons[action.action]) {
    return;
  }

  return (
    <div className={CommonStyles["user-action-indicator-container"]}>
      <div className={CommonStyles["user-action-indicator"]}>
        <SVG
          icon={icons[action.action]}
          aria-label={`Action indicator ${action}`}
          className={CommonStyles["user-action-indicator-icon"]}
        />
      </div>
      {
        !action.text ? null :
          <div className={CommonStyles["user-action-indicator-text"]}>
            { action.text }
          </div>
      }
    </div>
  );
};

export const SeekBar = ({player, videoState, setRecentUserAction, className=""}) => {
  const [currentTime, setCurrentTime] = useState(player.video.currentTime);
  const [bufferFraction, setBufferFraction] = useState(0);
  const [seekKeydownHandler, setSeekKeydownHandler] = useState(undefined);

  useEffect(() => {
    setSeekKeydownHandler(SeekSliderKeyDown(player, setRecentUserAction));

    const disposeVideoTimeObserver = ObserveVideoTime({video: player.video, setCurrentTime, rate: 60});
    const disposeVideoBufferObserver = ObserveVideoBuffer({video: player.video, setBufferFraction});

    return () => {
      disposeVideoTimeObserver && disposeVideoTimeObserver();
      disposeVideoBufferObserver && disposeVideoBufferObserver();
    };
  }, []);

  if(player.isLive) {
    return null;
  }

  return (
    <div className={`${className} ${CommonStyles["seek-container"]} ${className}`}>
      <progress
        max={1}
        value={bufferFraction}
        className={CommonStyles["seek-buffer"]}
      />
      <progress
        max={1}
        value={currentTime / videoState.duration || 0}
        className={CommonStyles["seek-playhead"]}
      />
      <input
        aria-label="Seek slider"
        type="range"
        min={0}
        max={1}
        step={0.00001}
        value={currentTime / videoState.duration || 0}
        onInput={event => player.controls.Seek({fraction: event.currentTarget.value})}
        onKeyDown={seekKeydownHandler}
        className={CommonStyles["seek-input"]}
      />
    </div>
  );
};

export const VolumeControls = ({player, videoState}) => {
  return (
    <div className={CommonStyles["volume-controls"]}>
      <IconButton
        key="mute-button"
        aria-label={videoState.muted ? "Unmute" : "Mute"}
        icon={
          videoState.muted || videoState.volume === 0 ? Icons.MutedIcon :
            videoState.volume < 0.4 ? Icons.VolumeLowIcon :
              videoState.volume < 0.8 ? Icons.VolumeMediumIcon :
                Icons.VolumeHighIcon
        }
        onClick={() => player.controls.ToggleMuted()}
        className={CommonStyles["volume-button"]}
      />
      <div className={CommonStyles["volume-slider"]}>
        <progress
          max={1}
          value={videoState.muted ? 0 : videoState.volume}
          className={CommonStyles["volume-progress"]}
        />
        <input
          aria-label="Volume slider"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={videoState.muted ? 0 : videoState.volume}
          onInput={event => player.controls.SetVolume({fraction: event.currentTarget.value})}
          onKeyDown={VolumeSliderKeydown(player)}
          className={CommonStyles["volume-input"]}
        />
      </div>
    </div>
  );
};

export const SettingsMenu = ({player, Hide, className=""}) => {
  const [activeMenu, setActiveMenu] = useState(undefined);
  const [options, setOptions] = useState(undefined);
  const menuRef = createRef();

  useEffect(() => {
    const UpdateSettings = () => setOptions(player.controls.GetOptions());

    UpdateSettings();

    const disposePlayerSettingsListener = player.controls.RegisterSettingsListener(UpdateSettings);

    return () => disposePlayerSettingsListener && disposePlayerSettingsListener();
  }, []);

  useEffect(() => {
    if(!menuRef || !menuRef.current) { return; }

    const RemoveMenuListener = RegisterModal({element: menuRef.current.parentElement, Hide});

    return () => {
      RemoveMenuListener && RemoveMenuListener()
    };
  }, [menuRef]);

  if(!options) { return null; }

  // Delay firing of submenu change until after click outside handler has been called
  const SetSubmenu = setting => setTimeout(() => setActiveMenu(setting));

  const settings = {
    quality: {
      label: "Quality",
      Update: index => player.controls.SetQualityLevel(index)
    },
    audio: {
      label: "Audio",
      Update: index => player.controls.SetAudioTrack(index)
    },
    text: {
      label: "Subtitles",
      Update: index => player.controls.SetTextTrack(index)
    },
    profile: {
      label: "Player Profile",
      Update: index => {
        if(index === "custom") {
          player.controls.ShowPlayerProfileForm();
          Hide();
        } else {
          player.controls.SetPlayerProfile({profile: index});
        }
      }
    },
    rate: {
      label: "Playback Rate",
      Update: index => player.controls.SetPlaybackRate({index})
    }
  };

  let content;
  if(activeMenu) {
    content = (
      <div key="submenu" role="menu" className={`${CommonStyles["menu"]} ${CommonStyles["submenu"]} ${CommonStyles["settings-menu"]} ${className}`}>
        <button
          onClick={() => SetSubmenu(undefined)}
          aria-label="Back to settings menu"
          className={`${CommonStyles["menu-option"]} ${CommonStyles["menu-option-back"]}`}
        >
          <div dangerouslySetInnerHTML={{__html: Icons.LeftArrowIcon}} className={CommonStyles["menu-option-back-icon"]} />
          <div>{ settings[activeMenu].label }</div>
        </button>
        {
          options[activeMenu].options.map(option =>
            <button
              key={`option-${option.index}`}
              role="menuitemradio"
              aria-checked={option.active}
              autoFocus={option.active}
              aria-label={`${settings[activeMenu].label}: ${option.label || ""}`}
              onClick={() => {
                settings[activeMenu].Update(option.index);
                SetSubmenu(undefined);
              }}
              className={`${CommonStyles["menu-option"]} ${option.active ? CommonStyles["menu-option-active"] : ""}`}
            >
              { option.label || "" }
              { option.active ? <SVG icon={Icons.CheckmarkIcon} className={CommonStyles["menu-option-icon"]} /> : null }
            </button>
          )
        }
      </div>
    );
  } else {
    content = (
      <div key="menu" role="menu" className={`${CommonStyles["menu"]} ${CommonStyles["settings-menu"]} ${className}`}>
        {
          !options.hasQualityOptions <= 1 ? null :
            <button autoFocus role="menuitem" onClick={() => SetSubmenu("quality")}
                    className={CommonStyles["menu-option"]}>
              {`${settings.quality.label}: ${(options.quality.active && options.quality.active.activeLabel) || ""}`}
              <SVG icon={Icons.ChevronRightIcon} className={CommonStyles["menu-option-icon"]}/>
            </button>
        }
        {
          !options.hasAudioOptions ? null :
            <button autoFocus={!options.hasQualityOptions} role="menuitem" onClick={() => SetSubmenu("audio")} className={CommonStyles["menu-option"]}>
              {`${settings.audio.label}: ${(options.audio.active && options.audio.active.label) || ""}`}
              <SVG icon={Icons.ChevronRightIcon} className={CommonStyles["menu-option-icon"]}/>
            </button>
        }
        {
          !options.hasTextOptions ? null :
            <button autoFocus={!options.hasQualityOptions && !options.hasAudioOptions} role="menuitem" onClick={() => SetSubmenu("text")} className={CommonStyles["menu-option"]}>
              {`${settings.text.label}: ${(options.text.active && options.text.active.label) || ""}`}
              <SVG icon={Icons.ChevronRightIcon} className={CommonStyles["menu-option-icon"]}/>
            </button>
        }
        {
          !options.hasProfileOptons ? null :
            <button autoFocus={!options.hasQualityOptions && !options.hasAudioOptions && !options.hasTextOptions} role="menuitem" onClick={() => SetSubmenu("profile")} className={CommonStyles["menu-option"]}>
              {`${settings.profile.label}: ${(options.profile.active && options.profile.active.label) || ""}`}
              <SVG icon={Icons.ChevronRightIcon} className={CommonStyles["menu-option-icon"]}/>
            </button>
        }
        {
          !options.hasRateOptions ? null :
            <button autoFocus={!options.hasQualityOptions && !options.hasAudioOptions && !options.hasTextOptions && !options.hasProfileOptons} role="menuitem" onClick={() => SetSubmenu("rate")} className={CommonStyles["menu-option"]}>
              {`${settings.rate.label}: ${(options.rate.active && options.rate.active.label) || ""}`}
              <SVG icon={Icons.ChevronRightIcon} className={CommonStyles["menu-option-icon"]}/>
            </button>
        }
      </div>
    );
  }

  return (
    <div ref={menuRef} className={`${CommonStyles["menu-container"]}`}>
      { content }
    </div>
  );
};

export const CollectionMenu = ({player, Hide, className=""}) => {
  const menuRef = createRef();
  const [collectionInfo, setCollectionInfo] = useState(undefined);

  useEffect(() => {
    const UpdateCollectionInfo = () => setCollectionInfo(player.controls.GetCollectionInfo());

    UpdateCollectionInfo();

    const disposePlayerSettingsListener = player.controls.RegisterSettingsListener(UpdateCollectionInfo);

    return () => disposePlayerSettingsListener && disposePlayerSettingsListener();
  }, []);

  useEffect(() => {
    if(!menuRef || !menuRef.current) { return; }

    const RemoveMenuListener = RegisterModal({element: menuRef.current.parentElement, Hide});

    return () => RemoveMenuListener && RemoveMenuListener();
  }, [menuRef]);

  if(!collectionInfo) { return null; }

  const Select = mediaIndex => {
    player.controls.CollectionPlay({mediaIndex});
    Hide();
  };

  return (
    <div key="menu" role="menu" className={`${CommonStyles["menu"]} ${CommonStyles["collection-menu"]} ${className}`} ref={menuRef}>
      <div className={`${CommonStyles["menu-option"]} ${CommonStyles["menu-header"]}`}>
        { collectionInfo.title }
      </div>
      {
        collectionInfo.content.map((item =>
            <button
              key={`collection-item-${item.mediaId}`}
              aria-label={`${item.title || item.mediaId} ${item.active ? "(active)" : ""}`}
              role="menuitemradio"
              aria-checked={item.active}
              autoFocus={item.active}
              onClick={() => Select(item.mediaIndex)}
              className={`${CommonStyles["menu-option"]} ${item.active ? CommonStyles["menu-option-active"] : ""}`}
            >
              { item.title || item.mediaId }
            </button>
        ))
      }
    </div>
  );
};
