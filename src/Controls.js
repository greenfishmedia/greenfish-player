import PlayCircleIcon from "./static/icons/play.svg";

import PlayIcon from "./static/icons/play.svg";
import PauseIcon from "./static/icons/pause.svg";
import FullscreenIcon from "./static/icons/full screen.svg";
import ExitFullscreenIcon from "./static/icons/minimize.svg";
import MutedIcon from "./static/icons/muted.svg";
import VolumeLowIcon from "./static/icons/unmuted.svg";
import VolumeHighIcon from "./static/icons/unmuted.svg";

import LogoSVG from "./static/images/ELUVIO white.svg";

import {EluvioPlayerParameters} from "./index";

let timeouts = {};
let played = false;
let controlsHover = false;

export const CreateElement = ({parent, type="div", options={}, classes=[]}) => {
  const element = document.createElement(type);
  classes.forEach(c => element.classList.add(c));
  parent.appendChild(element);

  Object.keys(options).forEach(key => element[key] = options[key]);

  return element;
};

const CreateImageButton = ({parent, svg, options={}, classes=[]}) => {
  classes.unshift("eluvio-player__controls__button");
  const button = CreateElement({parent, type: "button", options, classes});
  button.innerHTML = svg;

  return button;
};

const FadeOut = (key, element, delay=250, callback) => {
  clearTimeout(timeouts[key]);

  timeouts[key] = setTimeout(() => {
    element.style.pointerEvents = "none";
    element.style.opacity = "0";

    if(callback) {
      callback();
    }
  }, delay);
};

const FadeIn = (key, element) => {
  clearTimeout(timeouts[key]);

  element.style.opacity = "1";
  element.style.pointerEvents = "unset";
};

const ToggleFullscreen = (target) => {
  if(document.fullscreenElement) {
    if(document.exitFullscreen) {
      document.exitFullscreen();
    } else if(document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if(document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if(document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  } else {
    if(target.requestFullscreen) {
      target.requestFullscreen();
    } else if(target.mozRequestFullScreen) {
      target.mozRequestFullScreen();
    } else if(target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen();
    } else if(target.msRequestFullscreen) {
      target.msRequestFullscreen();
    }
  }
};

const Time = (time, total) => {
  if(isNaN(total) || !isFinite(total) || total === 0) { return "00:00"; }

  const useHours = total > 60 * 60;

  const hours = Math.floor(time / 60 / 60);
  const minutes = Math.floor(time / 60 % 60);
  const seconds = Math.floor(time % 60);

  let string = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  if(useHours) {
    string = `${hours.toString()}:${string}`;
  }

  return string;
};

export const InitializeControls = (target, video, playerOptions) => {
  if(playerOptions.watermark) {
    // Watermark
    const watermark = CreateElement({
      parent: target,
      type: "div",
      classes: ["eluvio-player__watermark"]
    });

    watermark.innerHTML = LogoSVG;
  }

  if(
    playerOptions.controls === EluvioPlayerParameters.controls.DEFAULT ||
    playerOptions.controls === EluvioPlayerParameters.controls.OFF
  ) {
    // Controls disabled
    return;
  }

  video.addEventListener("click", () => {
    clearTimeout(timeouts.playPause);
    timeouts.playPause = setTimeout(() => video.paused ? video.play() : video.pause(), 200);
  });

  // Big play icon
  const bigPlayButton = CreateImageButton({
    parent: target,
    svg: PlayCircleIcon,
    classes: ["eluvio-player__big-play-button"]
  });

  video.addEventListener("play", () => FadeOut("big-play-button", bigPlayButton));
  video.addEventListener("pause", () => FadeIn("big-play-button", bigPlayButton));

  bigPlayButton.style.display = video.paused ? "block" : "none";
  bigPlayButton.addEventListener("click", () => video.play());

  if(playerOptions.controls === EluvioPlayerParameters.controls.OFF) {
    return;
  }

  // Controls container
  const controls = CreateElement({
    parent: target,
    type: "div",
    classes: ["eluvio-player__controls"]
  });

  // Play / Pause
  const playPauseButton = CreateImageButton({
    parent: controls,
    svg: video.paused ? PlayIcon : PauseIcon,
    classes: ["eluvio-player__controls__button-play"]
  });

  playPauseButton.addEventListener("click", () => {
    video.paused ? video.play() : video.pause();
  });

  // Volume
  const volumeButton = CreateImageButton({
    parent: controls,
    svg: video.muted || video.volume === 0 ? MutedIcon : (video.volume < 0.5 ? VolumeLowIcon : VolumeHighIcon),
    classes: ["eluvio-player__controls__button-volume"]
  });

  volumeButton.addEventListener("click", () => video.muted = !video.muted);

  // Volume Slider
  const volumeSlider = CreateElement({
    parent: controls,
    type: "input",
    options: {
      type: "range",
      min: 0,
      step: "any",
      max: 1,
      value: video.muted ? 0 : video.volume
    },
    classes: ["eluvio-player__controls__volume-slider"]
  });

  volumeSlider.addEventListener("input", () => {
    video.muted = parseFloat(volumeSlider.value) === 0;
    video.volume = parseFloat(volumeSlider.value);
  });

  const progressTime = CreateElement({
    parent: controls,
    type: "div",
    classes: ["eluvio-player__controls__time", "eluvio-player__controls__progress-time"]
  });

  progressTime.innerHTML = "00:00";

  // Progress Bar
  const progressSlider = CreateElement({
    parent: controls,
    type: "input",
    options: {
      type: "range",
      min: 0,
      step: "any",
      max: 1,
      value: 0
    },
    classes: ["eluvio-player__controls__progress-slider"]
  });

  progressSlider.addEventListener("input", () => video.currentTime = video.duration * parseFloat(progressSlider.value));

  const totalTime = CreateElement({
    parent: controls,
    type: "div",
    classes: ["eluvio-player__controls__time", "eluvio-player__controls__total-time"]
  });

  totalTime.innerHTML = "00:00";

  // Fullscreen
  const fullscreenButton = CreateImageButton({
    parent: controls,
    svg: FullscreenIcon,
    classes: ["eluvio-player__controls__button-fullscreen"]
  });

  fullscreenButton.addEventListener("click", () => ToggleFullscreen(target));

  // Event Listeners

  const Progress = () => {
    progressSlider.value = isNaN(video.duration) ? 0 : video.currentTime / video.duration;
    progressTime.innerHTML = Time(video.currentTime, video.duration);
    totalTime.innerHTML = Time(video.duration, video.duration);
  };

  video.addEventListener("durationchange", Progress);

  target.addEventListener("dblclick", () => {
    clearTimeout(timeouts.playPause);
    ToggleFullscreen(target);
  });

  video.addEventListener("play", () => {
    played = true;
    playPauseButton.innerHTML = PauseIcon;

    clearTimeout(timeouts.progress);
    timeouts.progress = setInterval(Progress, 50);

    if(playerOptions.controls === EluvioPlayerParameters.controls.AUTO_HIDE) {
      target.dispatchEvent(new Event("mousemove"));
    }
  });

  video.addEventListener("pause", () => {
    playPauseButton.innerHTML = PlayIcon;
    clearTimeout(timeouts.progress);
  });

  video.addEventListener("volumechange", () => {
    volumeButton.innerHTML = video.muted || video.volume === 0 ? MutedIcon : (video.volume < 0.5 ? VolumeLowIcon : VolumeHighIcon);
    volumeSlider.value = video.muted ? 0 : Math.min(1, Math.max(0, video.volume));
  });

  video.addEventListener("seeked", () => progressSlider.value = video.currentTime / video.duration);

  target.addEventListener("fullscreenchange", () => {
    if(!document.fullscreenElement) {
      fullscreenButton.innerHTML = FullscreenIcon;
    } else if(target === document.fullscreenElement) {
      fullscreenButton.innerHTML = ExitFullscreenIcon;
    }
  });

  // Autohide controls
  if(playerOptions.controls === EluvioPlayerParameters.controls.AUTO_HIDE) {
    target.addEventListener("mousemove", () => {
      if(!played || controlsHover) { return; }

      FadeIn("controls", controls);
      FadeOut("controls", controls, 3000, () => target.style.cursor = "none");

      target.style.cursor = "unset";
    });

    target.addEventListener("mouseleave", () => {
      if(!played) { return; }

      FadeOut("controls", controls, 2000);
    });

    controls.addEventListener("mouseenter", () => {
      clearTimeout(timeouts.controls);
      controlsHover = true;
    });

    controls.addEventListener("mouseleave", () => controlsHover = false);
  }
};
