import ResetStyle from "../static/stylesheets/reset.module.scss";
import PlayerStyles from "../static/stylesheets/player.module.scss";

import React, {useEffect, useRef, useState} from "react";
import ReactDOM from "react-dom/client";

import EluvioPlayer from "../player/Player.js";
import EluvioPlayerParameters from "../player/PlayerParameters.js";
import {
  ObserveInteraction,
  ObserveKeydown,
  ObserveMediaSession,
  ObserveResize,
  ObserveVisibility
} from "./Observers.js";
import WebControls from "./WebControls.jsx";
import TicketForm from "./TicketForm.jsx";
import {Spinner, UserActionIndicator} from "./Components.jsx";
import TVControls from "./TVControls.jsx";
import PlayerProfileForm from "./PlayerProfileForm.jsx";
import {ImageUrl, MergeDefaultParameters} from "./Common.js";

const Poster = ({player}) => {
  const [imageUrl, setImageUrl] = useState(undefined);

  const { posterImage } = (player.controls.GetContentInfo() || {});

  useEffect(() => {
    setImageUrl(undefined);

    if(!posterImage) { return; }

    ImageUrl({player, pathOrUrl: posterImage, width: 200})
      .then(imageUrl => setImageUrl(imageUrl));
  }, [posterImage]);

  if(!imageUrl) { return null; }

  return (
    <img
      alt="Video Poster"
      src={imageUrl}
      className={PlayerStyles["poster"]}
    />
  );
};

const PlayerUI = ({target, parameters, InitCallback, ErrorCallback, Unmount, Reset}) => {
  const [player, setPlayer] = useState(undefined);
  const [client, setClient] = useState(undefined);
  const [size, setSize] = useState("lg");
  const [orientation, setOrientation] = useState("landscape");
  const [dimensions, setDimensions] = useState({
    width: target.getBoundingClientRect().width,
    height: target.getBoundingClientRect().height
  });
  const [errorMessage, setErrorMessage] = useState(undefined);
  const [playerInitialized, setPlayerInitialized] = useState(false);
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPlayerProfileForm, setShowPlayerProfileForm] = useState(false);
  const [recentlyInteracted, setRecentlyInteracted] = useState(true);
  const [recentUserAction, setRecentUserAction] = useState(undefined);
  const [allowRotation, setAllowRotation] = useState(undefined);
  const videoRef = useRef();

  const playerSet = !!player;

  const onUserAction = ({action, text}) => setRecentUserAction({action, text, key: Math.random()});

  useEffect(() => {
    setMounted(true);

    // Observe target portal size
    const disposeResizeObserver = ObserveResize({target, setSize, setOrientation, setDimensions});

    return () => {
      setMounted(false);
      disposeResizeObserver && disposeResizeObserver();
    };
  }, []);

  useEffect(() => {
    if(!videoRef || !videoRef.current || !mounted) {
      return;
    }

    try {
      setPlayerInitialized(false);
      setPlaybackStarted(false);

      // Use ticket client if present
      parameters.clientOptions.client = client || parameters.clientOptions.client;

      const newPlayer = new EluvioPlayer({
        target,
        video: videoRef.current,
        parameters,
        SetErrorMessage: setErrorMessage
      });

      window.__elvPlayer = newPlayer;

      // Observe player settings to keep track of whether playback has started
      const disposePlayerSettingsListener = newPlayer.controls.RegisterSettingsListener(
        () => {
          setAllowRotation(newPlayer.controls.AllowRotation());
          setPlaybackStarted(newPlayer.playbackStarted);
          setPlayerInitialized(!newPlayer.loading);
          setShowPlayerProfileForm(newPlayer.__showPlayerProfileForm);
        }
      );

      // Destroy method for external use - destroys internal player and unmounts react
      newPlayer.Destroy = () => {
        newPlayer.__DestroyPlayer();
        Unmount();
      };

      newPlayer.Reset = () => {
        Reset();
      };

      // Observe whether player is visible for autoplay/mute on visibility functionality
      const disposeVisibilityObserver = ObserveVisibility({player: newPlayer});

      // Observe interaction for autohiding control elements
      const disposeInteractionObserver = ObserveInteraction({
        player: newPlayer,
        inactivityPeriod: 5000,
        onWake: () => setRecentlyInteracted(true),
        onSleep: () => setRecentlyInteracted(false)
      });

      // Keyboard controls
      const disposeKeyboardControls = ObserveKeydown({
        player: newPlayer,
        setRecentUserAction: onUserAction
      });

      // Media session
      const disposeMediaSessionObserver = ObserveMediaSession({player: newPlayer});

      InitCallback(newPlayer);
      setPlayer(newPlayer);

      // Can play
      const disposeCanPlayListener = newPlayer.controls.RegisterVideoEventListener("canplay", () => setCanPlay(true));

      return () => {
        videoRef && videoRef.current && videoRef.current.removeEventListener("play", setPlaybackStarted);

        disposePlayerSettingsListener && disposePlayerSettingsListener();
        disposeVisibilityObserver && disposeVisibilityObserver();
        disposeInteractionObserver && disposeInteractionObserver();
        disposeKeyboardControls && disposeKeyboardControls();
        disposeMediaSessionObserver && disposeMediaSessionObserver();
        disposeCanPlayListener && disposeCanPlayListener();

        newPlayer && newPlayer.__DestroyPlayer();
      };
    } catch(error) {
      ErrorCallback(error);
      Unmount();
    }
  }, [videoRef, mounted, client]);

  useEffect(() => {
    if(!playerSet) { return; }

    // Clean up player when unmounting
    return () => {
      player && player.__DestroyPlayer();
      setPlayer(undefined);
    };
  }, [playerSet]);

  if(parameters.clientOptions.promptTicket && !client) {
    return (
      <TicketForm
        parameters={parameters}
        dimensions={{size, orientation, ...dimensions}}
        onComplete={ticketClient => setClient(ticketClient)}
      />
    );
  }

  const shouldRotate =
    player &&
    player.controls.IsRotatable() &&
    allowRotation;

  return (
    <div
      role="complementary"
      aria-label="Eluvio Video Player"
      tabIndex={0}
      style={{
        backgroundColor: parameters.playerOptions.backgroundColor || "transparent",
        "--portal-width": `${dimensions.width}px`,
        "--portal-height": `${dimensions.height}px`
      }}
      className={[PlayerStyles["player-container"], shouldRotate ? PlayerStyles["player-container--rotated"] : "", `__eluvio-player--size-${size}`, `__eluvio-player--orientation-${orientation}`].join(" ")}
    >
      {
        !showPlayerProfileForm || !playerInitialized ? null :
          <PlayerProfileForm player={player} Close={() => player.controls.HidePlayerProfileForm()} />
      }
      <video
        playsInline
        disablePictureInPicture
        ref={videoRef}
        muted={[EluvioPlayerParameters.muted.ON, EluvioPlayerParameters.muted.WHEN_NOT_VISIBLE].includes(parameters.playerOptions.muted)}
        controls={parameters.playerOptions.controls === EluvioPlayerParameters.controls.DEFAULT}
        loop={parameters.playerOptions.loop === EluvioPlayerParameters.loop.ON}
        className={PlayerStyles.video}
      />
      {
        !player || playbackStarted || !canPlay ? null :
          <Poster player={player} />
      }
      {
        playerInitialized || errorMessage ? null :
          <div className={PlayerStyles["spinner-container"]}>
            <Spinner className={PlayerStyles["spinner"]} />
          </div>
      }
      {
        !errorMessage ? null :
          <div className={PlayerStyles["error-message"]}>{ errorMessage }</div>
      }
      {
        !player ? null :
          parameters.playerOptions.ui === EluvioPlayerParameters.ui.WEB ?
            <WebControls
              player={player}
              playbackStarted={!!playbackStarted}
              canPlay={canPlay}
              recentlyInteracted={recentlyInteracted}
              setRecentUserAction={onUserAction}
              className={PlayerStyles.controls}
            /> :
            <TVControls
              player={player}
              playbackStarted={!!playbackStarted}
              canPlay={canPlay}
              recentlyInteracted={recentlyInteracted}
              setRecentUserAction={onUserAction}
              className={PlayerStyles.controls}
            />
      }
      {
        !recentUserAction ? null :
          <UserActionIndicator
            action={recentUserAction}
            key={`action-indicator-${recentUserAction && recentUserAction.key}`}
          />
      }
    </div>
  );
};

const PlayerWrapper = (args) => {
  const [playerKey, setPlayerKey] = useState(Math.random());

  return (
    <PlayerUI
      {...args}
      key={`player-${playerKey}`}
      Reset={() => setPlayerKey(Math.random())}
    />
  );
};

const Initialize = (target, parameters) => {
  target.innerHTML = "";
  target.classList.add(ResetStyle.reset);
  target.classList.add(PlayerStyles["player-target"]);

  parameters = MergeDefaultParameters(parameters);

  if(parameters.playerOptions && parameters.playerOptions.backgroundColor) {
    target.style.backgroundColor = parameters.playerOptions.backgroundColor;
  }

  return new Promise((resolve, reject) => {
    const root = ReactDOM.createRoot(target);

    root.render(
      <React.StrictMode>
        <PlayerWrapper
          target={target}
          parameters={parameters}
          InitCallback={resolve}
          ErrorCallback={reject}
          Unmount={async () => {
            try {
              await root.unmount();
            } catch(error) {
              // eslint-disable-next-line no-console
              console.error("Failed to unmount Eluvio Player");
              // eslint-disable-next-line no-console
              console.error(error);
            }
          }
          }
        />
      </React.StrictMode>
    );
  });
};


export default Initialize;

