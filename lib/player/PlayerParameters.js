export const PlayerParameters = {
  ui: {
    WEB: "web",
    TV: "tv"
  },
  networks: {
    MAIN: "https://main.net955305.contentfabric.io/config",
    DEMO: "https://demov3.net955210.contentfabric.io/config",
    DEMO_LOCAL: "http://localhost:8008/config?qspace=demov3&self",
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
    CLEAR: "clear",
    PLAYREADY: "playready"
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
    OFF: false,
    FULLSCREEN_ONLY: "fullscreen_only"
  },
  type: {
    LIVE: "live",
    VOD: "vod"
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
  keyboardControls: {
    OFF: false,
    ON: true,
    ARROW_KEYS_DISABLED: "arrow_keys_disabled"
  },
  collectVideoAnalytics: {
    OFF: false,
    ON: true,
    DISABLE_COOKIES: "disable_cookies"
  },
  verifyContent: {
    OFF: false,
    ON: true
  }
};

export const DefaultParameters = {
  clientOptions: {
    network: PlayerParameters.networks.MAIN,
    client: undefined,
    staticToken: undefined,
    tenantId: undefined,
    ntpId: undefined,
    promptTicket: false,
    ticketCode: undefined,
    ticketSubject: undefined,
    ticketTitle: undefined,
    ticketDescription: undefined
  },
  sourceOptions: {
    protocols: [
      PlayerParameters.protocols.HLS,
      PlayerParameters.protocols.DASH
    ],
    drms: [
      PlayerParameters.drms.FAIRPLAY,
      PlayerParameters.drms.SAMPLE_AES,
      PlayerParameters.drms.AES128,
      PlayerParameters.drms.WIDEVINE,
      PlayerParameters.drms.CLEAR,
      PlayerParameters.drms.PLAYREADY
    ],
    contentInfo: {
      title: undefined,
      subtitle: undefined,
      description: undefined,
      image: undefined,
      posterImage: undefined,
      type: PlayerParameters.type.VOD,
      headers: []
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
      offering: undefined,
      offerings: [],
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
    backgroundColor: undefined,
    ui: PlayerParameters.ui.WEB,
    controls: PlayerParameters.controls.AUTO_HIDE,
    autoplay: PlayerParameters.autoplay.OFF,
    muted: PlayerParameters.muted.OFF,
    loop: PlayerParameters.loop.OFF,
    watermark: PlayerParameters.watermark.ON,
    keyboardControls: PlayerParameters.keyboardControls.ON,
    capLevelToPlayerSize: PlayerParameters.capLevelToPlayerSize.OFF,
    title: PlayerParameters.title.ON,
    playerProfile: PlayerParameters.playerProfile.DEFAULT,
    collectVideoAnalytics: PlayerParameters.collectVideoAnalytics.ON,
    verifyContent: PlayerParameters.verifyContent.OFF,
    hlsjsOptions: undefined,
    dashjsOptions: undefined,
    debugLogging: false,
    maxBitrate: undefined,
    markInOut: false,
    // eslint-disable-next-line no-unused-vars
    playerCallback: ({player, videoElement, hlsPlayer, dashPlayer}) => {},
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

export default PlayerParameters;
