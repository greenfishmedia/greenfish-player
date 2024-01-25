import "./static/stylesheets/player.scss";

import "focus-visible";

import MergeWith from "lodash/mergeWith";
import Clone from "lodash/cloneDeep";

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
    LOW_LATENCY: "low_latency",
    ULTRA_LOW_LATENCY: "ultra_low_latency",
    CUSTOM: "custom"
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
  title: {
    ON: true,
    OFF: false
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
  },
  collectVideoAnalytics: {
    OFF: false,
    ON: true,
    DISABLE_COOKIES: "disable_cookies"
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
      EluvioPlayerParameters.drms.CLEAR
    ],
    contentOptions: {
      title: undefined,
      description: undefined
    },
    mediaCollectionOptions: {
      mediaCatalogObjectId: undefined,
      mediaCatalogVersionHash: undefined,
      collectionId: undefined
    },
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
    appName: undefined,
    controls: EluvioPlayerParameters.controls.AUTO_HIDE,
    autoplay: EluvioPlayerParameters.autoplay.OFF,
    muted: EluvioPlayerParameters.muted.OFF,
    loop: EluvioPlayerParameters.loop.OFF,
    watermark: EluvioPlayerParameters.watermark.ON,
    capLevelToPlayerSize: EluvioPlayerParameters.capLevelToPlayerSize.OFF,
    title: EluvioPlayerParameters.title.ON,
    posterUrl: undefined,
    className: undefined,
    controlsClassName: undefined,
    playerProfile: EluvioPlayerParameters.playerProfile.DEFAULT,
    hlsjsOptions: undefined,
    dashjsOptions: undefined,
    debugLogging: false,
    collectVideoAnalytics: true,
    maxBitrate: undefined,
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
    hlsSettings: Utils.HLSJSSettings({profile: "default"}),
  },
  low_latency: {
    label: "Low Latency Live",
    hlsSettings: Utils.HLSJSSettings({profile: "ll"})
  },
  ultra_low_latency: {
    label: "Ultra Low Latency Live",
    hlsSettings: Utils.HLSJSSettings({profile: "ull"})
  },
  custom: {
    label: "Custom",
    hlsSettings: {}
  }
};

export class EluvioPlayer {
  constructor(target, parameters) {
    this.reloads = [];

    try {
      if(
        parameters.playerOptions.hlsjsOptions &&
        Object.keys(parameters.playerOptions.hlsjsOptions).length > 0
      ) {
        this.customHLSOptions = parameters.playerOptions.hlsjsOptions;
        parameters.playerOptions.playerProfile = EluvioPlayerParameters.playerProfile.CUSTOM;
      }
    } catch (error) {
      this.Log(error, true);
    }

    this.DetectRemoval = this.DetectRemoval.bind(this);

    this.target = target;
    this.originalParameters = parameters;

    this.Initialize(target, parameters);

    window.EluvioPlayer = this;
  }

  Log(message, error=false) {
    if(error) {
      // eslint-disable-next-line no-console
      console.error("ELUVIO PLAYER:", message);
    } else {
      if(this.playerOptions.debugLogging) {
        // eslint-disable-next-line no-console
        console.warn("ELUVIO PLAYER:", message);
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

  SetErrorMessage(message) {
    let errorMessage = this.target.querySelector(".eluvio-player__error-message");

    if(!errorMessage) {
      errorMessage = CreateElement({
        parent: this.target,
        classes: ["eluvio-player__error-message"]
      });
    }

    errorMessage.innerHTML = "";

    CreateElement({
      parent: errorMessage,
      classes: ["eluvio-player__error-message__text"]
    }).innerHTML = message;

    this.target.classList.add("eluvio-player--error");
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
    if(!this.clientOptions.tenantId || !this.clientOptions.ntpId) {
      throw { displayMessage: "Tenant ID and NTP ID must be provided if ticket code is specified." };
    }

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

    if(this.collectionInfo) {
      const activeMedia = this.ActiveCollectionMedia();
      this.sourceOptions.playoutParameters.versionHash = activeMedia.mediaHash;
    }

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

    if(this.hlsPlayer) {
      this.hlsPlayer.destroy();
    } else if(this.dashPlayer) {
      this.dashPlayer.destroy();
    }

    this.hlsPlayer = undefined;
    this.dashPlayer = undefined;
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

      this.SetErrorMessage(error.displayMessage || "Something went wrong, reloading player...");
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

  ActiveCollectionMedia() {
    if(!this.collectionInfo || !this.collectionInfo.content) { return; }

    return this.collectionInfo.content[this.collectionInfo.mediaIndex];
  }

  CollectionPlay({mediaIndex, mediaId}) {
    if(mediaId) {
      mediaIndex = this.collectionInfo.content.find(media => media.id === mediaId);
    }

    this.collectionInfo.mediaIndex = mediaIndex;
    this.Initialize(
      this.target,
      this.originalParameters,
      !this.video ? null :
        {
          muted: this.video.muted,
          volume: this.video.volume,
          playing: !this.video.paused
        }
    );
  }

  CollectionPlayNext() {
    const nextIndex = Math.min(this.collectionInfo.mediaIndex + 1, this.collectionInfo.mediaLength - 1);

    if(nextIndex === this.collectionInfo.mediaIndex) { return; }

    this.CollectionPlay({mediaIndex: nextIndex});
  }

  CollectionPlayPrevious() {
    const previousIndex = Math.max(0, this.collectionInfo.mediaIndex - 1);

    if(previousIndex === this.collectionInfo.mediaIndex) { return; }

    this.CollectionPlay({mediaIndex: previousIndex});
  }

  async LoadCollection() {
    if(this.collectionInfo) { return; }

    let {mediaCatalogObjectId, mediaCatalogVersionHash, collectionId} = (this.sourceOptions?.mediaCollectionOptions || {});

    if(!collectionId) { return; }

    if(!mediaCatalogObjectId && !mediaCatalogVersionHash) {
      throw { displayMessage: "Invalid collection options: Media catalog not specified" };
    }

    const client = await this.Client();

    try {
      const authorizationToken = this.sourceOptions.playoutParameters.authorizationToken;

      mediaCatalogVersionHash = mediaCatalogVersionHash || await client.LatestVersionHash({objectId: mediaCatalogObjectId});
      const collections = (await client.ContentObjectMetadata({
        versionHash: mediaCatalogVersionHash,
        metadataSubtree: "public/asset_metadata/info/collections",
        authorizationToken
      })) || [];

      const collectionInfo = collections.find(collection => collection.id === collectionId);

      if(!collectionInfo) {
        throw { displayMessage: `No collection with ID ${collectionId} found for media catalog ${mediaCatalogObjectId || mediaCatalogVersionHash}` };
      }

      collectionInfo.content = collectionInfo.content
        .filter(content => content.media)
        .map(content => ({
          ...content,
          mediaHash: content.media?.["/"]?.split("/").find(segment => segment.startsWith("hq__"))
        }));

      this.collectionInfo = {
        ...collectionInfo,
        isPlaylist: collectionInfo.type === "playlist",
        mediaIndex: 0,
        mediaLength: collectionInfo.content.length
      };
    } catch (error) {
      this.Log("Failed to load collection:");
      throw error;
    }
  }

  async Initialize(target, parameters, restartParameters) {
    if(this.__destroyed) { return; }

    this.__DestroyPlayer();

    this.initTime = Date.now();

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

    // Handle ticket authorization
    if(this.clientOptions.promptTicket && !this.ticketInitialized) {
      if(!this.clientOptions.tenantId || !this.clientOptions.ntpId) {
        throw { displayMessage: "Tenant ID and NTP ID must be provided if ticket code is needed." };
      }

      InitializeTicketPrompt(
        this.target,
        this.clientOptions.ticketCode,
        async code => {
          await this.RedeemCode(code);

          this.Initialize(target, parameters);
        }
      );

      return;
    }

    try {
      this.target.classList.add("eluvio-player");

      // Load collection info, if present
      await this.LoadCollection();

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

      if(this.playerOptions.title !== false && this.playerOptions.controls !== EluvioPlayerParameters.controls.DEFAULT) {
        if(this.ActiveCollectionMedia()) {
          const {title, description} = this.ActiveCollectionMedia();

          this.controls.InitializeContentTitle({title, description});
        } else if(this.sourceOptions.contentOptions.title) {
          this.controls.InitializeContentTitle({
            title: this.sourceOptions.contentOptions.title,
            description: this.sourceOptions.contentOptions.description
          });
        }
      }

      if(restartParameters) {
        this.video.addEventListener("loadedmetadata", async () => {
          this.video.volume = restartParameters.volume;
          this.video.muted = restartParameters.muted;

          if(restartParameters.currentTime) {
            this.video.currentTime = restartParameters.currentTime;
          }

          if(restartParameters.playing) {
            PlayPause(this.video, true);
          }
        });
      }

      // Detect live video
      this.video.addEventListener("durationchange", () => {
        if(this.video.duration && this.videoDuration > 0 && this.video.duration !== this.videoDuration) {
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

      if(this.collectionInfo && this.collectionInfo.isPlaylist && this.collectionInfo.mediaIndex < this.collectionInfo.mediaLength - 1) {
        this.video.addEventListener("ended", () => this.CollectionPlayNext());
      }

      let { protocol, drm, playoutUrl, drms, multiviewOptions } = await this.PlayoutOptions();

      this.PosterUrl().then(posterUrl => this.controls.SetPosterUrl(posterUrl));

      multiviewOptions.target = this.target;

      playoutUrl = new URL(playoutUrl);
      const authorizationToken =
        this.sourceOptions.playoutParameters.authorizationToken ||
        playoutUrl.searchParams.get("authorization");

      if(protocol === "hls") {
        await this.InitializeHLS({playoutUrl, authorizationToken, drm, drms, multiviewOptions});
      } else {
        await this.InitializeDash({playoutUrl, authorizationToken, drm, drms, multiviewOptions});
      }

      if(this.playerOptions.collectVideoAnalytics) {
        import("./Analytics")
          .then(({InitializeMuxMonitoring}) => InitializeMuxMonitoring({
            appName: this.playerOptions.appName || "elv-player-js",
            elvPlayer: this,
            playoutUrl,
            authorizationToken,
            disableCookies: this.playerOptions.collectVideoAnalytics === EluvioPlayerParameters.collectVideoAnalytics.DISABLE_COOKIES
          }));
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
            this.SetErrorMessage(permissionErrorMessage);

            if(typeof error === "object") {
              error.permission_message = permissionErrorMessage;
            } else {
              this.Log(permissionErrorMessage, true);
            }
          } else {
            this.SetErrorMessage(error.displayMessage || "Insufficient permissions");
          }
        // eslint-disable-next-line no-empty
        } catch (error) {
          this.SetErrorMessage(error.displayMessage || "Insufficient permissions");
        }
      } else if(error.status === 500) {
        this.HardReload(error, 10000);
      } else {
        this.SetErrorMessage(error.displayMessage || "Something went wrong");
      }

      if(this.playerOptions.errorCallback) {
        this.playerOptions.errorCallback(error, this);
      }
    }
  }

  async InitializeHLS({playoutUrl, authorizationToken, drm, multiviewOptions}) {
    this.HLS = (await import("hls.js")).default;

    if(["fairplay", "sample-aes"].includes(drm) || !this.HLS.isSupported()) {
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
      playoutUrl.searchParams.delete("authorization");

      const profileSettings = (PlayerProfiles[this.playerOptions.playerProfile] || {}).hlsSettings || {};
      const customProfileSettings = this.playerOptions.playerProfile === EluvioPlayerParameters.playerProfile.CUSTOM ? this.customHLSOptions : {};

      this.hlsOptions = {
        capLevelToPlayerSize: this.playerOptions.capLevelToPlayerSize,
        ...profileSettings,
        ...customProfileSettings
      };

      const hlsPlayer = new this.HLS({
        xhrSetup: xhr => {
          xhr.setRequestHeader("Authorization", `Bearer ${authorizationToken}`);

          if((this.playerOptions.hlsjsOptions || {}).xhrSetup) {
            this.playerOptions.hlsjsOptions.xhrSetup(xhr);
          }

          return xhr;
        },
        ...this.hlsOptions
      });

      // Limit playback to maximum bitrate, if specified
      if(this.playerOptions.maxBitrate) {
        hlsPlayer.on(this.HLS.Events.MANIFEST_PARSED, (_, {levels, firstLevel}) => {
          let levelsToRemove = levels
            .map((level, i) => level.bitrate > this.playerOptions.maxBitrate ? i : undefined)
            .filter(i => typeof i !== "undefined")
            // Note: Remove levels from highest to lowest index
            .reverse();

          if(levelsToRemove.length === levels.length) {
            this.Log(`Warning: Max bitrate '${this.playerOptions.maxBitrate}bps' is less than all available levels for this content.`);
            // Keep first level
            levelsToRemove = levelsToRemove.filter(i => i > 0);
          }

          this.Log("Removing the following levels due to maxBitrate setting:");
          this.Log(levelsToRemove.map(i => [levels[i].width, "x", levels[i].height, ` (${(levels[i].bitrate / 1000 / 1000).toFixed(1)}Mbps)`].join("")).join(", "));

          if(levelsToRemove.find(i => firstLevel === i)) {
            // Player will start on level that is being removed - switch to highest level that will not be removed
            hlsPlayer.startLevel = levels.map((_, i) => i).filter(i => !levelsToRemove.includes(i)).reverse()[0];
          }

          levelsToRemove.map(i => hlsPlayer.removeLevel(i));
        });
      }

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

        hlsPlayer.on(this.HLS.Events.SUBTITLE_TRACKS_UPDATED, () => this.UpdateTextTracks());
        hlsPlayer.on(this.HLS.Events.LEVEL_LOADED, () => UpdateQualityOptions());
        hlsPlayer.on(this.HLS.Events.LEVEL_SWITCHED, () => UpdateQualityOptions());
        hlsPlayer.on(this.HLS.Events.SUBTITLE_TRACK_SWITCH, () => this.UpdateTextTracks());
        hlsPlayer.on(this.HLS.Events.AUDIO_TRACKS_UPDATED, () => {
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
            options: Object.keys(PlayerProfiles)
              .map(key => ({
                index: key,
                label: PlayerProfiles[key].label,
                active: this.playerOptions.playerProfile === key,
                activeLabel: `Player Profile: ${PlayerProfiles[key].label}`
              }))
          }),
          SetProfile: async key => {
            const SetPlayerProfile = async ({profile, customHLSOptions={}}) => {
              this.videoDuration = undefined;
              this.playerOptions.playerProfile = profile;
              this.customHLSOptions = customHLSOptions;

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
            };

            if(key === EluvioPlayerParameters.playerProfile.CUSTOM) {
              this.controls.ShowHLSOptionsForm({
                hlsOptions: this.hlsOptions,
                SetPlayerProfile,
                hlsVersion: this.HLS.version
              });
            } else {
              SetPlayerProfile({profile: key});
            }
          }
        });
      }

      hlsPlayer.on(this.HLS.Events.FRAG_LOADED, () => {
        this.errors = 0;
        clearTimeout(this.bufferFullRestartTimeout);
      });

      hlsPlayer.on(this.HLS.Events.ERROR, async (event, error) => {
        this.Log(`Encountered ${error.details}`, true);
        this.Log(error, true);

        if(error && [this.HLS.ErrorDetails.BUFFER_FULL_ERROR, this.HLS.ErrorDetails.BUFFER_STALLED_ERROR].includes(error.details)) {
          // Ignore HLS buffer errors
          return;
        }

        this.errors += 1;

        if(error.response && error.response.code === 403) {
          // Not allowed to access
          this.SetErrorMessage("Insufficient permissions");
        } else if(this.errors < 5) {
          if(error.fatal) {
            if(error.type === this.HLS.ErrorTypes.MEDIA_ERROR) {
              this.Log("Attempting to recover using hlsPlayer.recoverMediaError");
              hlsPlayer.recoverMediaError();
            } else {
              this.HardReload(error);
            }
          }
        } else {
          this.HardReload(error);
        }
      });

      this.hlsPlayer = hlsPlayer;
      this.player = hlsPlayer;
    }
  }

  async InitializeDash({playoutUrl, authorizationToken, drm, drms, multiviewOptions}) {
    this.Dash = (await import("dashjs")).default;
    const dashPlayer = this.Dash.MediaPlayer().create();

    const customDashOptions = this.playerOptions.dashjsOptions || {};
    dashPlayer.updateSettings({
      ...customDashOptions,
      "streaming": {
        "buffer": {
          "fastSwitchEnabled": true
        },
        "text": {
          "defaultEnabled": false,
        },
        ...(customDashOptions.streaming || {})
      },
      "text": {
        "defaultEnabled": false,
        ...(customDashOptions.text || {})
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

    if(this.playerOptions.maxBitrate) {
      dashPlayer.updateSettings({
        "streaming": {
          "abr": {
            "maxBitrate": { "video": this.playerOptions.maxBitrate / 1000 }
          }
        }
      });
    }

    playoutUrl.searchParams.delete("authorization");
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

    dashPlayer.on(this.Dash.MediaPlayer.events.QUALITY_CHANGE_RENDERED, () => UpdateQualityOptions());
    dashPlayer.on(this.Dash.MediaPlayer.events.TRACK_CHANGE_RENDERED, () => {
      UpdateAudioTracks();
      this.UpdateTextTracks({dashPlayer});
    });
    dashPlayer.on(this.Dash.MediaPlayer.events.MANIFEST_LOADED, () => {
      UpdateQualityOptions();
      UpdateAudioTracks();
    });

    this.player = dashPlayer;
    this.dashPlayer = dashPlayer;
  }

  UpdateTextTracks({dashPlayer}={}) {
    const tracks = dashPlayer ?
      dashPlayer.getTracksFor("text") : Array.from(this.video.textTracks);

    if(!tracks || tracks.length === 0) {
      return;
    }

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

EluvioPlayer.EluvioPlayerParameters = EluvioPlayerParameters;

export default EluvioPlayer;

