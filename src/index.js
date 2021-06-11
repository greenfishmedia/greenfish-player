import "./static/stylesheets/player.scss";

import "focus-visible";

import MergeWith from "lodash/mergeWith";
import Clone from "lodash/cloneDeep";

import URI from "urijs";
import ResizeObserver from "resize-observer-polyfill";

import {InitializeFairPlayStream} from "./FairPlay";
import PlayerControls, {CreateElement} from "./PlayerControls";

export const EluvioPlayerParameters = {
  networks: {
    MAIN: "https://main.net955305.contentfabric.io/config",
    DEMO: "https://demov3.net955210.contentfabric.io/config",
    TEST: "https://test.net955203.contentfabric.io/config",
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
    ON: true
  },
  watermark: {
    OFF: false,
    ON: true
  },
  settings: {
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
      authorizationToken: undefined
    }
  },
  playerOptions: {
    controls: EluvioPlayerParameters.controls.AUTO_HIDE,
    autoplay: EluvioPlayerParameters.autoplay.OFF,
    muted: EluvioPlayerParameters.muted.OFF,
    loop: EluvioPlayerParameters.loop.OFF,
    watermark: EluvioPlayerParameters.watermark.ON,
    settings: EluvioPlayerParameters.settings.ON,
    className: undefined,
    hlsjsOptions: undefined,
    dashjsOptions: undefined,
    // eslint-disable-next-line no-unused-vars
    playerCallback: ({videoElement, hlsPlayer, dashPlayer, posterUrl}) => {},
    errorCallback: (error) => {
      // eslint-disable-next-line no-console
      console.error("ELUVIO PLAYER: Error");
      // eslint-disable-next-line no-console
      console.error(error);
    },
    // eslint-disable-next-line no-unused-vars
    restartCallback: async (error) => {}
  }
};

export class EluvioPlayer {
  constructor(target, parameters) {
    this.warnings = false;
    this.reloads = [];

    this.DetectRemoval = this.DetectRemoval.bind(this);

    this.Initialize(target, parameters);
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
    const Callback = ([bodyElement]) => {
      // Play / pause when entering / leaving viewport
      if(this.playerOptions.autoplay === EluvioPlayerParameters.autoplay.WHEN_VISIBLE) {
        if(lastPlayPauseAction !== "play" && bodyElement.isIntersecting && this.video.paused) {
          this.video.play();
          lastPlayPauseAction = "play";
        } else if(lastPlayPauseAction !== "pause" && !bodyElement.isIntersecting && !this.video.paused) {
          this.video.pause();
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

        resolve();
      });

      await this.clientPromise;
    }

    if(!this.clientOptions.ticketInitialized && this.clientOptions.ticketCode) {
      if(!this.clientOptions.tenantId) { throw Error("ELUVIO PLAYER: Tenant ID must be provided if ticket code is specified."); }

      let code = this.clientOptions.ticketCode;
      let subject = this.clientOptions.ticketSubject;
      if(code.includes(":")) {
        subject = code.split(":")[0];
        code = code.split(":")[1];
      }

      await this.clientOptions.client.RedeemCode({
        tenantId: this.clientOptions.tenantId,
        ntpId: this.clientOptions.ntpId,
        code,
        email: subject
      });

      this.ticketInitialized = true;
    }

    return this.clientOptions.client;
  }

  async PosterUrl() {
    const client = await this.Client();

    try {
      const targetHash =
        this.sourceOptions.playoutParameters.linkPath ?
          await client.LinkTarget({...this.sourceOptions.playoutParameters}) :
          this.sourceOptions.playoutParameters.versionHash ||
          await client.LatestVersionHash({objectId: this.sourceOptions.playoutParameters.objectId});

      if(targetHash) {
        return await client.ContentObjectImageUrl({versionHash: targetHash});
      }
    // eslint-disable-next-line no-empty
    } catch (error) {}
  }

  async PlayoutOptions() {
    const client = await this.Client();
    if(!this.sourceOptions.playoutOptions) {
      this.sourceOptions.playoutOptions = await client.PlayoutOptions({
        ...this.sourceOptions.playoutParameters
      });

      window.playoutOptions = this.sourceOptions.playoutOptions;
    }

    let availableDRMs = (await client.AvailableDRMs()).filter(drm => (this.sourceOptions.drms || []).includes(drm));

    const protocol = this.sourceOptions.protocols.find(protocol => this.sourceOptions.playoutOptions[protocol]);
    const drm = this.sourceOptions.drms.find(drm => availableDRMs.includes(drm) && this.sourceOptions.playoutOptions[protocol].playoutMethods[drm]);

    const { playoutUrl, drms } = this.sourceOptions.playoutOptions[protocol].playoutMethods[drm];

    return {
      protocol,
      drm,
      playoutUrl,
      drms,
      availableDRMs,
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
      if(this.playerOptions.restartCallback) {
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

      if(this.__destroyed) { return; }

      await new Promise(resolve => setTimeout(resolve, delay));

      this.Log("Retrying stream");

      // Recall config to get new nodes
      const client = await this.Client();
      if(client) {
        await client.ResetRegion();
      }

      this.restarted = true;
      this.Initialize(this.target, this.originalParameters);
    } finally {
      this.reloading = false;
    }
  }

  async Initialize(target, parameters) {
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
    }

    this.errors = 0;

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
          muted: this.playerOptions.muted !== EluvioPlayerParameters.muted.OFF,
          controls: this.playerOptions.controls === EluvioPlayerParameters.controls.DEFAULT,
          loop: this.playerOptions.loop === EluvioPlayerParameters.loop.ON
        },
        classes: ["eluvio-player__video"]
      });

      this.video.setAttribute("playsinline", "playsinline");

      // Detect removal of video to ensure player is properly destroyed
      this.mutationObserver = new MutationObserver(() => {
        if(this.mutationTimeout) { return; }

        this.mutationTimeout = setTimeout(this.DetectRemoval, 2000);
      });
      this.mutationObserver.observe(document.body, {childList: true, subtree: true});

      this.resizeObserver = new ResizeObserver(entries => {
        if(this.__destroyed) { return; }

        const dimensions = entries[0].contentRect;

        if(this.controls) {
          this.controls.HandleResize(dimensions);
        }
      });
      this.resizeObserver.observe(this.target);

      const controlsPromise = this.PosterUrl().then(posterUrl => {
        this.posterUrl = posterUrl;
        this.controls = new PlayerControls(this.target, this.video, this.playerOptions, posterUrl);
      });

      if(this.clientOptions.promptTicket && !this.clientOptions.ticketCode) {
        if(!this.clientOptions.tenantId) { throw Error("ELUVIO PLAYER: Tenant ID must be provided if ticket code is needed."); }

        controlsPromise.then(() =>
          this.controls.InitializeTicketPrompt(async (code) => {
            code = (code || "").trim();
            let subject = this.clientOptions.ticketSubject;
            if(code.includes(":")) {
              subject = code.split(":")[0];
              code = code.split(":")[1];
            }

            await this.clientOptions.client.RedeemCode({
              tenantId: this.clientOptions.tenantId,
              ntpId: this.clientOptions.ntpId,
              code,
              email: subject
            });

            this.ticketInitialized = true;
            this.clientOptions.ticketCode = code;
            this.originalParameters.clientOptions.client = this.clientOptions.client;
            this.originalParameters.clientOptions.ticketCode = code;

            this.Initialize(this.target);
          })
        );

        return;
      }

      let { protocol, drm, playoutUrl, drms, multiviewOptions } = await playoutOptionsPromise;

      multiviewOptions.target = this.target;

      playoutUrl = URI(playoutUrl);
      const authorizationToken = playoutUrl.query(true).authorization;

      //const HLSPlayer = (await import("hls.js")).default;
      const HLSPlayer = (await import("hls-fix")).default;

      let hlsPlayer, dashPlayer;
      if(drm === "fairplay") {
        InitializeFairPlayStream({playoutOptions: this.sourceOptions.playoutOptions, video: this.video});

        if(multiviewOptions.enabled) { controlsPromise.then(() => this.controls.InitializeMultiViewControls(multiviewOptions)); }
      } else if(!HLSPlayer.isSupported() || drm === "sample-aes") {
        this.video.src = playoutUrl.toString();

        if(multiviewOptions.enabled) { controlsPromise.then(() => this.controls.InitializeMultiViewControls(multiviewOptions)); }
      } else if(protocol === "hls") {

        playoutUrl.removeQuery("authorization");

        // Inject
        hlsPlayer = new HLSPlayer({
          maxBufferLength: 30,
          maxBufferSize: 300,
          enableWorker: true,
          xhrSetup: xhr => {
            xhr.setRequestHeader("Authorization", `Bearer ${authorizationToken}`);

            if((this.playerOptions.hlsjsOptions || {}).xhrSetup) {
              this.playerOptions.hlsjsOptions.xhrSetup(xhr);
            }

            return xhr;
          },
          ...(this.playerOptions.hlsjsOptions || {})
        });
        hlsPlayer.loadSource(playoutUrl.toString());
        hlsPlayer.attachMedia(this.video);

        if(multiviewOptions.enabled) {
          const Switch = multiviewOptions.SwitchView;

          multiviewOptions.SwitchView = async (view) => {
            await Switch(view);
            hlsPlayer.nextLevel = hlsPlayer.currentLevel;
          };

          controlsPromise.then(() => this.controls.InitializeMultiViewControls(multiviewOptions));
        }

        this.controls.SetQualityControls({
          GetLevels: () => hlsPlayer.levels.map((level, index) => ({index, active: index === hlsPlayer.currentLevel, resolution: level.attrs.RESOLUTION, bitrate: level.bitrate})),
          SetLevel: levelIndex => hlsPlayer.nextLevel = levelIndex
        });

        hlsPlayer.on(HLSPlayer.Events.FRAG_LOADED, () => this.errors = 0);

        hlsPlayer.on(HLSPlayer.Events.ERROR, async (event, error) => {
          this.errors += 1;

          this.Log(`Encountered ${error.details}`);
          this.Log(error);

          if(error.details === "bufferFullError") {
            this.Log("Buffer full error - Restarting player", true);
            this.HardReload(error);
          }

          if(error.details === "bufferStalledError") {
            const stallTime = this.video.currentTime;

            setTimeout(() => {
              if(!this.video.paused && this.video.currentTime === stallTime) {
                this.Log("Buffer stalled error, no progress in 5 seconds - Restarting player", true);
                this.HardReload(error, 1000);
              }
            }, 5000);
          }

          if(error.fatal || this.errors === 3) {
            this.HardReload(error);
          }
        });

        this.player = hlsPlayer;
      } else {
        const DashPlayer = (await import("dashjs")).default;
        dashPlayer = DashPlayer.MediaPlayer().create();

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

        if(multiviewOptions.enabled) { controlsPromise.then(() => this.controls.InitializeMultiViewControls(multiviewOptions)); }

        this.player = dashPlayer;
      }

      if(this.playerOptions.playerCallback) {
        this.playerOptions.playerCallback({
          videoElement: this.video,
          hlsPlayer,
          dashPlayer,
          posterUrl: this.posterUrl
        });
      }

      if(this.playerOptions.autoplay === EluvioPlayerParameters.autoplay.ON) {
        this.video.play();
      }

      this.RegisterVisibilityCallback();
    } catch (error) {
      this.playerOptions.errorCallback(error);

      if(error.status === 500) {
        this.HardReload(error);
      }
    }
  }
}

export default EluvioPlayer;

