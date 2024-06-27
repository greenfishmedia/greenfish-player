import EluvioPlayerParameters from "./PlayerParameters.js";
import {InitializeFairPlayStream} from "./FairPlay.js";

import {Utils} from "@eluvio/elv-client-js";
import PlayerControls from "./Controls.js";
import {MergeDefaultParameters} from "../ui/Common";

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
  // Register a listener for the specified video element event
  __RegisterVideoEventListener(event, callback) {
    this.video.addEventListener(event, callback);

    this.__listenerDisposers.push(() => this.video.removeEventListener(event, callback));
  }

  // Register a listener that will be called any time the video settings have changed
  __RegisterSettingsListener(listener) {
    this.__settingsListeners.push(listener);

    return () => this.__settingsListeners = this.__settingsListeners.filter(l => l !== listener);
  }

  constructor({target, video, parameters, SetErrorMessage}) {
    this.loading = true;
    this.target = target;
    this.video = video;
    this.SetErrorMessage = SetErrorMessage;
    this.controls = new PlayerControls({player: this});
    this.__settingsListeners = [];
    this.__listenerDisposers = [];
    this.__showPlayerProfileForm = false;
    this.playbackStarted = false;
    this.reloads = 0;
    this.canPlay = false;

    try {
      // If custom HLS parameters are specified, set profile to custom
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

    this.__Initialize(parameters);
  }

  async __Client() {
    if(this.clientPromise) {
      await this.clientPromise;
    }

    if(!this.clientOptions.client) {
      this.clientPromise = (async () => {
        const {ElvClient} = await import("@eluvio/elv-client-js");
        this.clientOptions.client = await ElvClient.FromConfigurationUrl({
          configUrl: this.clientOptions.network
        });

        this.clientOptions.client.SetStaticToken({
          token:
            this.clientOptions.staticToken ||
            this.clientOptions.client.utils.B64(JSON.stringify({qspace_id: await this.clientOptions.client.ContentSpaceId()}))
        });

        return this.clientOptions.client;
      })();

      await this.clientPromise;
    }

    return this.clientOptions.client;
  }

  async __PlayoutOptions() {
    const client = await this.__Client();
    const playoutParameters = this.sourceOptions.playoutParameters || {};

    if(this.collectionInfo) {
      const activeMedia = this.collectionInfo.content[this.collectionInfo.mediaIndex];
      playoutParameters.objectId = client.utils.DecodeVersionHash(activeMedia.mediaHash).objectId;
      playoutParameters.versionHash = activeMedia.mediaHash;
      this.sourceOptions.playoutOptions = undefined;
    }

    let offeringId, offeringURI, options = {};
    if(playoutParameters.clipStart || playoutParameters.clipEnd) {
      options.clip_start = parseFloat(playoutParameters.clipStart || 0);

      if(playoutParameters.clipEnd) {
        options.clip_end = parseFloat(playoutParameters.clipEnd);
      }
    }

    options.ignore_trimming = playoutParameters.ignoreTrimming;
    options.resolve = playoutParameters.resolve;

    if(playoutParameters.offering || playoutParameters.directLink || (playoutParameters.offerings || []).length > 0) {
      let availableOfferings = (await client.AvailableOfferings({
        objectId: playoutParameters.objectId,
        versionHash: playoutParameters.versionHash,
        writeToken: playoutParameters.writeToken,
        linkPath: playoutParameters.linkPath,
        directLink: playoutParameters.directLink,
        resolveIncludeSource: true,
        authorizationToken: playoutParameters.authorizationToken
      })) || {};

      offeringId = Object.keys(availableOfferings)[0];
      if(playoutParameters.offering) {
        offeringId = availableOfferings[playoutParameters.offering] ? playoutParameters.offering : undefined;
      } else if((playoutParameters.offerings || []).length > 0) {
        offeringId = playoutParameters.offerings.find(offeringId => availableOfferings[offeringId]);
      }

      if(!offeringId) {
        throw new Error(`Unable to find offering from '${playoutParameters.offering || playoutParameters.offerings}'`);
      }

      offeringURI = availableOfferings[offeringId].uri;
    }

    if(playoutParameters.directLink) {
      if(!this.sourceOptions.playoutOptions) {
        this.sourceOptions.playoutOptions = await client.PlayoutOptions({
          offeringURI,
          options
        });
      }
    } else {
      if(!this.sourceOptions.playoutOptions) {
        this.sourceOptions.playoutOptions = await client.PlayoutOptions({
          ...playoutParameters,
          offering: offeringId,
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
    const versionHash = playoutUrl.split("/").find(segment => segment.startsWith("hq__"));

    return {
      protocol,
      drm,
      playoutUrl,
      versionHash,
      drms,
      availableDRMs,
      offeringURI,
      offering: offeringId,
      sessionId: this.sourceOptions.playoutOptions.sessionId,
      multiviewOptions: {
        enabled: this.sourceOptions.playoutOptions.multiview,
        AvailableViews: this.sourceOptions.playoutOptions.AvailableViews,
        SwitchView: this.sourceOptions.playoutOptions.SwitchView
      }
    };
  }

  __CollectionPlay({mediaIndex, mediaId, autoplay}) {
    if(mediaId) {
      mediaIndex = this.collectionInfo.content.find(media => media.id === mediaId);
    }

    this.collectionInfo.mediaIndex = mediaIndex;

    this.__SettingsUpdate();

    this.__Initialize(
      this.originalParameters,
      !this.video ? null :
        {
          muted: this.video.muted,
          volume: this.video.volume,
          playing: typeof autoplay !== "undefined" ? autoplay : !this.video.paused
        }
    );
  }

  async __LoadCollection() {
    if(this.collectionInfo) { return; }

    let {mediaCatalogObjectId, mediaCatalogVersionHash, collectionId} = (this.sourceOptions && this.sourceOptions.mediaCollectionOptions) || {};

    if(!collectionId) { return; }

    if(!mediaCatalogObjectId && !mediaCatalogVersionHash) {
      throw { displayMessage: "Invalid collection options: Media catalog not specified" };
    }

    const client = await this.__Client();

    try {
      const authorizationToken = this.sourceOptions.playoutParameters.authorizationToken;

      mediaCatalogVersionHash = mediaCatalogVersionHash || await client.LatestVersionHash({objectId: mediaCatalogObjectId});
      const collections = (await client.ContentObjectMetadata({
        versionHash: mediaCatalogVersionHash,
        metadataSubtree: "public/asset_metadata/info/collections",
        authorizationToken,
        produceLinkUrls: true
      })) || [];

      const collectionInfo = collections.find(collection => collection.id === collectionId);

      if(!collectionInfo) {
        throw { displayMessage: `No collection with ID ${collectionId} found for media catalog ${mediaCatalogObjectId || mediaCatalogVersionHash}` };
      }

      collectionInfo.content = collectionInfo.content
        .filter(content => content.media)
        .map((content, index) => ({
          ...content,
          active: index === 0,
          mediaId: content.id,
          mediaIndex: index,
          mediaHash: content.media && content.media["/"] && content.media["/"].split("/").find(segment => segment.startsWith("hq__"))
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

  async __Initialize(parameters, restartParameters) {
    if(this.__destroyed) { return; }

    this.__Reset();

    this.loading = true;
    this.initTime = Date.now();

    this.__SettingsUpdate();

    if(parameters) {
      this.originalParameters = MergeDefaultParameters(parameters);

      this.clientOptions = parameters.clientOptions;
      this.sourceOptions = parameters.sourceOptions;
      this.playerOptions = parameters.playerOptions;
    }

    this.isLive = parameters.sourceOptions.contentInfo.type === EluvioPlayerParameters.type.LIVE;

    this.errors = 0;

    // Start client loading
    this.__Client();

    try {
      if(restartParameters) {
        this.video.volume = restartParameters.volume;
        this.video.muted = restartParameters.muted;

        if(restartParameters.playing) {
          this.playerOptions.autoplay = EluvioPlayerParameters.autoplay.ON;
        }

        if(restartParameters.currentTime) {
          this.__RegisterVideoEventListener(
            "loadedmetadata",
            () => this.video.currentTime = restartParameters.currentTime
          );
        }
      }

      this.__RegisterVideoEventListener("play", () => {
        this.reloads = 0;
        this.playbackStarted = true;
        this.__SettingsUpdate();
      });

      const CheckIsLive = () => {
        if(this.canPlay && !isFinite(this.video.duration)) {
          this.isLive = true;
        } else if(this.video.duration && this.videoDuration > 0 && Math.abs(this.video.duration - this.videoDuration) > 1) {
          this.isLive = true;
        }
      };

      this.__RegisterVideoEventListener("canplay", () => {
        if(this.initTime && !this.initTimeLogged) {
          this.Log(`Player initialization: ${((Date.now() - this.initTime) / 1000).toFixed(2)} seconds`);
          this.initTimeLogged = true;
          this.canPlay = true;

          CheckIsLive();

          if(this.playerOptions.autoplay === EluvioPlayerParameters.autoplay.ON) {
            this.controls.Play();
          }
        }
      });

      // Detect live video
      this.__RegisterVideoEventListener("durationchange", () => {
        CheckIsLive();

        this.videoDuration = this.video.duration;
      });

      // Load collection info, if present
      await this.__LoadCollection();

      if(this.collectionInfo && this.collectionInfo.isPlaylist && this.collectionInfo.mediaIndex < this.collectionInfo.mediaLength - 1) {
        this.__RegisterVideoEventListener("ended", () => this.controls && this.controls.CollectionPlayNext({autoplay: true}));
      }

      let { versionHash, playoutUrl, protocol, drm, drms, multiviewOptions } = await this.__PlayoutOptions();

      this.contentHash = versionHash;

      //multiviewOptions.target = this.target;

      playoutUrl = new URL(playoutUrl);
      const authorizationToken =
        this.sourceOptions.playoutParameters.authorizationToken ||
        playoutUrl.searchParams.get("authorization");

      if(this.__destroyed) { return; }

      if(protocol === "hls") {
        await this.__InitializeHLS({playoutUrl, authorizationToken, drm, drms, multiviewOptions});
      } else {
        await this.__InitializeDash({playoutUrl, authorizationToken, drm, drms, multiviewOptions});
      }

      if(this.playerOptions.collectVideoAnalytics) {
        import("./Analytics.js")
          .then(({InitializeMuxMonitoring}) => InitializeMuxMonitoring({
            appName: this.playerOptions.appName || "elv-player-js",
            elvPlayer: this,
            playoutUrl,
            authorizationToken,
            disableCookies: this.playerOptions.collectVideoAnalytics === EluvioPlayerParameters.collectVideoAnalytics.DISABLE_COOKIES
          }));
      }

      if(this.playerOptions.verifyContent) {
        setTimeout(() => {
          this.__VerifyContent();
        }, 1000);
      }

      if(this.playerOptions.playerCallback) {
        this.playerOptions.playerCallback({
          player: this,
          videoElement: this.video,
          hlsPlayer: this.hlsPlayer,
          dashPlayer: this.dashPlayer
        });
      }

      /* TODO: Account watermark
      if(this.controls && this.playerOptions.accountWatermark) {
        // Watermark
        this.controls.InitializeAccountWatermark(
          (await this.__Client()).CurrentAccountAddress()
        );
      }

       */

      if(this.__destroyed) {
        // If Destroy was called during the initialization process, ensure that the player is properly destroyed
        this.__DestroyPlayer();
      }
    } catch (error) {
      // If playout failed due to a permission issue, check the content to see if there is a message to display
      let permissionErrorMessage;
      if(error && [401, 403].includes(error.status) || [401, 403].includes(error.code)) {
        try {
          const client = await this.__Client();

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
        this.__HardReload(error, 10000);
      } else {
        this.SetErrorMessage(error.displayMessage || "Something went wrong");
      }

      if(this.playerOptions.errorCallback) {
        this.playerOptions.errorCallback(error, this);
      }
    } finally {
      this.loading = false;
      this.__SettingsUpdate();
    }
  }

  async __InitializeHLS({playoutUrl, authorizationToken, drm, multiviewOptions}) {
    this.HLS = (await import("hls.js")).default;

    if(["fairplay", "sample-aes"].includes(drm) || !this.HLS.isSupported()) {
      // HLS JS NOT SUPPORTED - Handle native player
      this.nativeHLS = true;

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

        /* TODO: Init multiview
        if(this.controls) {
          this.controls.InitializeMultiViewControls(multiviewOptions);
        }

         */
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

      // Keep track of relevant settings updates so the UI can react
      [
        this.HLS.Events.SUBTITLE_TRACKS_UPDATED,
        this.HLS.Events.SUBTITLE_TRACK_SWITCH,
        this.HLS.Events.LEVEL_UPDATED,
        this.HLS.Events.LEVEL_SWITCHED,
        this.HLS.Events.AUDIO_TRACKS_UPDATED,
        this.HLS.Events.AUDIO_TRACK_SWITCHED,
        this.HLS.Events.MANIFEST_LOADED
      ]
        .map(event => hlsPlayer.on(event, () => this.__SettingsUpdate()));

      // TODO: Refactor this somewhere else
      this.SetPlayerProfile = async ({profile, customHLSOptions={}}) => {
        this.videoDuration = undefined;
        this.playerOptions.playerProfile = profile;
        this.customHLSOptions = customHLSOptions;

        const playing = !this.video.paused;
        const currentTime = this.video.currentTime;

        this.hlsPlayer.destroy();
        await this.__InitializeHLS({
          playoutUrl,
          authorizationToken,
          drm,
          multiviewOptions
        });

        playing ? this.video.play() : this.video.pause();

        if(!this.isLive) {
          this.video.currentTime = currentTime;
        }
      };

      // Error handling
      hlsPlayer.on(this.HLS.Events.FRAG_LOADED, () =>
        this.errors = 0
      );

      hlsPlayer.on(this.HLS.Events.ERROR, async (event, error) => {
        this.errors += 1;

        this.Log(`Encountered ${error.details}`, true);
        this.Log(error, true);

        if(error.response && error.response.code === 403) {
          // Not allowed to access
          this.SetErrorMessage("Insufficient permissions");
        } else if(this.errors < 5) {
          if(error.fatal) {
            if(error.data && error.data.type === this.HLS.ErrorTypes.MEDIA_ERROR) {
              this.Log("Attempting to recover using hlsPlayer.recoverMediaError");
              hlsPlayer.recoverMediaError();
            } else {
              this.__HardReload(error);
            }
          }
        } else {
          this.__HardReload(error);
        }
      });

      this.hlsPlayer = hlsPlayer;
      this.player = hlsPlayer;
    }
  }

  async __InitializeDash({playoutUrl, authorizationToken, drm, drms}) {
    this.Dash = (await import("dashjs")).default;
    const dashPlayer = this.Dash.MediaPlayer().create();

    const customDashOptions = this.playerOptions.dashjsOptions || {};
    dashPlayer.updateSettings({
      ...customDashOptions,
      "streaming": {
        "buffer": {
          "fastSwitchEnabled": true,
          "flushBufferAtTrackSwitch": true,
          ...((customDashOptions.streaming || {}).buffer || {})
        },
        "text": {
          "defaultEnabled": false,
          ...((customDashOptions.streaming || {}).text || {})
        },
        ...(customDashOptions.streaming || {})
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

    /*
    if(this.controls && multiviewOptions.enabled) {
      this.controls.InitializeMultiViewControls(multiviewOptions);
    }

     */

    // Keep track of relevant settings updates so the UI can react
    [
      this.Dash.MediaPlayer.events.TRACK_CHANGE_RENDERED,
      this.Dash.MediaPlayer.events.QUALITY_CHANGE_RENDERED,
      this.Dash.MediaPlayer.events.REPRESENTATION_SWITCH,
      this.Dash.MediaPlayer.events.TEXT_TRACKS_ADDED,
      this.Dash.MediaPlayer.events.TEXT_TRACK_ADDED,
      this.Dash.MediaPlayer.events.MANIFEST_LOADED,
      this.Dash.MediaPlayer.events.CAN_PLAY
    ]
      .map(event => dashPlayer.on(event, () => this.__SettingsUpdate()));

    this.player = dashPlayer;
    this.dashPlayer = dashPlayer;
  }

  async __Play() {
    try {
      await this.video.play();
      return true;
    } catch(error) {
      this.Log("Unable to autoplay", true);
      this.Log(error, true);
      this.playbackStarted = false;

      if(this.playerOptions.muted === EluvioPlayerParameters.muted.OFF_IF_POSSIBLE && this.video.paused && !this.video.muted) {
        await new Promise(resolve => setTimeout(resolve, 250));
        this.Log("Attempting to autoplay muted");
        this.video.muted = true;

        try {
          await this.video.play();
          return true;
        } catch (error) {
          this.playbackStarted = false;
          return false;
        }
      } else {
        this.playbackStarted = false;
        return false;
      }
    }
  }

  async __VerifyContent() {
    if(!this.contentHash) { return; }

    const client = await this.__Client();

    const audit =
      this.isLive ?
        await client.AuditStream({versionHash: this.contentHash}) :
        await client.AuditContentObject({versionHash: this.contentHash});

    if(!audit.verified) {
      return;
    }

    audit.verifiedAt = Date.now();

    const objectId = client.utils.DecodeVersionHash(this.contentHash).objectId;
    audit.details = {
      _state: "initial",
      versionHash: this.contentHash,
      objectId,
      address: client.utils.HashToAddress(objectId),
      signatureMethod: "ECDSA secp256k1"
    };

    this.contentAudit = audit;
    this.contentVerified = audit.verified;

    this.__SettingsUpdate();
  }

  async __LoadVerificationDetails() {
    if(
      !this.contentHash ||
      !this.contentAudit ||
      this.contentAudit.details._state !== "initial" ||
      this.contentAudit.loading
    ) {
      return;
    }

    this.contentAudit.loading = true;

    const client = await this.__Client();

    const objectId = client.utils.DecodeVersionHash(this.contentHash).objectId;
    const tenantId = await client.ContentObjectTenantId({objectId});

    let tenantName, lastCommittedAt, versionCount;
    try {
      lastCommittedAt = await client.CallContractMethod({
        contractAddress: client.utils.HashToAddress(objectId),
        methodName: "objectTimestamp"
      });

      if(lastCommittedAt) {
        lastCommittedAt = new Date(parseInt(lastCommittedAt._hex, 16) * 1000);
      }

      versionCount = await client.CallContractMethod({
        contractAddress: client.utils.HashToAddress(objectId),
        methodName: "countVersionHashes"
      });

      if(versionCount) {
        versionCount = parseInt(versionCount._hex, 16);
      }

      // eslint-disable-next-line no-empty
    } catch (error) {}

    try {
      tenantName = await client.ContentObjectMetadata({
        libraryId: client.contentSpaceLibraryId,
        objectId: tenantId.replace("iten", "iq__"),
        metadataSubtree: "/public/name"
      });
      // eslint-disable-next-line no-empty
    } catch (error) {}

    this.contentAudit.details = {
      _state: "minus-tx",
      versionHash: this.contentHash,
      objectId,
      address: client.utils.HashToAddress(objectId),
      explorerUrl: client.NetworkInfo().name !== "main" ? undefined :
        `https://explorer.contentfabric.io/address/${client.utils.HashToAddress(objectId)}`,
      tenantId,
      tenantAddress: client.utils.HashToAddress(tenantId),
      tenantName,
      ownerAddress: await client.ContentObjectOwner({objectId}),
      lastCommittedAt,
      versionCount,
      latestVersionHash: await client.LatestVersionHash({objectId}),
      signatureMethod: "ECDSA secp256k1"
    };

    this.__SettingsUpdate();

    try {
      if(client.NetworkInfo().name === "main") {
        const explorerUrl = new URL("https://explorer.contentfabric.io/api");
        explorerUrl.searchParams.set("module", "account");
        explorerUrl.searchParams.set("action", "txlist");
        explorerUrl.searchParams.set("offset", "1");
        explorerUrl.searchParams.set("address", client.utils.HashToAddress(objectId));

        this.contentAudit.details.latestTransactionHash = (await ((await fetch(explorerUrl)).json())).result[0].hash;
        this.contentAudit.details.latestTransactionHashUrl = `https://explorer.contentfabric.io/tx/${this.contentAudit.details.latestTransactionHash}`;
      }
      // eslint-disable-next-line no-empty
    } catch (error) {
    } finally {
      this.contentAudit.details._state = "full";
      delete this.contentAudit.loading;

      this.__SettingsUpdate();
    }
  }

  // Indicate to controls that the settings have updated
  __SettingsUpdate() {
    this.__settingsListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        this.Log("Failed to call settings listener", true);
        this.Log(error, true);
      }
    });
  }

  __SetControlsVisibility(visible) {
    if(this.controls.visible === visible) { return; }

    this.controls.visible = visible;
    this.__SettingsUpdate();
  }

  __DestroyPlayer() {
    this.__destroyed = true;
    this.__Reset();
  }

  __Reset() {
    if(!this.player) { return; }

    this.Log("Destroying player");

    if(this.video) {
      this.video.pause();
    }

    if(this.hlsPlayer) {
      this.hlsPlayer.destroy();
    } else if(this.dashPlayer) {
      this.dashPlayer.destroy();
    }

    this.__listenerDisposers.forEach(Disposer => {
      try {
        Disposer();
      } catch (error) {
        this.Log("Failed to dispose of video event listener", true);
        this.Log(error);
      }
    });

    this.__listenerDisposers = [];
    this.__showPlayerProfileForm = false;

    if(this.video.mux) {
      try {
        this.video.mux.destroy();
      } catch(error) {
        this.Log("Error destroying mux monitoring:");
        this.Log(error);
      }
    }

    this.contentHash = undefined;
    this.nativeHLS = false;
    this.hlsPlayer = undefined;
    this.dashPlayer = undefined;
    this.player = undefined;
    this.initTimeLogged = false;
    this.canPlay = false;
  }

  async __HardReload(error, delay=6000) {
    if(this.reloading) { return; }

    this.reloading = true;
    this.reloads += 1;

    if(this.reloads > 2) {
      this.SetErrorMessage(error.displayMessage || "Unable to play content");
      return;
    }

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
      const client = await this.__Client();
      if(client) {
        await client.ResetRegion();
      }

      this.restarted = true;
      this.SetErrorMessage(undefined);
      this.__Initialize(
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
}

EluvioPlayer.EluvioPlayerParameters = EluvioPlayerParameters;
EluvioPlayer.EluvioPlayer = EluvioPlayer;

export default EluvioPlayer;

