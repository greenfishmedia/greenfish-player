import PlayCircleIcon from "./static/icons/play-circle.svg";

import PlayIcon from "./static/icons/play.svg";
import PauseIcon from "./static/icons/pause.svg";
import FullscreenIcon from "./static/icons/maximize.svg";
import ExitFullscreenIcon from "./static/icons/minimize.svg";
import MutedIcon from "./static/icons/volume-x.svg";
import VolumeLowIcon from "./static/icons/volume-1.svg";
import VolumeHighIcon from "./static/icons/volume-2.svg";

import LogoSVG from "./static/images/ELUVIO white.svg";

import {EluvioPlayerParameters} from "./index";

let timeouts = {};

export const CreateElement = ({parent, type, options={}, classes=[]}) => {
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

const FadeOut = (key, element, delay=250) => {
  timeouts[key] = setTimeout(() => {
    element.style.opacity = 0;
    timeouts[key] = setTimeout(() => element.style.display = "none", 250);
  }, delay);
};

const FadeIn = (key, element, display="block") => {
  clearTimeout(timeouts[key]);
  element.style.display = display;

  timeouts[key] = setTimeout(() => element.style.opacity = 1, 100);
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

  this.video.addEventListener("click", () => this.video.paused ? this.video.play() : this.video.pause());

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

  // Progress Bar
  const progressSlider = CreateElement({
    parent: controls,
    type: "input",
    options: {
      type: "range",
      min: 0,
      step: 0.0001,
      max: 1,
      value: video.volume
    },
    classes: ["eluvio-player__controls__progress-slider"]
  });

  progressSlider.addEventListener("change", () => video.currentTime = video.duration * parseFloat(progressSlider.value));

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
      step: 0.01,
      max: 1,
      value: video.volume
    },
    classes: ["eluvio-player__controls__volume-slider"]
  });

  volumeSlider.addEventListener("change", () => video.volume = parseFloat(volumeSlider.value));

  // Fullscreen
  const fullscreenButton = CreateImageButton({
    parent: controls,
    svg: FullscreenIcon,
    classes: ["eluvio-player__controls__button-fullscreen"]
  });

  fullscreenButton.addEventListener("click", () => ToggleFullscreen(target));


  // Event Listeners

  video.addEventListener("play", () => playPauseButton.innerHTML = PauseIcon);
  video.addEventListener("pause", () => playPauseButton.innerHTML = PlayIcon);
  video.addEventListener("volumechange", () => {
    volumeButton.innerHTML = video.muted || video.volume === 0 ? MutedIcon : (video.volume < 0.5 ? VolumeLowIcon : VolumeHighIcon);
    volumeSlider.value = Math.min(1, Math.max(0, video.volume));
  });

  video.addEventListener("seeked", () => progressSlider.value = video.currentTime / video.duration);

  video.addEventListener("progress", () => {
    progressSlider.value = video.currentTime / video.duration;
  });

  target.addEventListener("fullscreenchange", () => {
    if(!document.fullscreenElement) {
      fullscreenButton.innerHTML = FullscreenIcon;
    } else if(target === document.fullscreenElement) {
      fullscreenButton.innerHTML = ExitFullscreenIcon;
    }
  });

  // Autohide controls
  if(playerOptions.controls === EluvioPlayerParameters.controls.AUTO_HIDE) {
    target.addEventListener("mouseleave", () => FadeOut("controls", controls, 2000));
    target.addEventListener("mouseenter", () => FadeIn("controls", controls, "flex"));
  }
};
