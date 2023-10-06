import "./static/stylesheets/player.scss";

import "focus-visible";

import MergeWith from "lodash/mergeWith";
import Clone from "lodash/cloneDeep";

import URI from "urijs";
import ResizeObserver from "resize-observer-polyfill";

import {InitializeFairPlayStream} from "./FairPlay";
import PlayerControls, {CreateElement, InitializeTicketPrompt, PlayPause} from "./PlayerControls";

import {Utils} from "@eluvio/elv-client-js";

export const EluvioPlayerParameters = {
  networks: {
    MAIN: "https://main.net955305.contentfabric.io/config",
    DEMO: "https://demov3.net955210.contentfabric.io/config",
    TEST: "https://test.net955203.contentfabric.io/config",
    TESTV4: "https://test.net955205.contentfabric.io/config"
  },
  playerProfile: {
    DEFAULT: "default",
    LOW_LATENCY: "low_latency"
  },
  drms: {
    FAIRPLAY: "fairplay",
    SAMPLE_AES: "sample-aes",
    AES128: "aes-128",
    WIDEVINE: "widevine",
    CLEAR: "clear"
  },
  protocols: {
    HLS: "hls",
    DASH: "dash"
  },
  autoplay: {
    OFF: false,
    WHEN_VISIBLE: "when visible",
    ON: true
  },
  controls: {
    OFF: false,
    OFF_WITH_VOLUME_TOGGLE: "off_with_volume_toggle",
    AUTO_HIDE: "autohide",
    ON: true,
    DEFAULT: "default"
  },
  loop: {
    OFF: false,
    ON: true
  },
  muted: {
    OFF: false,
    WHEN_NOT_VISIBLE: "when_not_visible",
    OFF_IF_POSSIBLE: "off_if_possible",
    ON: true
  },
  watermark: {
    OFF: false,
    ON: true
  },
  accountWatermark: {
    OFF: false,
    ON: true
  },
  capLevelToPlayerSize: {
    OFF: false,
    ON: true
  }
};

const DefaultParameters = {
  clientOptions: {
    network: EluvioPlayerParameters.networks.MAIN,
    client: undefined,
    staticToken: undefined,
    tenantId: undefined,
    ntpId: undefined,
    promptTicket: false,
    ticketCode: undefined,
    ticketSubject: undefined
  },
  sourceOptions: {
    protocols: [
      EluvioPlayerParameters.protocols.HLS,
      EluvioPlayerParameters.protocols.DASH
    ],
    drms: [
      EluvioPlayerParameters.drms.FAIRPLAY,
      EluvioPlayerParameters.drms.SAMPLE_AES,
      EluvioPlayerParameters.drms.AES128,
      EluvioPlayerParameters.drms.WIDEVINE,
      EluvioPlayerParameters.drms.CLEAR,
    ],
    playoutOptions: undefined,
    playoutParameters: {
      objectId: undefined,
      versionHash: undefined,
      writeToken: undefined,
      linkPath: undefined,
      signedLink: false,
      handler: "playout",
      offering: "default",
      playoutType: undefined,
      context: undefined,
      hlsjsProfile: true,
      authorizationToken: undefined,
      clipStart: undefined,
      clipEnd: undefined
    }
  },
  playerOptions: {
    controls: EluvioPlayerParameters.controls.AUTO_HIDE,
    autoplay: EluvioPlayerParameters.autoplay.OFF,
    muted: EluvioPlayerParameters.muted.OFF,
    loop: EluvioPlayerParameters.loop.OFF,
    watermark: EluvioPlayerParameters.watermark.ON,
    capLevelToPlayerSize: EluvioPlayerParameters.capLevelToPlayerSize.OFF,
    posterUrl: undefined,
    className: undefined,
    controlsClassName: undefined,
    playerProfile: EluvioPlayerParameters.playerProfile.DEFAULT,
    hlsjsOptions: undefined,
    dashjsOptions: undefined,
    // eslint-disable-next-line no-unused-vars
    playerCallback: ({player, videoElement, hlsPlayer, dashPlayer, posterUrl}) => {},
    // eslint-disable-next-line no-unused-vars
    errorCallback: (error, player) => {
      // eslint-disable-next-line no-console
      console.error("ELUVIO PLAYER: Error");
      // eslint-disable-next-line no-console
      console.error(error);
    },
    // eslint-disable-next-line no-unused-vars
    restartCallback: async (error) => {}
  }
};

const PlayerProfiles = {
  default: {
    label: "Default",
    hlsSettings: {},
  },
  low_latency: {
    label: "Low Latency",
    hlsSettings: Utils.LiveHLSJSSettings({lowLatency: true})
  }
};

export class EluvioPlayer {
  constructor(target, parameters) {
    this.warnings = false;
    this.reloads = [];

    this.DetectRemoval = this.DetectRemoval.bind(this);

    this.Initialize(target, parameters);

    window.EluvioPlayer = this;
  }

  Log(message, error=false) {
    if(error) {
      // eslint-disable-next-line no-console
      console.error("ELUVIO PLAYER:", message);
    } else {
      if(this.warnings) {
        // eslint-disable-next-line no-console
        //console.warn("ELUVIO PLAYER:", message);
      }
    }
  }

  Destroy() {
    this.__destroyed = true;

    if(this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    if(this.resizeObserver) {
      this.resizeObserver.unobserve(this.target);
    }

    this.__DestroyPlayer();
    this.target.innerHTML = "";
  }

  RegisterVisibilityCallback() {
    if(
      this.playerOptions.autoplay !== EluvioPlayerParameters.autoplay.WHEN_VISIBLE &&
      this.playerOptions.muted !== EluvioPlayerParameters.muted.WHEN_NOT_VISIBLE
    ) {
      // Nothing to watch
      return;
    }

    let lastPlayPauseAction, lastMuteAction;
    const Callback = async ([bodyElement]) => {
      // Play / pause when entering / leaving viewport
      if(this.playerOptions.autoplay === EluvioPlayerParameters.autoplay.WHEN_VISIBLE) {
        if(lastPlayPauseAction !== "play" && bodyElement.isIntersecting && this.video.paused) {
          PlayPause(this.video, true);
          lastPlayPauseAction = "play";
        } else if(lastPlayPauseAction !== "pause" && !bodyElement.isIntersecting && !this.video.paused) {
          PlayPause(this.video, false);
          lastPlayPauseAction = "pause";
        }
      }

      // Mute / unmute when entering / leaving viewport
      if(this.playerOptions.muted === EluvioPlayerParameters.muted.WHEN_NOT_VISIBLE) {
        if(lastMuteAction !== "unmute" && bodyElement.isIntersecting && this.video.muted) {
          this.video.muted = false;
          lastMuteAction = "unmute";
        } else if(lastMuteAction !== "mute" && !bodyElement.isIntersecting && !this.video.muted) {
          this.video.muted = true;
          lastMuteAction = "mute";
        }
      }
    };

    new window.IntersectionObserver(Callback, { threshold: 0.1 }).observe(this.video);
  }

  async Client() {
    if(this.clientPromise) {
      await this.clientPromise;
    }

    // Always initialize new client if ticket is used
    if(!this.clientOptions.client) {
      this.clientPromise = new Promise(async resolve => {
        const {ElvClient} = await import("@eluvio/elv-client-js");
        this.clientOptions.client = await ElvClient.FromConfigurationUrl({
          configUrl: this.clientOptions.network
        });

        this.clientOptions.client.SetStaticToken({
          token:
            this.clientOptions.staticToken ||
            this.clientOptions.client.utils.B64(JSON.stringify({qspace_id: await this.clientOptions.client.ContentSpaceId()}))
        });

        resolve(this.clientOptions.client);
      });

      await this.clientPromise;
    }

    return this.clientOptions.client;
  }

  async RedeemCode(code) {
    if(!this.clientOptions.tenantId) { throw Error("ELUVIO PLAYER: Tenant ID must be provided if ticket code is specified."); }

    code = code || this.clientOptions.ticketCode;
    let subject = this.clientOptions.ticketSubject;
    if(code.includes(":")) {
      subject = code.split(":")[0];
      code = code.split(":")[1];
    }

    await (await this.Client()).RedeemCode({
      tenantId: this.clientOptions.tenantId,
      ntpId: this.clientOptions.ntpId,
      code,
      email: subject
    });

    this.ticketInitialized = true;
    this.clientOptions.ticketCode = code;
    this.originalParameters.clientOptions.ticketCode = code;
  }

  async PosterUrl() {
    if(typeof this.playerOptions.posterUrl !== "undefined") {
      return this.playerOptions.posterUrl;
    }

    const client = await this.Client();

    try {
      const targetHash =
        this.sourceOptions.playoutParameters.linkPath ?
          await client.LinkTarget({...this.sourceOptions.playoutParameters}) :
          this.sourceOptions.playoutParameters.versionHash ||
          await client.LatestVersionHash({objectId: this.sourceOptions.playoutParameters.objectId});

      if(targetHash) {
        const imageMetadata = await client.ContentObjectMetadata({
          versionHash: targetHash,
          metadataSubtree: "public",
          authorizationToken: this.sourceOptions.playoutParameters.authorizationToken,
          select: [
            "display_image",
            "asset_metadata/nft/image"
          ]
        });

        if(imageMetadata && imageMetadata.asset_metadata && imageMetadata.asset_metadata.nft && imageMetadata.asset_metadata.nft.image) {
          return imageMetadata.asset_metadata.nft.image;
        } else if(imageMetadata && imageMetadata.display_image) {
          return await client.ContentObjectImageUrl({versionHash: targetHash});
        }
      }
    // eslint-disable-next-line no-empty
    } catch (error) {}
  }

  async PlayoutOptions() {
    const client = await this.Client();

    let offeringURI, options = {};
    if(this.sourceOptions.playoutParameters.clipStart || this.sourceOptions.playoutParameters.clipEnd) {
      options.clip_start = parseFloat(this.sourceOptions.playoutParameters.clipStart || 0);

      if(this.sourceOptions.playoutParameters.clipEnd) {
        options.clip_end = parseFloat(this.sourceOptions.playoutParameters.clipEnd);
      }
    }

    options.ignore_trimming = this.sourceOptions.playoutParameters.ignoreTrimming;
    options.resolve = this.sourceOptions.playoutParameters.resolve;

    if(this.sourceOptions.playoutParameters.directLink) {
      const availableOfferings = await client.AvailableOfferings({
        objectId: this.sourceOptions.playoutParameters.objectId,
        versionHash: this.sourceOptions.playoutParameters.versionHash,
        writeToken: this.sourceOptions.playoutParameters.writeToken,
        linkPath: this.sourceOptions.playoutParameters.linkPath,
        directLink: true,
        resolveIncludeSource: true,
        authorizationToken: this.sourceOptions.playoutParameters.authorizationToken
      });

      const offeringId = Object.keys(availableOfferings || {})[0];

      if(!offeringId) { return; }

      offeringURI = availableOfferings[offeringId].uri;

      if(!this.sourceOptions.playoutOptions) {
        this.sourceOptions.playoutOptions = await client.PlayoutOptions({
          offeringURI,
          options
        });
      }
    } else {
      if(!this.sourceOptions.playoutOptions) {
        this.sourceOptions.playoutOptions = await client.PlayoutOptions({
          ...this.sourceOptions.playoutParameters,
          options
        });
      }
    }

    let availableDRMs = (await client.AvailableDRMs()).filter(drm => (this.sourceOptions.drms || []).includes(drm));
    let availableProtocols = this.sourceOptions.protocols;

    let protocol, drm;
    while(!(protocol && drm)) {
      protocol = availableProtocols.find(protocol => this.sourceOptions.playoutOptions[protocol]);
      drm = this.sourceOptions.drms.find(drm => availableDRMs.includes(drm) && this.sourceOptions.playoutOptions[protocol].playoutMethods[drm]);

      if(!drm) {
        availableProtocols = availableProtocols.filter(p => p !== protocol);

        if(availableProtocols.length === 0) {
          throw Error("No valid protocol / DRM combination available");
        }
      }
    }

    const { playoutUrl, drms } = this.sourceOptions.playoutOptions[protocol].playoutMethods[drm];

    return {
      protocol,
      drm,
      playoutUrl,
      drms,
      availableDRMs,
      offeringURI,
      sessionId: this.sourceOptions.playoutOptions.sessionId,
      multiviewOptions: {
        enabled: this.sourceOptions.playoutOptions.multiview,
        AvailableViews: this.sourceOptions.playoutOptions.AvailableViews,
        SwitchView: this.sourceOptions.playoutOptions.SwitchView
      }
    };
  }

  __DestroyPlayer() {
    if(!this.player) { return; }

    this.Log("Destroying player");

    if(this.video) {
      PlayPause(this.video, false);
    }

    if(this.player.destroy) {
      this.player.destroy();
    } else if(this.player.reset) {
      this.player.reset();
    }

    this.player = undefined;
  }

  DetectRemoval() {
    this.mutationTimeout = undefined;
    if(!Array.from(document.querySelectorAll(".eluvio-player__video")).find(video => video === this.video)) {
      this.Destroy();
    }
  }

  async HardReload(error, delay=6000) {
    if(this.reloading) { return; }

    this.reloading = true;

    /*
    if(this.reloads.filter(reload => Date.now() - reload < 60 * 1000).length > 3) {
      this.Log("Too many reloads, destroying player", true);
      this.Destroy();
      return;
    }

    this.reloads.push(Date.now());

     */
    try {
      if(error && this.playerOptions.restartCallback) {
        try {
          const abort = await this.playerOptions.restartCallback(error);

          if(abort && typeof abort === "boolean") {
            this.Destroy();
            return;
          }
        } catch (error) {
          this.Log("Restart callback failed:");
          this.Log(error);
        }
      }

      await new Promise(resolve => setTimeout(resolve, delay));

      if(this.__destroyed) { return; }

      this.Log("Reloading stream");

      // Recall config to get new nodes
      const client = await this.Client();
      if(client) {
        await client.ResetRegion();
      }

      this.restarted = true;
      this.Initialize(
        this.target,
        this.originalParameters,
        !this.video ? null :
          {
            muted: this.video.muted,
            volume: this.video.volume,
            currentTime: this.video.currentTime,
            playing: !this.video.paused
          }
      );
    } finally {
      this.reloading = false;
    }
  }

  async Initialize(target, parameters, restartParameters) {
    if(this.__destroyed) { return; }

    this.__DestroyPlayer();

    this.target = target;

    // Clear target
    this.target.innerHTML = "";

    if(parameters) {
      this.originalParameters = MergeWith({}, parameters);

      parameters = MergeWith(
        Clone(DefaultParameters),
        parameters
      );

      this.clientOptions = parameters.clientOptions;
      this.sourceOptions = parameters.sourceOptions;
      this.playerOptions = parameters.playerOptions;

      // If ticket redemption required, ensure new client is used unless specified
      if(
        this.clientOptions.promptTicket &&
        !this.ticketInitialized &&
        !this.clientOptions.allowClientTicketRedemption
      ) {
        this.clientOptions.client = undefined;
      }
    }

    this.errors = 0;


    this.target.classList.add("eluvio-player");

    // Start client loading
    this.Client();

    if(this.clientOptions.promptTicket && !this.ticketInitialized) {
      if(!this.clientOptions.tenantId) {
        throw Error("ELUVIO PLAYER: Tenant ID must be provided if ticket code is needed.");
      }

      if(this.clientOptions.ticketCode) {
        await this.RedeemCode(this.clientOptions.ticketCode);
      } else {
        InitializeTicketPrompt(this.target, async code => {
          await this.RedeemCode(code);

          this.Initialize(target, parameters);
        });

        return;
      }
    }

    try {
      const playoutOptionsPromise = this.PlayoutOptions();

      this.target.classList.add("eluvio-player");

      if(this.restarted) {
        // Prevent big play button from flashing on restart
        this.target.classList.add("eluvio-player-restarted");
      }

      if(this.playerOptions.controls === EluvioPlayerParameters.controls.AUTO_HIDE) {
        this.target.classList.add("eluvio-player-autohide");
      }

      if(this.playerOptions.className) {
        this.target.classList.add(this.playerOptions.className);
      }

      this.video = CreateElement({
        parent: this.target,
        type: "video",
        options: {
          muted: [EluvioPlayerParameters.muted.ON, EluvioPlayerParameters.muted.WHEN_NOT_VISIBLE].includes(this.playerOptions.muted),
          controls: this.playerOptions.controls === EluvioPlayerParameters.controls.DEFAULT,
          loop: this.playerOptions.loop === EluvioPlayerParameters.loop.ON
        },
        classes: ["eluvio-player__video"]
      });

      this.video.setAttribute("playsinline", "playsinline");

      this.controls = new PlayerControls({
        player: this,
        target: this.target,
        video: this.video,
        playerOptions: this.playerOptions,
        className: this.playerOptions.controlsClassName
      });

      if(restartParameters) {
        this.video.addEventListener("loadedmetadata", async () => {
          this.video.volume = restartParameters.volume;
          this.video.muted = restartParameters.muted;
          this.video.currentTime = restartParameters.currentTime;

          if(restartParameters.playing) {
            PlayPause(this.video, true);
          }
        });
      }

      // Detect live video
      this.video.addEventListener("durationchange", () => {
        if(this.videoDuration > 0 && this.video.duration !== this.videoDuration) {
          this.isLive = true;
        }

        this.videoDuration = this.video.duration;
      });

      // Detect removal of video to ensure player is properly destroyed
      this.mutationObserver = new MutationObserver(() => {
        if(this.mutationTimeout) { return; }

        this.mutationTimeout = setTimeout(this.DetectRemoval, 2000);
      });
      this.mutationObserver.observe(document.body, {childList: true, subtree: true});

      this.resizeObserver = new ResizeObserver(entries => {
        if(this.__destroyed) {
          return;
        }

        const dimensions = entries[0].contentRect;

        if(this.controls) {
          this.controls.HandleResize(dimensions);
        }

        const sizes = ["xl", "l", "m", "s"];
        sizes.forEach(size => this.target.classList.remove(`eluvio-player-${size}`));

        // Use actual player size instead of media queries
        if(dimensions.width > 1400) {
          this.target.classList.add("eluvio-player-xl");
        } else if(dimensions.width > 750) {
          this.target.classList.add("eluvio-player-l");
        } else if(dimensions.width > 500) {
          this.target.classList.add("eluvio-player-m");
        } else {
          this.target.classList.add("eluvio-player-s");
        }

        if(dimensions.width > dimensions.height) {
          this.target.classList.add("eluvio-player-landscape");
          this.target.classList.remove("eluvio-player-portrait");
        } else {
          this.target.classList.add("eluvio-player-portrait");
          this.target.classList.remove("eluvio-player-landscape");
        }
      });
      this.resizeObserver.observe(this.target);

      let { protocol, drm, playoutUrl, drms, multiviewOptions } = await playoutOptionsPromise;

      this.PosterUrl().then(posterUrl => this.controls.SetPosterUrl(posterUrl));

      multiviewOptions.target = this.target;

      playoutUrl = URI(playoutUrl);
      const authorizationToken =
        this.sourceOptions.playoutParameters.authorizationToken ||
        playoutUrl.query(true).authorization;

      if(protocol === "hls") {
        await this.InitializeHLS({playoutUrl, authorizationToken, drm, drms, multiviewOptions});
      } else {
        await this.InitializeDash({playoutUrl, authorizationToken, drm, drms, multiviewOptions});
      }

      if(this.playerOptions.playerCallback) {
        this.playerOptions.playerCallback({
          player: this,
          videoElement: this.video,
          hlsPlayer: this.hlsPlayer,
          dashPlayer: this.dashPlayer,
          posterUrl: this.posterUrl
        });
      }

      if(this.playerOptions.autoplay === EluvioPlayerParameters.autoplay.ON) {
        PlayPause(this.video, true);

        setTimeout(async () => {
          if(this.playerOptions.muted === EluvioPlayerParameters.muted.OFF_IF_POSSIBLE && this.video.paused && !this.video.muted) {
            this.video.muted = true;
            PlayPause(this.video, true);
          }
        }, 250);
      }

      this.RegisterVisibilityCallback();

      if(this.controls && this.playerOptions.accountWatermark) {
        // Watermark
        this.controls.InitializeAccountWatermark(
          (await this.Client()).CurrentAccountAddress()
        );
      }

      if(this.__destroyed) {
        // If Destroy was called during the initialization process, ensure that the player is properly destroyed
        this.Destroy();
      }
    } catch (error) {
      // If playout failed due to a permission issue, check the content to see if there is a message to display
      let permissionErrorMessage;
      if(error && [401, 403].includes(error.status) || [401, 403].includes(error.code)) {
        try {
          const client = await this.Client();

          const targetHash =
            this.sourceOptions.playoutParameters.linkPath ?
              await client.LinkTarget({...this.sourceOptions.playoutParameters}) :
              this.sourceOptions.playoutParameters.versionHash ||
              await client.LatestVersionHash({objectId: this.sourceOptions.playoutParameters.objectId});

          permissionErrorMessage = await client.ContentObjectMetadata({
            versionHash: targetHash,
            metadataSubtree: "public/asset_metadata/permission_message",
            authorizationToken: this.sourceOptions.playoutParameters.authorizationToken
          });

          if(permissionErrorMessage) {
            error.permission_message = permissionErrorMessage;
            const errorMessage = CreateElement({
              parent: this.target,
              classes: ["eluvio-player__error-message"]
            });

            CreateElement({
              parent: errorMessage,
              classes: ["eluvio-player__error-message__text"]
            }).innerHTML = permissionErrorMessage;

            this.target.classList.add("eluvio-player--error");
          }
        // eslint-disable-next-line no-empty
        } catch (error) {}
      }

      error.permission_message = permissionErrorMessage;
      if(this.playerOptions.errorCallback) {
        this.playerOptions.errorCallback(error, this);
      }

      if(error.status === 500) {
        this.HardReload(error, 10000);
      }
    }
  }

  async InitializeHLS({playoutUrl, authorizationToken, drm, multiviewOptions}) {
    const HLSPlayer = (await import("hls.js")).default;

    if(["fairplay", "sample-aes"].includes(drm) || !HLSPlayer.isSupported()) {
      // HLS JS NOT SUPPORTED - Handle native player

      if(drm === "fairplay") {
        InitializeFairPlayStream({playoutOptions: this.sourceOptions.playoutOptions, video: this.video});
      } else {
        this.video.src = playoutUrl.toString();
      }

      if(multiviewOptions.enabled) {
        const Switch = multiviewOptions.SwitchView;

        multiviewOptions.SwitchView = async (view) => {
          await Switch(view);
        };

        if(this.controls) {
          this.controls.InitializeMultiViewControls(multiviewOptions);
        }
      }

      const UpdateAudioTracks = () => {
        if(!this.video.audioTracks || this.video.audioTracks.length <= 1) { return; }

        this.controls.SetAudioTrackControls({
          GetAudioTracks: () => {
            const tracks = Array.from(this.video.audioTracks).map(track => ({
              index: track.id,
              label: track.label || track.language,
              active: track.enabled,
              activeLabel: `Audio: ${track.label || track.language}`
            }));

            return {label: "Audio Track", options: tracks};
          },
          SetAudioTrack: index => {
            Array.from(this.video.audioTracks).forEach(track =>
              track.enabled = index.toString() === track.id
            );
          }
        });
      };

      // Set up audio and subtitle tracks
      if(this.controls) {
        if(this.video.textTracks) {
          this.video.textTracks.addEventListener("addtrack", this.UpdateTextTracks());
          this.video.textTracks.addEventListener("removetrack", this.UpdateTextTracks());
        }

        if(this.video.audioTracks) {
          this.video.audioTracks.addEventListener("addtrack", UpdateAudioTracks);
          this.video.audioTracks.addEventListener("removetrack", UpdateAudioTracks);
        }
      }
    } else {
      // HLS JS
      playoutUrl.removeQuery("authorization");

      const profileSettings = (PlayerProfiles[this.playerOptions.playerProfile] || {}).hlsSettings || {};

      const hlsPlayer = new HLSPlayer({
        xhrSetup: xhr => {
          xhr.setRequestHeader("Authorization", `Bearer ${authorizationToken}`);

          if((this.playerOptions.hlsjsOptions || {}).xhrSetup) {
            this.playerOptions.hlsjsOptions.xhrSetup(xhr);
          }

          return xhr;
        },
        capLevelToPlayerSize: this.playerOptions.capLevelToPlayerSize,
        ...profileSettings,
        ...(this.playerOptions.hlsjsOptions || {})
      });
      hlsPlayer.loadSource(playoutUrl.toString());
      hlsPlayer.attachMedia(this.video);

      if(this.controls && multiviewOptions.enabled) {
        const Switch = multiviewOptions.SwitchView;

        multiviewOptions.SwitchView = async (view) => {
          await Switch(view);
          hlsPlayer.nextLevel = hlsPlayer.currentLevel;
        };

        this.controls.InitializeMultiViewControls(multiviewOptions);
      }

      if(this.controls) {
        const UpdateQualityOptions = () => {
          try {
            this.controls.SetQualityControls({
              GetLevels: () => {
                let levels = hlsPlayer.levels
                  .map((level, index) => ({
                    index,
                    active: hlsPlayer.currentLevel === index,
                    resolution: level.attrs.RESOLUTION,
                    bitrate: level.bitrate,
                    audioTrack: !level.videoCodec,
                    label:
                      level.audioTrack ?
                        `${level.bitrate / 1000}kbps` :
                        `${level.attrs.RESOLUTION} (${(level.bitrate / 1000 / 1000).toFixed(1)}Mbps)`,
                    activeLabel:
                      level.audioTrack ?
                        `Quality: ${level.bitrate / 1000}kbps` :
                        `Quality: ${level.attrs.RESOLUTION}`
                  }))
                  .sort((a, b) => a.bitrate < b.bitrate ? 1 : -1);

                levels.unshift({index: -1, label: "Auto"});

                return {label: "Quality", options: levels};
              },
              SetLevel: levelIndex => {
                hlsPlayer.nextLevel = levelIndex;
                hlsPlayer.streamController.immediateLevelSwitch();
              }
            });
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error("ELUVIO PLAYER:", error);
          }
        };

        hlsPlayer.on(HLSPlayer.Events.SUBTITLE_TRACKS_UPDATED, () => this.UpdateTextTracks());
        hlsPlayer.on(HLSPlayer.Events.LEVEL_LOADED, () => UpdateQualityOptions());
        hlsPlayer.on(HLSPlayer.Events.LEVEL_SWITCHED, () => UpdateQualityOptions());
        hlsPlayer.on(HLSPlayer.Events.SUBTITLE_TRACK_SWITCH, () => this.UpdateTextTracks());
        hlsPlayer.on(HLSPlayer.Events.AUDIO_TRACKS_UPDATED, () => {
          this.controls.SetAudioTrackControls({
            GetAudioTracks: () => {
              const tracks = hlsPlayer.audioTracks.map(track => ({
                index: track.id,
                label: track.name,
                active: track.id === hlsPlayer.audioTrack,
                activeLabel: `Audio: ${track.name}`
              }));

              return {label: "Audio Track", options: tracks};
            },
            SetAudioTrack: index => {
              hlsPlayer.audioTrack = index;
              hlsPlayer.streamController.immediateLevelSwitch();
            }
          });
        });

        this.controls.SetPlayerProfileControls({
          GetProfile: () => ({
            label: "Player Profile",
            options: Object.keys(PlayerProfiles).map(key => ({
              index: key,
              label: PlayerProfiles[key].label,
              active: this.playerOptions.playerProfile === key,
              activeLabel: `Player Profile: ${PlayerProfiles[key].label}`
            }))
          }),
          SetProfile: async key => {
            this.playerOptions.playerProfile = key;

            const playing = !this.video.paused;
            const currentTime = this.video.currentTime;

            this.hlsPlayer.destroy();
            await this.InitializeHLS({
              playoutUrl,
              authorizationToken,
              drm,
              multiviewOptions
            });

            PlayPause(this.video, playing);

            if(!this.isLive) {
              this.video.currentTime = currentTime;
            }
          }
        });
      }

      hlsPlayer.on(HLSPlayer.Events.FRAG_LOADED, () => {
        this.errors = 0;
        clearTimeout(this.bufferFullRestartTimeout);
      });

      hlsPlayer.on(HLSPlayer.Events.ERROR, async (event, error) => {
        this.errors += 1;

        this.Log(`Encountered ${error.details}`);
        this.Log(error);

        if(error.details === "bufferFullError") {
          this.bufferFullRestartTimeout = setTimeout(() => {
            this.Log("Buffer full error - Restarting player", true);
            this.HardReload(error, 5000);
          }, 3000);
        }

        if(error.details === "bufferStalledError") {
          const stallTime = this.video.currentTime;

          setTimeout(() => {
            if(!this.video.paused && this.video.currentTime === stallTime) {
              this.Log("Buffer stalled error, no progress in 5 seconds - Restarting player", true);
            }
          }, 5000);
        }

        if(error.fatal || this.errors === 3) {
          if(error.response.code === 403) {
            // Not allowed to access
            this.Destroy();
          } else {
            this.HardReload(error);
          }
        }
      });

      this.hlsPlayer = hlsPlayer;
      this.player = hlsPlayer;
    }
  }

  async InitializeDash({playoutUrl, authorizationToken, drm, drms, multiviewOptions}) {
    const DashPlayer = (await import("dashjs")).default;
    const dashPlayer = DashPlayer.MediaPlayer().create();

    dashPlayer.updateSettings({
      "streaming": {
        "buffer": {
          "fastSwitchEnabled": true
        },
        "text": {
          "defaultEnabled": false
        }
      },
      "text": {
        "defaultEnabled": false
      }
    });

    if(this.playerOptions.capLevelToPlayerSize) {
      dashPlayer.updateSettings({
        "streaming": {
          "abr": {
            "limitBitrateByPortal": true
          }
        }
      });
    }

    playoutUrl.removeQuery("authorization");
    dashPlayer.extend("RequestModifier", function () {
      return {
        modifyRequestHeader: xhr => {
          xhr.setRequestHeader("Authorization", `Bearer ${authorizationToken}`);

          return xhr;
        },
        modifyRequestURL: url => url
      };
    });

    // Widevine
    if(drm === EluvioPlayerParameters.drms.WIDEVINE) {
      const widevineUrl = drms.widevine.licenseServers[0];

      dashPlayer.setProtectionData({
        "com.widevine.alpha": {
          "serverURL": widevineUrl
        }
      });
    }

    dashPlayer.initialize(
      this.video,
      playoutUrl.toString(),
      this.playerOptions.autoplay === EluvioPlayerParameters.autoplay.ON
    );

    if(this.controls && multiviewOptions.enabled) {
      this.controls.InitializeMultiViewControls(multiviewOptions);
    }

    const UpdateQualityOptions = () => {
      try {
        this.controls.SetQualityControls({
          GetLevels: () => {
            let levels = dashPlayer.getBitrateInfoListFor("video")
              .map((level) => ({
                index: level.qualityIndex,
                active: level.qualityIndex === this.player.getQualityFor("video"),
                resolution: `${level.width}x${level.height}`,
                bitrate: level.bitrate,
                label: `${level.width}x${level.height} (${(level.bitrate / 1000 / 1000).toFixed(1)}Mbps)`,
                activeLabel: `Quality: ${level.width}x${level.height}`,
              }))
              .sort((a, b) => a.bitrate < b.bitrate ? 1 : -1);

            levels.unshift({index: -1, label: "Auto"});

            return { label: "Quality", options: levels };
          },
          SetLevel: levelIndex => {
            dashPlayer.setQualityFor("video", levelIndex);
            dashPlayer.updateSettings({
              streaming: {
                trackSwitchMode: "alwaysReplace",
                fastSwitchEnabled: true,
                abr: {
                  autoSwitchBitrate: {
                    video: levelIndex === -1
                  }
                }
              }
            });
          }
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("ELUVIO PLAYER:", error);
      }
    };

    const UpdateAudioTracks = () => {
      this.controls.SetAudioTrackControls({
        GetAudioTracks: () => {
          const tracks = this.player.getTracksFor("audio").map(track => ({
            index: track.index,
            label: track.labels && track.labels.length > 0 ? track.labels[0].text : track.lang,
            active: track.index === dashPlayer.getCurrentTrackFor("audio").index,
            activeLabel: `Audio: ${track.labels && track.labels.length > 0 ? track.labels[0].text : track.lang}`
          }));

          return { label: "Audio Track", options: tracks };
        },
        SetAudioTrack: index => {
          const track = dashPlayer.getTracksFor("audio").find(track => track.index === index);
          dashPlayer.setCurrentTrack(track);
        }
      });
    };

    dashPlayer.on(DashPlayer.MediaPlayer.events.QUALITY_CHANGE_RENDERED, () => UpdateQualityOptions());
    dashPlayer.on(DashPlayer.MediaPlayer.events.TRACK_CHANGE_RENDERED, () => {
      UpdateAudioTracks();
      this.UpdateTextTracks({dashPlayer});
    });
    dashPlayer.on(DashPlayer.MediaPlayer.events.MANIFEST_LOADED, () => {
      UpdateQualityOptions();
      UpdateAudioTracks();
      this.UpdateTextTracks({dashPlayer});
    });

    this.player = dashPlayer;
    this.dashPlayer = dashPlayer;
  }

  UpdateTextTracks({dashPlayer}={}) {
    this.controls.SetTextTrackControls({
      GetTextTracks: () => {
        const activeTrackIndex = dashPlayer ?
          dashPlayer.getCurrentTextTrackIndex() :
          Array.from(this.video.textTracks).findIndex(track => track.mode === "showing");

        let tracks;
        if(dashPlayer) {
          tracks = dashPlayer.getTracksFor("text").map((track, index) => ({
            index,
            label: track.labels && track.labels.length > 0 ? track.labels[0].text : track.lang,
            active: index === activeTrackIndex,
            activeLabel: `Subtitles: ${track.labels && track.labels.length > 0 ? track.labels[0].text : track.lang}`
          }));
        } else {
          tracks = Array.from(this.video.textTracks).map((track, index) => ({
            index,
            label: track.label || track.language,
            active: track.mode === "showing",
            activeLabel: `Subtitles: ${track.label || track.language}`
          }));
        }

        tracks.unshift({
          index: -1,
          label: "Disabled",
          active: activeTrackIndex < 0,
          activeLabel: "Subtitles: Disabled"
        });

        return { label: "Subtitles", options: tracks };
      },
      SetTextTrack: index => {
        if(dashPlayer) {
          dashPlayer.setTextTrack(parseInt(index));
        } else {
          const tracks = Array.from(this.video.textTracks);
          tracks.map(track => track.mode = "disabled");

          if(index >= 0) {
            tracks[index].mode = "showing";
          }
        }
      }
    });
  }
}

export default EluvioPlayer;

