import ControlStyles from "../static/stylesheets/controls-web.module.scss";

// eslint-disable-next-line no-unused-vars
import React, {useEffect, useState} from "react";
import * as Icons from "../static/icons/Icons.js";
import {ObserveVideo, ObserveVideoTime} from "./Observers.js";
import "focus-visible";
import {ImageUrl, PlayerClick, Time} from "./Common.js";
import EluvioPlayerParameters from "../player/PlayerParameters.js";

import GreenfishLogo from "../static/images/greenfish_logo.svg";
import MarkInIcon from "../static/icons/svgs/mark-in.svg";
import MarkOutIcon from "../static/icons/svgs/mark-out.svg";
import { CollectionMenu, SeekBar, SettingsMenu, VolumeControls } from "./Components.jsx";

export const IconButton = ({icon, className="", ...props}) => {
  return (
    <button {...props} className={`${ControlStyles["icon-button"]} ${className}`} dangerouslySetInnerHTML={{__html: icon}} />
  );
};

const TimeIndicator = ({player, videoState}) => {
  const [currentTime, setCurrentTime] = useState(player.video.currentTime);

  useEffect(() => {
    const disposeVideoTimeObserver = ObserveVideoTime({video: player.video, setCurrentTime, rate: 10});

    return () => disposeVideoTimeObserver && disposeVideoTimeObserver();
  }, []);

  if(player.isLive && !player.dvrEnabled) {
    return (
      <div className={ControlStyles["live-indicator"]}>
        Live
      </div>
    );
  }

  return (
    <div className={ControlStyles["time"]}>
      {
        !player.isLive ? null :
          <button onClick={() => player.controls.Seek({time: player.controls.GetDuration() - 2})} className={ControlStyles["live-indicator"]}>
            Live
          </button>
      }
      { Time(currentTime, videoState.duration) } / { Time(videoState.duration, videoState.duration) }
    </div>
  );
};

const CollectionControls = ({player}) => {
  const collectionInfo = player.controls.GetCollectionInfo();

  if(!collectionInfo || collectionInfo.mediaLength === 0 || !collectionInfo.isPlaylist) { return null; }

  const previousMedia = collectionInfo.content[collectionInfo.mediaIndex - 1];
  const nextMedia = collectionInfo.content[collectionInfo.mediaIndex + 1];

  const playerReady = player.controls.IsReady();
  return (
      <>
        {
          !previousMedia ? null :
            <div
              key={`media-previous-${collectionInfo.mediaIndex}`}
              className={`${ControlStyles["collection-button-container"]} ${!playerReady ? ControlStyles["collection-button-container--loading"] : ""}`}
            >
              <IconButton aria-label={`Play Previous: ${previousMedia.title}`} disabled={!playerReady} icon={Icons.PreviousTrackIcon} onClick={() => player.controls.CollectionPlayPrevious()} />
              <div className={ControlStyles["collection-button-text"]}>{ previousMedia.title }</div>
            </div>
        }
        {
          !nextMedia ? null :
            <div
              key={`media-next-${collectionInfo.mediaIndex}`}
              className={`${ControlStyles["collection-button-container"]} ${!playerReady ? ControlStyles["collection-button-container--loading"] : ""}`}
            >
              <IconButton aria-label={`Play Next: ${nextMedia.title}`} disabled={!playerReady} icon={Icons.NextTrackIcon} onClick={() => player.controls.CollectionPlayNext()} />
              <div className={ControlStyles["collection-button-text"]}>{ nextMedia.title }</div>
            </div>
        }
      </>
  );
};

const MenuButton = ({label, icon, player, MenuComponent, className=""}) => {
  const [show, setShow] = useState(false);

  return (
    <div className={[ControlStyles["menu-control-container"], className].join(" ")}>
      <IconButton
        aria-label={show ? `Hide ${label} Menu` : label}
        aria-haspopup
        icon={icon}
        onClick={() => {
          player.controls.__ToggleMenu(!show);
          setShow(!show);
        }}
        className={show ? ControlStyles["icon-button-active"] : ""}
      />
      {
        !show ? null :
          <MenuComponent
            player={player}
            Hide={() => {
              setShow(false);
              player.controls.__ToggleMenu(false);
            }}
          />
      }
    </div>
  );
};

const ContentInfo = ({player, contentInfo}) => {
  const [imageUrl, setImageUrl] = useState(undefined);
  const {image} = (player.controls.GetContentInfo() || {});
  const [title, setTitle] = useState(undefined);
  const [subtitle, setSubtitle] = useState(undefined);
  const [rating, setRating] = useState(undefined);

  async function loadRatingSvg(rating) { 
    const svgPath = await import(`../static/images/rating/${rating.toLowerCase()}.svg`);
    return svgPath.default;
  }

  function fetchData() { 
    async function _fetchData() {
      const { title, subtitle, rating } = player.playerOptions.previewMode ? (contentInfo || {}) : (player.controls.GetContentInfo() || {});
      setTitle(title);
      setSubtitle(subtitle);
    
      if (rating) {
        const svg = await loadRatingSvg(rating);
        setRating(svg);
      } else { 
        setRating(undefined);
      }
    }
    _fetchData();
  }

  useEffect(() => {
    const source = player.playerOptions.previewMode ? (contentInfo || {}) : (player.controls.GetContentInfo() || {});
    fetchData(source);
  }, []);
  
  
  useEffect(() => {
    if (player.playerOptions.previewMode) {
      const source = contentInfo || {};
      fetchData(source);
    }
  }, [contentInfo]);

  useEffect(() => {
    setImageUrl(undefined);

    if(!image) { return; }

    ImageUrl({player, pathOrUrl: image, width: 200})
      .then(imageUrl => setImageUrl(imageUrl));
  }, [image]);

  if(
    (player.playerOptions.title === EluvioPlayerParameters.title.FULLSCREEN_ONLY && !player.controls.IsFullscreen()) ||
    player.playerOptions.title === EluvioPlayerParameters.title.OFF
  ) {
    return null;
  }

  return (
    <>
      {rating && 
        <div className={ControlStyles["info-container-top"]}>
          <div>Rated</div>
          <img src={rating} alt="Rating" />
        </div>
      }

      <div className={ControlStyles["info-container"]}>
        <div className={ControlStyles["info-text"]}>
          { !subtitle ? null : <div className={ControlStyles["info-subtitle"]}>{subtitle}</div> }
          {!title ? null : <div className={ControlStyles["info-title"]}>{title}</div>}
        </div>
      </div>
    </>
  );
};

const ContentVerificationControls = ({player}) => {
  const [contentVerified, setContentVerified] = useState(false);

  useEffect(() => {
    const UpdateVerification = () => setContentVerified(player.controls.ContentVerified());

    UpdateVerification();

    const disposeSettingsListener = player.controls.RegisterSettingsListener(UpdateVerification);

    return () => disposeSettingsListener && disposeSettingsListener();
  }, []);

  if(!contentVerified) {
    return null;
  }

  return (
    <>
      {/* <div className={ControlStyles["content-verified-badge"]}>
        VERIFIED
      </div>
      <MenuButton
        label="Content Verification Menu"
        icon={Icons.ContentBadgeIcon}
        player={player}
        MenuComponent={ContentVerificationMenu}
        className={ControlStyles["content-verification-menu-button"]}
      /> */}
    </>
  );
};

const WebControls = ({player, playbackStarted, canPlay, recentlyInteracted, setRecentUserAction, className="", contentInfo}) => {
  const [videoState, setVideoState] = useState(undefined);
  const [playerClickHandler, setPlayerClickHandler] = useState(undefined);
  const [menuVisible, setMenuVisible] = useState(player.controls.IsMenuVisible());
  const [companyLogo, setCompanyLogo] = useState(undefined);
  const [showMarkIn, setShowMarkIn] = useState(undefined);
  const [showMarkOut, setShowMarkOut] = useState(undefined);
  
  useEffect(() => {
    const {companyLogo} = player.playerOptions.previewMode ? (contentInfo || {}) : (player.controls.GetContentInfo() || {});
    setCompanyLogo(companyLogo);
  }, []);
  
  
  useEffect(() => {
    if (player.playerOptions.previewMode) {
      const {companyLogo} = contentInfo || {};
      setCompanyLogo(companyLogo);
    }
  }, [contentInfo]);

  useEffect(() => {
    setPlayerClickHandler(PlayerClick({player, setRecentUserAction}));

    const UpdateMenuVisibility = () => setMenuVisible(player.controls.IsMenuVisible());
    const disposeSettingsListener = player.controls.RegisterSettingsListener(UpdateMenuVisibility);
    const disposeVideoObserver = ObserveVideo({target: player.target, video: player.video, setVideoState});

    return () => {
      disposeSettingsListener && disposeSettingsListener();
      disposeVideoObserver && disposeVideoObserver();
    };
  }, []);

  if(!videoState) { return null; }

  const collectionInfo = player.controls.GetCollectionInfo();

  // Title autohide is not dependent on controls settings
  const showUI = recentlyInteracted || !playbackStarted || menuVisible;
  const hideControls = !showUI && player.playerOptions.controls === EluvioPlayerParameters.controls.AUTO_HIDE;

  player.__SetControlsVisibility(!hideControls);

  return (
    <div
      onClick={playerClickHandler}
      className={[
        className,
        ControlStyles["container"],
        showUI || player.playerOptions.previewMode || !player.controls.IsPlaying() ? "" : ControlStyles["autohide"],
        player.playerOptions.controls !== EluvioPlayerParameters.controls.DEFAULT ? "" : ControlStyles["container--default-controls"],
        player.controls.IsMenuVisible() ? "menu-active" : ""
      ].join(" ")}
    >
      <ContentInfo key={`content-info-${collectionInfo && collectionInfo.mediaIndex}`} player={player} contentInfo={contentInfo} />
      {
        // Main bottom control bar
        [
          EluvioPlayerParameters.controls.DEFAULT,
          EluvioPlayerParameters.controls.OFF,
          EluvioPlayerParameters.controls.OFF_WITH_VOLUME_TOGGLE
        ].includes(player.playerOptions.controls) ? null :
          <>
            <IconButton
              aria-label="Play"
              tabIndex={playbackStarted ? -1 : 0}
              icon={Icons.CenterPlayCircleIcon}
              onClick={() => {
                player.controls.Play();
                // Take focus off of this button because it should no longer be selectable after playback starts
                player.target.firstChild.focus();
              }}
              className={`${ControlStyles["center-play-button"]} ${canPlay && !playbackStarted ? "" : ControlStyles["center-play-button--hidden"]}`}
            />
            <div className={`${ControlStyles["bottom-controls-container"]} ${hideControls ? ControlStyles["bottom-controls-container--autohide"] : ""}`}>
              <div className={ControlStyles["bottom-controls-gradient"]} />
              <SeekBar
                player={player}
                videoState={videoState}
                setRecentUserAction={setRecentUserAction}
                className={ControlStyles["seek"]}
                clickOnMarkIn={showMarkIn}
                clickOnMarkOut={showMarkOut}
              />
              <div className={ControlStyles["controls"]}>
                <IconButton
                  aria-label={videoState.playing ? "Pause" : "Play"}
                  icon={videoState.playing ? Icons.PauseCircleIcon : Icons.PlayCircleIcon}
                  onClick={() => {
                    player.controls.TogglePlay();
                    // setShowRating(true);
                    // setTimeout(() => { 
                    //   setShowRating(false);
                    // }, 5000);
                  }}
                  className={ControlStyles["play-pause-button"]}
                />
                <CollectionControls player={player} />
                <VolumeControls player={player} videoState={videoState} />
                <TimeIndicator player={player} videoState={videoState}/>
                {player.playerOptions.markInOut &&
                  <div className={ControlStyles["mark-function"]}>
                    <div className={ControlStyles["mark-in"]} onClick={() => { 
                      setShowMarkIn(new Date());
                      setShowMarkOut(undefined);
                    }}><img src={MarkInIcon} alt="Mark in" /></div>
                    <div className={ControlStyles["mark-out"]} onClick={() => { 
                      if (showMarkIn) {
                        setShowMarkOut(new Date());
                      }
                    }}><img src={MarkOutIcon} alt="Mark out" /></div>
                  </div>
                }
                <div className={ControlStyles["spacer"]}/>

                <ContentVerificationControls player={player} />

                {
                  !collectionInfo ? null :
                    <MenuButton
                      label="Collection Menu"
                      icon={Icons.CollectionIcon}
                      player={player}
                      MenuComponent={CollectionMenu}
                    />
                }
                {
                  !player.controls.IsRotatable() ? null :
                    <IconButton
                      aria-label="Rotate Video"
                      icon={Icons.RotateIcon}
                      onClick={() => player.controls.SetAllowRotation(!player.controls.AllowRotation())}
                      className={ControlStyles["right-control-button"]}
                    />
                }
                <IconButton
                  aria-label="Captions"
                  icon={videoState.captions ? Icons.CaptionsIcon : Icons.CaptionsOffIcon}
                  className={ControlStyles["icon-buttons"]}
                />
                {
                  !player.controls.GetOptions().hasAnyOptions ? null :
                    <MenuButton
                      label="Settings Menu"
                      icon={Icons.SettingsIcon}
                      player={player}
                      MenuComponent={SettingsMenu}
                      className={ControlStyles["icon-buttons"]}
                    />
                }
                <IconButton
                  aria-label="Miniplayer"
                  icon={Icons.MiniplayerIcon}
                  className={ControlStyles["icon-buttons"]}
                />
                <IconButton
                  aria-label="Cinema Mode"
                  icon={Icons.CinemaModeIcon}
                  className={ControlStyles["icon-buttons"]}
                />
                <IconButton
                  aria-label="Play On TV"
                  icon={Icons.PlayOnTVIcon}
                  className={ControlStyles["icon-buttons"]}
                />
                <IconButton
                  aria-label={videoState.fullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  icon={videoState.fullscreen ? Icons.ExitFullscreenIcon : Icons.FullscreenIcon}
                  onClick={() => player.controls.ToggleFullscreen()}
                  className={ControlStyles["icon-buttons"]}
                />
                <div className={ControlStyles["greenfish-logo"]}>
                  <img src={GreenfishLogo} alt="Greenfish logo" />
                </div>
              </div>
            </div>
          </>
      }
      {
        // Floating volume control for 'off with volume toggle' setting
        player.playerOptions.controls !== EluvioPlayerParameters.controls.OFF_WITH_VOLUME_TOGGLE ? null :
          <div className={ControlStyles["floating-volume-toggle"]}>
            <IconButton
              key="mute-button"
              aria-label={videoState.muted ? "Unmute" : "Mute"}
              icon={videoState.muted || videoState.volume === 0 ? Icons.MutedIcon : Icons.VolumeHighIcon}
              onClick={() => player.controls.ToggleMuted()}
              className={ControlStyles["volume-button"]}
            />
          </div>
      }
      {
        companyLogo &&
        ((player.controls.IsPlaying() && player.playerOptions.watermark) || (!player.controls.IsPlaying())) &&
          <div className={ControlStyles["watermark"]}>
            <img src={companyLogo} alt="Company logo" />
          </div>
      } 
    </div>
  );
};

export default WebControls;
