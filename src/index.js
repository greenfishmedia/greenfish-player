import "./static/stylesheets/player.scss";

import mergeWith from "lodash/mergeWith";
import URI from "urijs";

import {InitializeFairPlayStream} from "./FairPlay";
import {InitializeControls, CreateElement} from "./Controls";

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
  controls: {
    OFF: false,
    AUTO_HIDE: "autohide",
    ON: true
  },
  autoplay: {
    OFF: false,
    WHEN_VISIBLE: "when visible",
    ON: true
  },
  muted: {
    OFF: false,
    WHEN_NOT_VISIBLE: "when_not_visible",
    ON: true
  }
};

const DefaultParameters = {
  clientOptions: {
    network: EluvioPlayerParameters.networks.MAIN,
    client: undefined,
    staticToken: undefined
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
    className: undefined,
    hlsjsOptions: undefined,
    dashjsOptions: undefined,
    // eslint-disable-next-line no-unused-vars
    playerCallback: ({videoElement, hlsPlayer, dashPlayer}) => {},
    errorCallback: (error) => {
      // eslint-disable-next-line no-console
      console.error("Eluvio Player Error:");
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }
};

class EluvioPlayer {
  constructor(target, parameters) {
    parameters = mergeWith(
      DefaultParameters,
      parameters
    );

    this.target = target;

    this.clientOptions = parameters.clientOptions;
    this.sourceOptions = parameters.sourceOptions;
    this.playerOptions = parameters.playerOptions;

    this.Initialize();
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
    if(!this.clientOptions.client) {
      const {ElvClient} = await import("@eluvio/elv-client-js");
      const client = await ElvClient.FromConfigurationUrl({
        configUrl: this.clientOptions.network
      });

      await client.SetStaticToken({
        token: this.clientOptions.staticToken || client.utils.B64(JSON.stringify({qspace_id: await client.ContentSpaceId()}))
      });

      return client;
    }

    return this.clientOptions.client;
  }

  async PlayoutOptions() {
    const client = await this.Client();
    if(!this.sourceOptions.playoutOptions) {
      this.sourceOptions.playoutOptions = await client.PlayoutOptions({
        ...this.sourceOptions.playoutParameters
      });
    }

    const availableDRMs = await client.AvailableDRMs();

    const protocol = this.sourceOptions.protocols.find(protocol => this.sourceOptions.playoutOptions[protocol]);
    const drm = this.sourceOptions.drms.find(drm => availableDRMs.includes(drm) && this.sourceOptions.playoutOptions[protocol].playoutMethods[drm]);

    const { playoutUrl, drms } = this.sourceOptions.playoutOptions[protocol].playoutMethods[drm];

    return {
      protocol,
      drm,
      playoutUrl,
      drms
    };
  }

  async Initialize() {
    try {
      let {protocol, drm, playoutUrl, drms} = await this.PlayoutOptions();

      this.target.classList.add("eluvio-player");

      this.video = CreateElement({
        parent: this.target,
        type: "video",
        options: {
          muted: this.playerOptions.muted !== EluvioPlayerParameters.muted.OFF,
          controls: false
        },
        classes: ["eluvio-player__video"]
      });

      InitializeControls(this.target, this.video);

      playoutUrl = URI(playoutUrl);
      const authorizationToken = playoutUrl.query(true).authorization;

      let hlsPlayer, dashPlayer;
      if(drm === "fairplay") {
        InitializeFairPlayStream({playoutOptions: this.sourceOptions.playoutOptions, video: this.video});
      } else if(drm === "sample-aes") {
        this.video.src = playoutUrl.toString();
      } else if(protocol === "hls") {
        const HLSPlayer = (await import("hls.js")).default;

        playoutUrl.removeQuery("authorization");

        // Inject
        hlsPlayer = new HLSPlayer({
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
      }

      this.playerOptions.playerCallback({videoElement: this.video, hlsPlayer});

      if(this.playerOptions.autoplay === EluvioPlayerParameters.autoplay.ON) {
        this.video.play();
      }

      this.video.addEventListener("click", () => this.video.paused ? this.video.play() : this.video.pause());

      this.RegisterVisibilityCallback();
    } catch (error) {
      this.playerOptions.errorCallback(error);
    }
  }
}

export default EluvioPlayer;

