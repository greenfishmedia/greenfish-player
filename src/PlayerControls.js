import PlayCircleIcon from "./static/icons/play circle.svg";

import PlayIcon from "./static/icons/play.svg";
import PauseIcon from "./static/icons/pause.svg";
import FullscreenIcon from "./static/icons/full screen.svg";
import ExitFullscreenIcon from "./static/icons/minimize.svg";
import SettingsIcon from "./static/icons/settings.svg";
import MutedIcon from "./static/icons/muted.svg";
import VolumeLowIcon from "./static/icons/unmuted.svg";
import VolumeHighIcon from "./static/icons/unmuted.svg";
import MultiViewIcon from "./static/icons/multiview.svg";

import Logo from "./static/images/ELUV.IO white 20 px V2.png";

import {EluvioPlayerParameters} from "./index";

export const CreateElement = ({parent, type="div", options={}, classes=[], prepend=false}) => {
  const element = document.createElement(type);
  classes.filter(c => c).forEach(c => element.classList.add(c));
  prepend ? parent.prepend(element) : parent.appendChild(element);

  Object.keys(options).forEach(key => element[key] = options[key]);

  return element;
};

const CreateImageButton = ({parent, svg, alt, options={}, classes=[], prepend=false}) => {
  classes.unshift("eluvio-player__controls__button");
  const button = CreateElement({parent, type: "button", options, classes, prepend});
  button.innerHTML = svg;

  button.querySelector("svg").setAttribute("alt", alt);

  return button;
};

const ToggleFullscreen = (target) => {
  const isFullscreen = !!(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);

  if(isFullscreen) {
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
      target.requestFullscreen({navigationUI: "hide"});
    } else if(target.mozRequestFullScreen) {
      target.mozRequestFullScreen({navigationUI: "hide"});
    } else if(target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen({navigationUI: "hide"});
    } else if(target.msRequestFullscreen) {
      target.msRequestFullscreen({navigationUI: "hide"});
    } else {
      // iPhone - Use native fullscreen on video element only
      target.querySelector("video").webkitEnterFullScreen();
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

class PlayerControls {
  constructor(target, video, playerOptions, posterUrl) {
    this.target = target;
    this.video = video;
    this.playerOptions = playerOptions;
    this.posterUrl = posterUrl;

    this.settingsMenuContent = "none";
    this.timeouts = {};
    this.played = false;
    this.controlsHover = false;
    this.progressHidden = false;

    this.InitializeControls();
  }

  FadeOut(key, elements, delay=250, callback) {
    clearTimeout(this.timeouts[key]);

    this.timeouts[key] = setTimeout(() => {
      elements.forEach(element => {
        if(!element) { return; }

        element.style.pointerEvents = "none";
        element.style.opacity = "0";
      });

      if(callback) {
        callback();
      }
    }, delay);
  }

  FadeIn(key, elements) {
    clearTimeout(this.timeouts[key]);

    elements.forEach(element => {
      if(!element) { return; }

      element.style.opacity = "1";
      element.style.pointerEvents = "unset";
    });
  }

  InitializeControls() {
    this.target.setAttribute("tabindex", "0");

    if(this.playerOptions.watermark) {
      // Watermark
      const watermark = CreateElement({
        parent: this.target,
        type: "img",
        classes: ["eluvio-player__watermark"]
      });

      watermark.src = Logo;
    }

    if(
      this.playerOptions.controls === EluvioPlayerParameters.controls.DEFAULT ||
      this.playerOptions.controls === EluvioPlayerParameters.controls.OFF
    ) {
      // Controls disabled
      return;
    }

    this.video.addEventListener("click", () => {
      if(window.matchMedia("(hover: none)").matches) {
        // Touch screen - don't start/stop on video click
        return;
      }

      clearTimeout(this.timeouts.playPause);
      this.timeouts.playPause = setTimeout(() => this.video.paused ? this.video.play() : this.video.pause(), 200);
    });

    // Big play icon
    this.bigPlayButton = CreateImageButton({
      parent: this.target,
      svg: PlayCircleIcon,
      classes: ["eluvio-player__big-play-button"],
      alt: "Play"
    });

    this.video.addEventListener("play", () => {
      this.FadeOut("big-play-button", [this.bigPlayButton]);

      // Prevent big play button from flashing
      setTimeout(() => this.target.classList.remove("eluvio-player-restarted"), 1000);
    });
    this.video.addEventListener("pause", () => this.FadeIn("big-play-button", [this.bigPlayButton]));

    this.bigPlayButton.style.display = this.video.paused ? null : "none";
    this.bigPlayButton.addEventListener("click", () => this.video.play());

    if(this.playerOptions.controls === EluvioPlayerParameters.controls.OFF) {
      return;
    }

    // Poster
    if(this.posterUrl) {
      this.poster = CreateElement({
        parent: this.target,
        type: "img",
        classes: ["eluvio-player__poster-image"],
        options: {
          src: this.posterUrl,
          alt: "Poster Image"
        }
      });

      this.poster.addEventListener("click", () => this.video.play());
      this.poster.addEventListener("error", () => {
        this.poster.parentNode.removeChild(this.poster);
        this.poster = undefined;
      });
    }

    // Controls container
    const controls = CreateElement({
      parent: this.target,
      type: "div",
      classes: ["eluvio-player__controls"]
    });

    // Play / Pause
    const playPauseButton = CreateImageButton({
      parent: controls,
      svg: this.video.paused ? PlayIcon : PauseIcon,
      classes: ["eluvio-player__controls__button-play", this.video.paused ? "" : "eluvio-player__controls__button-pause"],
      alt: "Play"
    });

    playPauseButton.addEventListener("click", () => this.video.paused ? this.video.play() : this.video.pause());

    // Volume
    const volumeButton = CreateImageButton({
      parent: controls,
      svg: this.video.muted || this.video.volume === 0 ? MutedIcon : (this.video.volume < 0.5 ? VolumeLowIcon : VolumeHighIcon),
      classes: ["eluvio-player__controls__button-volume"],
      alt: this.video.muted ? "Unmute" : "Mute"
    });

    volumeButton.addEventListener("click", () => this.video.muted = !this.video.muted);

    // Volume Slider
    const volumeSlider = CreateElement({
      parent: controls,
      type: "input",
      options: {
        type: "range",
        min: 0,
        step: 0.05,
        max: 1,
        value: this.video.muted ? 0 : this.video.volume
      },
      classes: ["eluvio-player__controls__volume-slider"]
    });

    volumeSlider.addEventListener("input", () => {
      this.video.muted = parseFloat(volumeSlider.value) === 0;
      this.video.volume = parseFloat(volumeSlider.value);
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
        step: 0.01,
        max: 1,
        value: 0
      },
      classes: ["eluvio-player__controls__progress-slider"]
    });

    progressSlider.addEventListener("input", () => this.video.currentTime = this.video.duration * parseFloat(progressSlider.value));

    const totalTime = CreateElement({
      parent: controls,
      type: "div",
      classes: ["eluvio-player__controls__time", "eluvio-player__controls__total-time"]
    });

    totalTime.innerHTML = "00:00";

    // Right buttons container
    this.rightButtonsContainer = CreateElement({
      parent: controls,
      type: "div",
      classes: ["eluvio-player__controls__right-buttons"]
    });

    // Fullscreen
    const fullscreenButton = CreateImageButton({
      parent: this.rightButtonsContainer,
      svg: FullscreenIcon,
      classes: ["eluvio-player__controls__button-fullscreen"],
      alt: "Full Screen"
    });

    fullscreenButton.addEventListener("click", () => ToggleFullscreen(this.target));

    // Settings Menu
    this.settingsMenu = CreateElement({
      parent: this.target,
      type: "div",
      classes: ["eluvio-player__controls__settings-menu", "eluvio-player__controls__settings-menu-hidden"]
    });

    this.target.addEventListener("keydown", event => event && (event.key || "").toLowerCase() === "escape" && this.HideSettingsMenu());

    // Event Listeners

    const Progress = () => {
      if(isNaN(this.video.duration) || !isFinite(this.video.duration)) {
        if(!this.progressHidden) {
          controls.classList.add("eluvio-player__controls-no-progress");
        }

        this.progressHidden = true;
      } else if(this.progressHidden) {
        this.progressHidden = false;
        controls.classList.remove("eluvio-player__controls-no-progress");
      }

      progressSlider.value = isNaN(this.video.duration) ? 0 : this.video.currentTime / this.video.duration;
      progressTime.innerHTML = Time(this.video.currentTime, this.video.duration);
      totalTime.innerHTML = Time(this.video.duration, this.video.duration);
    };

    this.video.addEventListener("durationchange", Progress);

    this.target.addEventListener("dblclick", () => {
      clearTimeout(this.timeouts.playPause);
      ToggleFullscreen(this.target);
    });

    // Prevent double clicking on controls from going fullscreen
    controls.addEventListener("dblclick", event => event.stopPropagation());

    this.video.addEventListener("play", () => {
      this.played = true;

      if(this.poster) {
        this.poster.parentNode.removeChild(this.poster);
        this.poster = undefined;
      }

      playPauseButton.innerHTML = PauseIcon;
      playPauseButton.classList.add("eluvio-player__controls__button-pause");

      clearTimeout(this.timeouts.progress);
      this.timeouts.progress = setInterval(Progress, 50);

      if(this.playerOptions.controls === EluvioPlayerParameters.controls.AUTO_HIDE) {
        this.target.dispatchEvent(new Event("mousemove"));
      }
    });

    this.video.addEventListener("pause", () => {
      playPauseButton.innerHTML = PlayIcon;
      playPauseButton.classList.remove("eluvio-player__controls__button-pause");
      clearTimeout(this.timeouts.progress);
    });

    this.video.addEventListener("volumechange", () => {
      volumeButton.innerHTML = this.video.muted || this.video.volume === 0 ? MutedIcon : (this.video.volume < 0.5 ? VolumeLowIcon : VolumeHighIcon);
      volumeSlider.value = this.video.muted ? 0 : Math.min(1, Math.max(0, this.video.volume));
    });

    this.video.addEventListener("seeked", () => progressSlider.value = this.video.currentTime / this.video.duration);

    this.target.addEventListener("fullscreenchange", () => {
      if(!document.fullscreenElement) {
        fullscreenButton.innerHTML = FullscreenIcon;
      } else if(this.target === document.fullscreenElement) {
        fullscreenButton.innerHTML = ExitFullscreenIcon;
      }
    });

    // Autohide controls
    if(this.playerOptions.controls === EluvioPlayerParameters.controls.AUTO_HIDE) {
      const PlayerOut = () => {
        if(!this.played) { return; }

        this.FadeOut("controls", [controls, this.settingsMenu], 2000);
      };

      const PlayerMove = () => {
        if(this.controlsHover) { return; }

        this.FadeIn("controls", [controls, this.settingsMenu]);
        this.FadeOut("controls", [controls, this.settingsMenu], 3000, () => this.target.style.cursor = "none");

        this.target.style.cursor = "unset";
      };

      const ControlsIn = () => {
        clearTimeout(this.timeouts.controls);
        this.controlsHover = true;
      };

      const ControlsOut = () => this.controlsHover = false;

      // Play / Pause
      this.video.addEventListener("play", () => PlayerMove);
      this.video.addEventListener("pause", () => PlayerMove);

      // Mouse events
      this.target.addEventListener("mousemove", PlayerMove);
      this.target.addEventListener("mouseleave", PlayerOut);
      controls.addEventListener("mouseenter", ControlsIn);
      controls.addEventListener("mouseleave", ControlsOut);
      this.settingsMenu.addEventListener("mouseenter", ControlsIn);
      this.settingsMenu.addEventListener("mouseleave", ControlsOut);

      // Touch events
      this.target.addEventListener("touchmove", PlayerMove);
      this.target.addEventListener("touchleave", PlayerOut);
      controls.addEventListener("touchmove", ControlsIn);
      controls.addEventListener("touchleave", ControlsOut);
      controls.addEventListener("touchend", () => { ControlsOut(); PlayerOut(); });
      this.settingsMenu.addEventListener("touchmove", ControlsIn);
      this.settingsMenu.addEventListener("touchleave", ControlsOut);
      this.settingsMenu.addEventListener("touchend", () => { ControlsOut(); PlayerOut(); });

      // Keyboard events
      this.target.addEventListener("focus", () => { PlayerMove(); ControlsIn(); });
      this.target.addEventListener("blur", () => setTimeout(() => {
        if(!this.target.contains(document.activeElement)) {
          PlayerOut();
          ControlsOut();
        }
      }), 2000);

      window.addEventListener("blur", () => { PlayerOut(); ControlsOut(); });

      Array.from(this.target.querySelectorAll("button, input")).forEach(button => {
        button.addEventListener("focus", () => { PlayerMove(); ControlsIn(); });
      });
    }
  }

  HideSettingsMenu() {
    if(this.settingsMenuContent === "settings") {
      this.settingsButton.focus();
    } else if(this.settingsMenuContent === "multiview") {
      this.multiviewButton.focus();
    }

    this.settingsMenu.innerHTML = "";
    this.settingsMenu.classList.add("eluvio-player__controls__settings-menu-hidden");
    this.settingsMenuContent = "none";
  }

  ToggleSettings() {
    this.settingsMenu.innerHTML = "";

    if(this.settingsMenuContent === "settings") {
      this.HideSettingsMenu();
      return;
    }

    this.settingsMenuContent = "settings";
    this.settingsMenu.classList.remove("eluvio-player__controls__settings-menu-hidden");

    // Resolution settings
    if(this.GetLevels) {
      const levels = this.GetLevels();

      const currentLevel = levels.find(level => level.active);

      if(currentLevel) {
        const resolutionButton = CreateElement({
          parent: this.settingsMenu,
          type: this.SetLevel ? "button" : "div",
          classes: ["eluvio-player__controls__settings-menu__option"]
        });

        resolutionButton.innerHTML = `Resolution: ${currentLevel.resolution}`;

        if(this.SetLevel) {
          resolutionButton.addEventListener("click", () => {
            this.settingsMenu.innerHTML = "";

            const autoLevel = CreateElement({
              parent: this.settingsMenu,
              type: "button",
              classes: ["eluvio-player__controls__settings-menu__option"]
            });

            autoLevel.innerHTML = "Auto";
            autoLevel.addEventListener("click", () => {
              this.SetLevel(-1);
              this.HideSettingsMenu();
            });

            levels
              .sort((a, b) => a.bitrate < b.bitrate ? 1 : -1)
              .forEach(level => {
                const levelOption = CreateElement({
                  parent: this.settingsMenu,
                  type: "button",
                  classes: ["eluvio-player__controls__settings-menu__option", level.active ? "eluvio-player__controls__settings-menu__option-selected" : ""]
                });

                levelOption.innerHTML = `${level.resolution} (${(level.bitrate / 1000 / 1000).toFixed(1)}Mbps)`;

                levelOption.addEventListener("click", () => {
                  this.SetLevel(level.index);
                  this.HideSettingsMenu();
                });
              });

            // Focus on first element in list when menu opened
            const firstItem = this.settingsMenu.querySelector("button");
            if(firstItem) {
              firstItem.focus();
            }
          });
        }
      }
    }

    // Focus on first element in list when menu opened
    const firstItem = this.settingsMenu.querySelector("button");
    if(firstItem) {
      firstItem.focus();
    }
  }

  InitializeSettingsButton() {
    if(this.settingsButton) { return; }

    this.settingsButton = CreateImageButton({
      parent: this.rightButtonsContainer,
      svg: SettingsIcon,
      classes: ["eluvio-player__controls__button-settings"],
      prepend: true,
      alt: "Settings"
    });

    this.settingsButton.addEventListener("click", () => this.ToggleSettings());
  }

  SetQualityControls({GetLevels, SetLevel}) {
    if(
      this.playerOptions.controls === EluvioPlayerParameters.controls.DEFAULT ||
      this.playerOptions.controls === EluvioPlayerParameters.controls.OFF
    ) {
      // Controls disabled
      return;
    }

    this.InitializeSettingsButton();

    this.GetLevels = GetLevels;
    this.SetLevel = SetLevel;
  }

  InitializeMultiViewControls({AvailableViews, SwitchView}) {
    // Fullscreen
    this.multiviewButton = CreateImageButton({
      parent: this.rightButtonsContainer,
      svg: MultiViewIcon,
      classes: ["eluvio-player__controls__button-multiview"],
      prepend: true,
      alt: "Select View"
    });

    this.multiviewButton.addEventListener("click", () => this.ToggleMultiviewControls({AvailableViews, SwitchView}));
  }

  async ToggleMultiviewControls({AvailableViews, SwitchView}={}) {
    this.settingsMenu.innerHTML = "";

    if(this.settingsMenuContent === "multiview") {
      this.HideSettingsMenu();
      return;
    }

    this.settingsMenuContent = "multiview";
    this.settingsMenu.classList.remove("eluvio-player__controls__settings-menu-hidden");

    const views = await AvailableViews();
    views.map(({view, view_display_label, currently_selected, hot_spots}, i) => {
      const selection = CreateElement({
        parent: this.settingsMenu,
        type: "button",
        classes: ["eluvio-player__controls__settings-menu__option", currently_selected ? "eluvio-player__controls__settings-menu__option-selected" : ""]
      });

      selection.innerHTML = view_display_label;

      if(hot_spots) {
        hot_spots = hot_spots.map(spot => ({
          ...spot,
          target: views.find(view => view.view === spot.next_view)
        }));
      }

      selection.addEventListener("click", () => {
        this.HideSettingsMenu();

        if(this.hotspotOverlay) {
          this.hotspotOverlay.parentNode.removeChild(this.hotspotOverlay);
          this.hotspotOverlay = undefined;
        }

        SwitchView(view);

        if(hot_spots) {
          setTimeout(() => this.InitializeMultiviewHotspots(hot_spots, SwitchView), 3000);
        }

        // Make button spin to show something is happening
        clearTimeout(this.timeouts["spin"]);
        this.multiviewButton.classList.add("eluvio-player__controls__button-multiview-spinning");
        this.timeouts["spin"] = setTimeout(() => {
          this.multiviewButton.classList.remove("eluvio-player__controls__button-multiview-spinning");
        }, 3000);
      });

      // Focus on first element in list when menu opened
      if(i === 0) { selection.focus(); }
    });

    // Focus on first element in list when menu opened
    const firstItem = this.settingsMenu.querySelector("button");
    if(firstItem) {
      firstItem.focus();
    }
  }

  InitializeMultiviewHotspots(hotSpots, SwitchView) {
    this.hotspotOverlay = CreateElement({
      parent: this.target,
      type: "div",
      classes: ["eluvio-player__hotspot-overlay"]
    });

    this.HandleResize(this.target.getBoundingClientRect());

    hotSpots.forEach(({top, right, bottom, left, target, next_view}) => {
      const spot = CreateElement({
        parent: this.hotspotOverlay,
        type: "div",
        classes: ["eluvio-player__hotspot-overlay__target"]
      });

      const title = CreateElement({
        parent: spot,
        type: "h2",
        classes: ["eluvio-player__hotspot-overlay__target__title"]
      });

      title.innerHTML = target.view_display_label;

      spot.style.top = `${top * 100}%`;
      spot.style.right = `${(1-right) * 100}%`;
      spot.style.bottom = `${(1-bottom) * 100}%`;
      spot.style.left = `${left * 100}%`;

      spot.addEventListener("click", async () => {
        // On mobile devices, first touch should show the options
        if("ontouchstart" in window && !this.hotspotOverlay.classList.contains("eluvio-player__hotspot-overlay-visible")) {
          this.hotspotOverlay.classList.add("eluvio-player__hotspot-overlay-visible");
          setTimeout(() => this.hotspotOverlay.classList.remove("eluvio-player__hotspot-overlay-visible"), 3000);
          return;
        }

        this.hotspotOverlay.classList.remove("eluvio-player__hotspot-overlay-visible");
        spot.classList.add("eluvio-player__hotspot-overlay__target-switching");
        setTimeout(() => {
          this.hotspotOverlay.parentNode.removeChild(this.hotspotOverlay);
          this.hotspotOverlay = undefined;
        }, 1000);

        await SwitchView(next_view);
      });
    });
  }

  InitializeTicketPrompt(callback) {
    if(this.bigPlayButton) {
      this.bigPlayButton.parentNode.removeChild(this.bigPlayButton);
    }

    const ticketModal = CreateElement({
      parent: this.target,
      type: "div",
      classes: ["eluvio-player__ticket-modal"]
    });

    ticketModal.addEventListener("dblclick", event => event.stopPropagation());

    const form = CreateElement({
      parent: ticketModal,
      type: "form",
      classes: ["eluvio-player__ticket-modal__form"]
    });

    const errorMessage = CreateElement({
      parent: form,
      type: "div",
      classes: ["eluvio-player__ticket-modal__form__error-text", "eluvio-player__ticket-modal__form__text"]
    });

    const text = CreateElement({
      parent: form,
      type: "div",
      classes: ["eluvio-player__ticket-modal__form__text"]
    });

    text.innerHTML = "Enter your code";

    const input = CreateElement({
      parent: form,
      type: "input",
      classes: ["eluvio-player__ticket-modal__form__input"]
    });

    const submit = CreateElement({
      parent: form,
      type: "button",
      classes: ["eluvio-player__ticket-modal__form__submit"]
    });

    input.focus();

    submit.innerHTML = "Submit";

    submit.addEventListener("click", async event => {
      try {
        submit.setAttribute("disabled", true);
        event.preventDefault();
        errorMessage.innerHTML = "";

        await callback(input.value);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("ELUVIO PLAYER: Invalid Code");
        // eslint-disable-next-line no-console
        console.error(error);

        errorMessage.innerHTML = "Invalid Code";
        submit.removeAttribute("disabled");
      }
    });
  }

  HandleResize({width, height}) {
    const ratio = width / height;
    const targetRatio = 16 / 9;

    if(this.hotspotOverlay) {
      let top = 0, right = 0, bottom = 0, left = 0;
      if(Math.abs(ratio - targetRatio) > 0.05) {
        if(ratio < 16 / 9) {
          // Taller
          const heightDiff = Math.floor((height - (width * 9 / 16)) / 2);
          top = heightDiff;
          bottom = heightDiff;
        } else if(ratio > 16 / 9) {
          // Wider
          const widthDiff = Math.floor((width - (height * 16 / 9)) / 2);
          left = widthDiff;
          right = widthDiff;
        }
      }

      this.hotspotOverlay.style.top = `${top}px`;
      this.hotspotOverlay.style.right = `${right}px`;
      this.hotspotOverlay.style.bottom = `${bottom}px`;
      this.hotspotOverlay.style.left = `${left}px`;
    }
  }
}

export default PlayerControls;
