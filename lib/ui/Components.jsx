import CommonStyles from "../static/stylesheets/common.module.scss";

// eslint-disable-next-line no-unused-vars
import React, {createRef, useEffect, useRef, useState} from "react";
import {ACTIONS, SeekSliderKeyDown, VolumeSliderKeydown} from "./Common.js";
import {ObserveVideoBuffer, ObserveVideoTime, RegisterModal} from "./Observers.js";
import * as Icons from "../static/icons/Icons.js";
import { IconButton } from "./WebControls";
import MarkerIcon from "../static/icons/svgs/marker.svg";

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

export const SeekBar = ({ player, videoState, setRecentUserAction, className = "", clickOnMarkIn, clickOnMarkOut }) => {
  const [currentTime, setCurrentTime] = useState(player.video.currentTime);
  const [bufferFraction, setBufferFraction] = useState(0);
  const [seekKeydownHandler, setSeekKeydownHandler] = useState(undefined);
  
  const containerRef = useRef(null);
  const [showMarkInOut, setShowMarkInOut] = useState(false);
  const [markerInPosition, setMarkerInPosition] = useState(0);
  const [markerOutPosition, setMarkerOutPosition] = useState(100);
  const [showMarkIn, setShowMarkIn] = useState(false);
  const [showMarkOut, setShowMarkOut] = useState(false);
  const [markInTime, setMarkInTime] = useState(0);
  const [markOutTime, setMarkOutTime] = useState(0);
  const [dragging, setDragging] = useState(null); 

  useEffect(() => {
    if (videoState.duration) {
      setMarkOutTime(videoState.duration);
    }
  }, [videoState]);

  useEffect(() => {
    setSeekKeydownHandler(SeekSliderKeyDown(player, setRecentUserAction));

    const disposeVideoTimeObserver = ObserveVideoTime({video: player.video, setCurrentTime, rate: 60});
    const disposeVideoBufferObserver = ObserveVideoBuffer({video: player.video, setBufferFraction});

    return () => {
      disposeVideoTimeObserver && disposeVideoTimeObserver();
      disposeVideoBufferObserver && disposeVideoBufferObserver();
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragging && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const mouseX = e.clientX - containerRect.left;
        let newPosition = (mouseX / containerWidth) * 100;

        if (dragging === "in") {
          newPosition = Math.min(newPosition, markerOutPosition-.7);
          newPosition = Math.max(newPosition, 0);
          setMarkerInPosition(newPosition);
        } else if (dragging === "out") {
          newPosition = Math.max(newPosition, markerInPosition+.7);
          newPosition = Math.min(newPosition, 100);
          setMarkerOutPosition(newPosition);
        }
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  useEffect(() => { 
    if (player.playerOptions.markInOutCallback) {
      setMarkInTime(currentTime);
      player.playerOptions.markInOutCallback({
        in: currentTime,
        out: markOutTime
      });
    }
  }, [markerInPosition]);

  useEffect(() => { 
    if (player.playerOptions.markInOutCallback) {
      setMarkOutTime(currentTime);
      player.playerOptions.markInOutCallback({
        in: markInTime,
        out: currentTime
      });
    }
  }, [markerOutPosition]);

  useEffect(() => { 
    if (dragging === "in") {
      player.controls.Seek({ fraction: markerInPosition/100 });
    }
  }, [dragging, markerInPosition]);

  useEffect(() => { 
    if (dragging === "out") {
      player.controls.Seek({ fraction: markerOutPosition/100 });
    }
  }, [dragging, markerOutPosition]);

  useEffect(() => { 
    if (clickOnMarkIn || clickOnMarkOut) {
      setShowMarkInOut(true);
    }
  }, [clickOnMarkIn, clickOnMarkOut]);

  useEffect(() => { 
    if (clickOnMarkIn) {
      const newPosition = ((currentTime / videoState.duration) * 100) || 0;
      setShowMarkIn(true);
      setMarkerInPosition(newPosition);
      setMarkerOutPosition(100);
      if (!clickOnMarkOut) { 
        setShowMarkOut(true);
      }
    }
  }, [clickOnMarkIn]);

  useEffect(() => { 
    if (clickOnMarkOut) {
      let newPosition = ((currentTime / videoState.duration) * 100) || 0;
      newPosition = Math.max(newPosition, markerInPosition+.7);
      setShowMarkOut(true);
      setMarkerOutPosition(newPosition);
    } else { 
      setShowMarkOut(false);
    }
  }, [clickOnMarkOut]);

  if(player.isLive && !player.dvrEnabled) {
    return null;
  }

  return (
    <>
      {player.playerOptions.markInOut && showMarkInOut &&
        <div className={CommonStyles["mark-container"]} ref={containerRef}>
          <div
            className={CommonStyles["marker-in"]}
            onMouseDown={() => setDragging("in")}
            style={{ left: `${markerInPosition}%` }}>
            <div className={CommonStyles["marker"]}>
              <img src={MarkerIcon} alt="Mark in" />
            </div>
          </div>
          {showMarkOut &&
            <div
              className={CommonStyles["bar"]}
              style={{
                left: `${markerInPosition}%`,
                width: `${markerOutPosition - markerInPosition}%`
              }}
            >
            </div>
          }
          {showMarkOut &&
            <div
              className={CommonStyles["marker-out"]}
              onMouseDown={() => setDragging("out")}
              style={{ left: `${markerOutPosition}%` }}>
              <div className={CommonStyles["marker"]}>
                <img src={MarkerIcon} alt="Mark out" />
              </div>
            </div>
          }
        </div>
      }
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
    </>
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
      RemoveMenuListener && RemoveMenuListener();
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
      <div key="submenu" role="menu" className={`${CommonStyles["menu"]} ${CommonStyles["submenu"]} ${className}`}>
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
      <div key="menu" role="menu" className={`${CommonStyles["menu"]} ${className}`}>
        {
          !options.hasQualityOptions ? null :
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
    <div ref={menuRef}>
      { content }
    </div>
  );
};

export const Copy = async (value) => {
  try {
    value = (value || "").toString();

    await navigator.clipboard.writeText(value);
  } catch(error) {
    const input = document.createElement("input");

    input.value = value;
    input.select();
    input.setSelectionRange(0, 99999);
    document.execCommand("copy");
  }
};

export const CopyButton = ({label, value, className=""}) => {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        if(copied) { return; }

        Copy(value);

        setCopied(true);
        setTimeout(() => setCopied(false), 100);
      }}
      dangerouslySetInnerHTML={{__html: Icons.CopyIcon}}
      className={[CommonStyles["copy-button"], copied ? CommonStyles["copy-button--copied"] : "", className].join(" ")}
      title={`Copy ${label}`}
    />
  );
};

const ContentDetail = ({label, value, copyable}) => {
  if(!value) { return null; }

  return (
    <div className={CommonStyles["verification-menu__detail"]}>
      <label className={CommonStyles["verification-menu__detail-label"]}>{label}:</label>
      <div className={CommonStyles["verification-menu__detail-value"]}>{value}</div>
      {
        !copyable ? null :
          <CopyButton
            label={label}
            value={value}
            className={CommonStyles["verification-menu__detail-copy"]}
          />
      }
    </div>
  );
};

export const ContentVerificationMenu = ({player, Hide, className=""}) => {
  const menuRef = createRef();
  const [audit, setAudit] = useState();
  const [showDetails, setShowDetails] = useState(false);
  const [_, setLoaded] = useState(false);

  useEffect(() => {
    player.__LoadVerificationDetails()
      .then(() => setLoaded(true));

    const UpdateSettings = () => setAudit(player.controls.GetContentVerificationDetails());

    UpdateSettings();

    const disposePlayerSettingsListener = player.controls.RegisterSettingsListener(UpdateSettings);

    return () => disposePlayerSettingsListener && disposePlayerSettingsListener();
  }, []);

  useEffect(() => {
    if(!menuRef || !menuRef.current) { return; }

    const RemoveMenuListener = RegisterModal({element: menuRef.current.parentElement, Hide});

    return () => {
      RemoveMenuListener && RemoveMenuListener();
    };
  }, [menuRef]);

  if(!audit) {
    return null;
  }

  let content;
  if(!showDetails) {
    content = (
      <>
        <div className={CommonStyles["verification-menu__group"]}>
          <div dangerouslySetInnerHTML={{__html: Icons.ContentBadgeIcon}} className={CommonStyles["verification-menu__group-icon"]} />
          <div className={CommonStyles["verification-menu__group-text"]}>
            <div className={CommonStyles["verification-menu__group-title"]}>
              This content has been verified as authentic
            </div>
            <div className={CommonStyles["verification-menu__group-subtitle"]}>
              Last Verified: { new Date(audit.verifiedAt).toLocaleTimeString(navigator.language || "en-us", {year: "numeric", "month": "long", day: "numeric"}) }
            </div>
          </div>
        </div>
        <div className={CommonStyles["verification-menu__group"]}>
          <div dangerouslySetInnerHTML={{__html: Icons.ContentCredentialsIcon}} className={[CommonStyles["verification-menu__group-icon"], CommonStyles["verification-menu__group-icon--cc"]].join(" ")} />
          <div className={CommonStyles["verification-menu__group-text"]}>
            <button onClick={() => setShowDetails(true)} className={CommonStyles["verification-menu__group-title"]}>
              View Content Credentials
              <div className={CommonStyles["verification-menu__inline-icon"]} dangerouslySetInnerHTML={{__html: Icons.ChevronRightIcon}} />
            </button>
          </div>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <div className={CommonStyles["verification-menu__group"]}>
          <div dangerouslySetInnerHTML={{__html: Icons.ContentBadgeIcon}} className={CommonStyles["verification-menu__group-icon"]} />
          <div className={CommonStyles["verification-menu__group-text"]}>
            <div className={CommonStyles["verification-menu__group-title"]}>
              This content has been verified as authentic
            </div>
            <div className={CommonStyles["verification-menu__group-subtitle"]}>
              Last Verified: { new Date(audit.verifiedAt).toLocaleTimeString(navigator.language || "en-us", {year: "numeric", "month": "long", day: "numeric"}) }
            </div>
          </div>
        </div>
        <div className={CommonStyles["verification-menu__group"]}>
          <div dangerouslySetInnerHTML={{__html: Icons.ContentCredentialsIcon}} className={[CommonStyles["verification-menu__group-icon"], CommonStyles["verification-menu__group-icon--cc"]].join(" ")} />
          <div className={CommonStyles["verification-menu__group-text"]}>
            <button onClick={() => setShowDetails(true)} className={CommonStyles["verification-menu__group-title"]}>
              Content Credentials
            </button>
            <div className={CommonStyles["verification-menu__group-subtitle"]}>
              Issued by the
              <a href="https://main.net955305.contentfabric.io/config" target="_blank" rel="noreferrer">
                Content Fabric
              </a>
            </div>
          </div>
        </div>
        <div className={CommonStyles["verification-menu__details"]} key={`details-${audit.details._state}`}>
          <ContentDetail label="Content Fabric Object ID" value={audit.details.objectId} copyable />
          <ContentDetail label="Organization Address" value={audit.details.tenantAddress} copyable />
          <ContentDetail label="Organization Name" value={audit.details.tenantName && audit.details.tenantName.toString()} />
          <ContentDetail label="Owner Address" value={audit.details.ownerAddress} copyable />
          <ContentDetail
            label="Content Object Contract Address"
            value={
            audit.details.explorerUrl ?
              <a href={audit.details.explorerUrl} target="_blank" rel="noreferrer">
                {audit.details.address}
              </a> :
              audit.details.address
            }
            copyable
          />
          <ContentDetail label="Versions" value={audit.details.versionCount} />
          <ContentDetail label="Content Version Hash" value={audit.details.versionHash} copyable />
          {
            !audit.details.lastCommittedAt ? null :
              <ContentDetail label="Latest Commit" value={new Date(audit.details.lastCommittedAt).toLocaleTimeString(navigator.language || "en-us", {year: "numeric", "month": "long", day: "numeric"})} />
          }
          <ContentDetail label="Latest Version Hash" value={audit.details.latestVersionHash} copyable />
          <ContentDetail
            label="Latest Transaction"
            value={
              audit.details._state !== "full" ?
                <Spinner className={CommonStyles["verification-menu__loader"]} /> :
                audit.details.latestTransactionHashUrl ?
                  <a href={audit.details.latestTransactionHashUrl} target="_blank" rel="noreferrer">
                    { audit.details.latestTransactionHash && audit.details.latestTransactionHash.toString() }
                  </a> : undefined
            }
          />
          <ContentDetail label="Signature Algorithm" value={audit.details.signatureMethod} />
          {
            !player.publicMetadataUrl ? null :
              <ContentDetail
                label="Public Metadata"
                value={
                  <a href={player.publicMetadataUrl} target="_blank" rel="noreferrer">
                    {player.publicMetadataUrl}
                  </a>
                }
              />
          }
        </div>
      </>
    );
  }

  return (
    <div ref={menuRef}>
      <div key="menu" role="menu" className={`${CommonStyles["menu"]} ${CommonStyles["verification-menu"]} ${showDetails ? CommonStyles["verification-menu--details"] : ""} ${className}`}>
        { content }
      </div>
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
