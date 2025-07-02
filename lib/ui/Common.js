import { DefaultParameters } from "../player/PlayerParameters";

export const ACTIONS = {
  PLAY: "play",
  PAUSE: "pause",
  MUTE: "muted",
  UNMUTE: "unmuted",
  VOLUME_UP: "volumeup",
  VOLUME_DOWN: "volumedown",
  SEEK_BACK: "seekback",
  SEEK_FORWARD: "seekforward",
  PLAYBACK_RATE_UP: "playbackrateup",
  PLAYBACK_RATE_DOWN: "playbackratedown",
  SUBTITLES_ON: "subtitleson",
  SUBTITLES_OFF: "subtitlesoff",
  PLAY_NEXT: "playnext",
  PLAY_PREVIOUS: "playprevious",
};

// Handlers

// Player click handler is a closure so it can keep track of click timing to differentiate between single and double click
export const PlayerClick = ({
  player,
  setRecentUserAction,
  sideClickRatio = 0.1,
  doubleClickDelay = 300,
}) => {
  let lastClicked, singleClickTimeout, lastFocused, currentFocused;

  // Keep track of which element has focus - we don't want to play/pause on click if the click was to focus on the player
  // Note that double click to fullscreen *will* still work regardless of focus
  window.addEventListener(
    "focus",
    () => {
      lastFocused = currentFocused || document.activeElement;
      currentFocused = document.activeElement;
    },
    true
  );

  // Extra wrapper function so it can be stored as react state
  return () => (event) => {
    clearTimeout(singleClickTimeout);

    if (
      // Only react to clicks on this element specifically, not other control elements
      event.target === event.currentTarget &&
      // Player was not previously focused - ignore click
      event.currentTarget.contains(lastFocused) &&
      // Menu open - click will close menu instead of changing pause state
      !event.currentTarget.classList.contains("menu-active")
    ) {
      if (Date.now() - lastClicked < doubleClickDelay) {
        // Double click

        // If clicked on far left or right side of the player, seek
        const rect = event.target.getBoundingClientRect();
        const xRatio = (event.clientX - rect.left) / rect.width;

        if (xRatio <= sideClickRatio) {
          player.controls.Seek({ relativeSeconds: -10 });
          setRecentUserAction({
            action: ACTIONS.SEEK_BACK,
            text: "10 seconds",
          });
        } else if (xRatio >= 1 - sideClickRatio) {
          player.controls.Seek({ relativeSeconds: 10 });
          setRecentUserAction({
            action: ACTIONS.SEEK_FORWARD,
            text: "10 seconds",
          });
        } else {
          // Otherwise, fullscreen
          player.controls.ToggleFullscreen();
        }
      } else {
        // Single click
        singleClickTimeout = setTimeout(() => {
          const playing = player.controls.TogglePlay();
          setRecentUserAction({
            action: playing ? ACTIONS.PLAY : ACTIONS.PAUSE,
          });
        }, doubleClickDelay);
      }
    }

    lastFocused = event.target;
    lastClicked = Date.now();
  };
};

// Seek slider handler is a closure so it can keep track of the number of repeat events to seek faster
export const SeekSliderKeyDown = (player, setRecentUserAction) => {
  let updates = 0;
  // Extra wrapper function so it can be stored as react state
  return () => (event) => {
    if (!event.repeat) {
      updates = 0;
    }

    const seekAmount =
      updates < 5 ? 5 : updates < 15 ? 10 : updates < 40 ? 30 : 60;
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        player.controls.Seek({ relativeSeconds: -seekAmount });
        setRecentUserAction({
          action: ACTIONS.SEEK_BACK,
          text: `${seekAmount} seconds`,
        });
        break;
      case "ArrowRight":
        event.preventDefault();
        player.controls.Seek({ relativeSeconds: seekAmount });
        setRecentUserAction({
          action: ACTIONS.SEEK_FORWARD,
          text: `${seekAmount} seconds`,
        });
        break;
      default:
        return;
    }

    updates += 1;
  };
};

export const VolumeSliderKeydown = (player) => (event) => {
  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      player.controls.SetVolume({ relativeFraction: -0.05 });
      break;
    case "ArrowRight":
      event.preventDefault();
      if (player.controls.IsMuted()) {
        player.controls.SetVolume({ fraction: 0.05 });
      } else {
        player.controls.SetVolume({ relativeFraction: 0.05 });
      }
      break;
  }
};

// Misc

export const Time = (time, total) => {
  if (isNaN(total) || !isFinite(total) || total === 0) {
    return "00:00";
  }

  const useHours = total > 60 * 60;

  const hours = Math.floor(time / 60 / 60);
  const minutes = Math.floor((time / 60) % 60);
  const seconds = Math.floor(time % 60);

  let string = `${minutes
    .toString()
    .padStart(useHours && hours > 0 ? 2 : 1, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  if (useHours) {
    string = `${hours.toString()}:${string}`;
  }

  return string;
};

export const ImageUrl = async ({ player, pathOrUrl = "", width }) => {
  if (
    typeof pathOrUrl === "string" &&
    (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://"))
  ) {
    return pathOrUrl;
  } else if (pathOrUrl && pathOrUrl.url) {
    return pathOrUrl.url;
  }

  const client = await player.__Client();
  let versionHash;

  const { mediaCatalogObjectId, mediaCatalogVersionHash } =
    (player.sourceOptions && player.sourceOptions.mediaCollectionOptions) || {};
  const playoutParameters =
    (player.sourceOptions && player.sourceOptions.playoutParameters) || {};
  if (mediaCatalogVersionHash) {
    versionHash = mediaCatalogVersionHash;
  } else if (mediaCatalogObjectId) {
    versionHash = await client.LatestVersionHash({
      objectId: mediaCatalogObjectId,
    });
  } else if (playoutParameters.versionHash) {
    versionHash = playoutParameters.versionHash;
  } else {
    versionHash = await client.LatestVersionHash({
      objectId: playoutParameters.objectId,
    });
  }

  if (!versionHash) {
    return "";
  }

  pathOrUrl =
    pathOrUrl &&
    pathOrUrl.toString().trim().replace(/^\./, "").replace(/\/+/, "");

  if (pathOrUrl.startsWith("files")) {
    return await client.FileUrl({
      versionHash,
      filePath: pathOrUrl.replace(/^files/, ""),
      queryParams: width ? { width } : {},
      authorizationToken: playoutParameters.authorizationToken,
    });
  } else {
    return await client.LinkUrl({
      versionHash,
      linkPath: pathOrUrl,
      queryParams: width ? { width } : {},
      authorizationToken: playoutParameters.authorizationToken,
    });
  }
};

// Merge defaults with provided parameters. Any parameters not specified in defaults will be ignored.
export const MergeParameters = (defaults, parameters) => {
  let merged = {};
  Object.keys(defaults).forEach((key) => {
    if (typeof defaults[key] === "object" && !Array.isArray(defaults[key])) {
      merged[key] = MergeParameters(defaults[key], (parameters || {})[key]);
    } else {
      const value = (parameters || {})[key];
      merged[key] = typeof value !== "undefined" ? value : defaults[key];
    }
  });

  return merged;
};

export const MergeDefaultParameters = (parameters) => {
  return MergeParameters(DefaultParameters, parameters);
};
