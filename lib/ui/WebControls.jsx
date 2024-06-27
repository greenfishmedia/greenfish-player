import ControlStyles from "../static/stylesheets/controls-web.module.scss";

// eslint-disable-next-line no-unused-vars
import React, {useEffect, useState} from "react";
import * as Icons from "../static/icons/Icons.js";
import {ObserveVideo, ObserveVideoTime} from "./Observers.js";
import "focus-visible";
import {ImageUrl, PlayerClick, Time} from "./Common.js";
import EluvioPlayerParameters from "../player/PlayerParameters.js";

import EluvioLogo from "../static/images/Logo.png";
import {CollectionMenu, ContentVerificationMenu, SeekBar, SettingsMenu, VolumeControls} from "./Components.jsx";

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

  if(player.isLive) {
    return (
      <div className={ControlStyles["live-indicator"]}>
        Live
      </div>
    );
  }

  return (
    <div className={ControlStyles["time"]}>
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

const MenuButton = ({label, icon, player, setMenuActive, MenuComponent, className=""}) => {
  const [show, setShow] = useState(false);

  return (
    <div className={[ControlStyles["menu-control-container"], className].join(" ")}>
      <IconButton
        aria-label={show ? `Hide ${label} Menu` : label}
        aria-haspopup
        icon={icon}
        onClick={() => {
          setMenuActive(!show);
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
              setMenuActive(false);
            }}
          />
      }
    </div>
  );
};

const ContentInfo = ({player}) => {
  const [imageUrl, setImageUrl] = useState(undefined);

  const { title, subtitle, description, image, headers } = (player.controls.GetContentInfo() || {});

  useEffect(() => {
    setImageUrl(undefined);

    if(!image) { return; }

    ImageUrl({player, pathOrUrl: image, width: 200})
      .then(imageUrl => setImageUrl(imageUrl));
  }, [image]);

  if(
    !title ||
    (player.playerOptions.title === EluvioPlayerParameters.title.FULLSCREEN_ONLY && !player.controls.IsFullscreen()) ||
    player.playerOptions.title === EluvioPlayerParameters.title.OFF
  ) {
    return null;
  }

  return (
    <div className={ControlStyles["info-container"]}>
      {
        !imageUrl ? null :
          <div className={ControlStyles["info-image-container"]}>
            <img src={imageUrl} alt="Image" className={ControlStyles["info-image"]} />
          </div>
      }
      <div className={ControlStyles["info-text"]}>
        {
          headers.length === 0 ? null :
            <div className={ControlStyles["info-headers"]}>
              {headers.map((text, index) =>
                <div key={`header-${index}`} className={ControlStyles["info-header"]}>
                  { text }
                </div>
              )}
            </div>
        }
        { !title ? null : <div className={ControlStyles["info-title"]}>{title}</div> }
        { !subtitle ? null : <div className={ControlStyles["info-subtitle"]}>{subtitle}</div> }
        { !description ? null : <div className={ControlStyles["info-description"]}>{description}</div> }
      </div>
    </div>
  );
};

const ContentVerificationControls = ({player, setMenuActive}) => {
  const [contentVerified, setContentVerified] = useState(false);

  useEffect(() => {
    const UpdateVerification = () => setContentVerified(player.controls.ContentVerified());

    UpdateVerification();

    player.controls.RegisterSettingsListener(UpdateVerification);
  }, []);

  if(!contentVerified) {
    return null;
  }

  return (
    <>
      <div className={ControlStyles["content-verified-badge"]}>
        VERIFIED
      </div>
      <MenuButton
        label="Content Verification Menu"
        icon={Icons.ContentBadgeIcon}
        player={player}
        setMenuActive={setMenuActive}
        MenuComponent={ContentVerificationMenu}
        className={ControlStyles["content-verification-menu-button"]}
      />
    </>
  );
};

const WebControls = ({player, playbackStarted, canPlay, recentlyInteracted, setRecentUserAction, className=""}) => {
  const [videoState, setVideoState] = useState(undefined);
  const [playerClickHandler, setPlayerClickHandler] = useState(undefined);
  const [activeMenus, setActiveMenus] = useState(0);

  useEffect(() => {
    setPlayerClickHandler(PlayerClick({player, setRecentUserAction}));

    const disposeVideoObserver = ObserveVideo({target: player.target, video: player.video, setVideoState});

    return () => disposeVideoObserver && disposeVideoObserver();
  }, []);

  if(!videoState) { return null; }

  const collectionInfo = player.controls.GetCollectionInfo();
  const menuActive = activeMenus > 0;
  const setMenuActive = active => setActiveMenus(active ? activeMenus + 1 : Math.max(0, activeMenus - 1));

  // Title autohide is not dependent on controls settings
  const showUI = recentlyInteracted || !playbackStarted || menuActive;
  const hideControls = !showUI && player.playerOptions.controls === EluvioPlayerParameters.controls.AUTO_HIDE;

  player.__SetControlsVisibility(!hideControls);

  return (
    <div
      onClick={playerClickHandler}
      className={[
        className,
        ControlStyles["container"],
        showUI ? "" : ControlStyles["autohide"],
        player.playerOptions.controls !== EluvioPlayerParameters.controls.DEFAULT ? "" : ControlStyles["container--default-controls"],
        menuActive ? "menu-active" : ""
      ].join(" ")}
    >
      <ContentInfo key={`content-info-${collectionInfo && collectionInfo.mediaIndex}`} player={player} />
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
              <SeekBar player={player} videoState={videoState} setRecentUserAction={setRecentUserAction} className={ControlStyles["seek"]} />
              <div className={ControlStyles["controls"]}>
                <IconButton
                  aria-label={videoState.playing ? "Pause" : "Play"}
                  icon={videoState.playing ? Icons.PauseCircleIcon : Icons.PlayCircleIcon}
                  onClick={() => player.controls.TogglePlay()}
                  className={ControlStyles["play-pause-button"]}
                />
                <CollectionControls player={player} />
                <VolumeControls player={player} videoState={videoState} />
                <TimeIndicator player={player} videoState={videoState}/>

                <div className={ControlStyles["spacer"]}/>

                <ContentVerificationControls
                  player={player}
                  setMenuActive={setMenuActive}
                />

                {
                  !collectionInfo ? null :
                    <MenuButton
                      label="Collection Menu"
                      icon={Icons.CollectionIcon}
                      player={player}
                      setMenuActive={setMenuActive}
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
                {
                  !player.controls.GetOptions().hasAnyOptions ? null :
                    <MenuButton
                      label="Settings Menu"
                      icon={Icons.SettingsIcon}
                      player={player}
                      setMenuActive={setMenuActive}
                      MenuComponent={SettingsMenu}
                    />
                }
                <IconButton
                  aria-label={videoState.fullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  icon={videoState.fullscreen ? Icons.ExitFullscreenIcon : Icons.FullscreenIcon}
                  onClick={() => player.controls.ToggleFullscreen()}
                  className={ControlStyles["right-control-button"]}
                />
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
        // Watermark
        player.playerOptions.watermark === EluvioPlayerParameters.watermark.OFF ? null :
          <div className={ControlStyles["watermark"]}>
            <img src={EluvioLogo} alt="Eluvio" />
          </div>
      }
    </div>
  );
};

export default WebControls;
