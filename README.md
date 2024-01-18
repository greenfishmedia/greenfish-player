# Eluvio Player

A simple and robust way to play video content from the Eluvio Content Fabric.

## Quick Start:

Install from npm:

```
npm install --save @eluvio/elv-player-js
```

Import the library and load the player:
```javascript
import EluvioPlayer, {EluvioPlayerParameters} from "@eluvio/elv-player-js";

const player = new EluvioPlayer(
  targetContainerElement,
  {
    clientOptions: {
      network: EluvioPlayerParameters.network.main,
    },
    sourceOptions: {
      playoutParameters: {
        versionHash: "hq__...."
      }
    },
    playerOptions: {
      autoplay: EluvioPlayerParameters.autoplay.ON
    }
  }
);
```

## Options

The player library has a number of options to configure what content should be played and how it's authorized, display options for the player, and callbacks for events.

The library includes a helpful collection of configuration options in `EluvioPlayerParameters`. 

### Client Options:

```javascript
  clientOptions: {
    network: EluvioPlayerParameters.networks.MAIN,
    client: undefined,
    staticToken: undefined
  }
```

##### Values:
- `network` - Which Fabric network to use. Defaults to the main production network. `EluvioPlayerParameters.networks["MAIN" | "DEMO]`
- `client` - If you already have an instance of @eluvio/elv-client-js, you can provide it to the player to avoid initializing a new client. This will improve initial load performance. This will also handle any necessary authorization your client is already set up for.
- `staticToken` - If you have a static auth token to use, you can provide it

### Source Options:

```javascript
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
```

##### Values:
- `protocols` - The ABR protocols you want the player to use
- `drms` - The DRMs options you want the player to use
- `playoutOptions` - If you already have the results of `client.PlayoutOptions`, you can provide it
- `playoutParameters` - These parameters directly correspond to what is provided to the [PlayoutOptions](https://eluv-io.github.io/elv-client-js/module-ElvClient_ContentAccess.html#.PlayoutOptions) method in @eluvio/elv-client-js. Typically you will only need to specify a versionHash or object ID

### Player Options

```javascript
  // All player options and their defaults
  playerOptions: {
    controls: EluvioPlayerParameters.controls.AUTO_HIDE,
    autoplay: EluvioPlayerParameters.autoplay.OFF,
    muted: EluvioPlayerParameters.muted.OFF,
    loop: EluvioPlayerParameters.loop.OFF,
    watermark: EluvioPlayerParameters.watermark.ON,
    capLevelToPlayerSize: EluvioPlayerParameters.capLevelToPlayerSize.OFF,
    collectVideoAnalytics: EluvioPlayerParameters.collectVideoAnalytics.ON,
    posterUrl: undefined,
    className: undefined,
    controlsClassName: undefined,
    hlsjsOptions: undefined,
    dashjsOptions: undefined,
    maxBitrate: undefined,
    playerCallback: ({player, videoElement, hlsPlayer, dashPlayer, posterUrl}) => {},
    errorCallback: (error, player) => {},
    restartCallback: async (error) => {}
  }
```

##### Values
* `controls` - How the controls should be displayed
  * `AUTOHIDE (default)`: Player controls will be shown. Will automatically hide when not in use
  * `ON`: Player controls will be shown
  * `DEFAULT`: Default HTML video controls will be shown
  * `OFF`: No controls will be shown
  * `OFF_WITH_VOLUME_TOGGLE`: No controls will be shown except a volume on/off toggle
* `autoplay` - Whether or not the video should autoplay. NOTE: Browsers may block autoplay video with audio
  * `OFF (default)`: Video will not autoplay
  * `ON`: Video will autoplay
  * `WHEN_VISIBLE`: Video will autoplay only when the video element is visible, and will stop when the element is no longer visible
* `muted` - Whether or not the video will be muted.
  * `OFF (default)`: Video will not be muted
  * `ON`: Video will be muted
  * `WHEN_NOT_VISIBLE`: Video will be muted when the video element is not visible
  * `OFF_IF_POSSIBLE`: Video will not be muted unless playback is blocked due to audio (useful for autoplay)
* `loop` - Whether or not the video will loop.
  * `OFF (default)` - Video will not loop
  * `ON` - Video will loop
* `watermark`: Whether or not the Eluvio watermark will be shown.
  * `ON (default)` - Watermark will be shown
  * `OFF` - Watermark will not be shown
* `capLevelToPlayerSize`: Whether or not the playback quality should be limited by the size of the video element. Useful for reducing bandwidth usage for smaller video elements where a higher quality would not be beneficial.
  * `OFF (default)` - Playback quality will not be affected by the size of the video element (default)
  * `ON` - Playback quality will be limited by the size of the video element
* `collectVideoAnalytics` - By default, the player will collect anonymized playback analytics to help improve the performance of the Eluvio Content Fabric.
  * `ON (default)` - Player performance analytics will be collected
  * `DISABLE_COOKIES`- Player performance analytics will be collected, but browser cookies will not be used
  * `OFF` - Player performance analytics will not be collected
* `maxBitrate` - Maximum bitrate that the player will automatically use, in bits/second.
* `posterUrl` - Specify a URL for the poster image for the player
* `className` - HTML class to be added to the player
* `controlsClassName` - HTML class to be added to the player controls container
* `hlsjsOptions` - Additional options to provide to hls.js on initialization
* `dashjsOptions` - Additional options to provide to dashjs on initialization
* `playerCallback` - Callback function invoked after initialization has completed. Returns references to the player, the html video element, the dashjs or hls.js player instance, and the URL of the poster image
* `errorCallback` - Callback function invoked when an error occurs. Includes the error as well as a reference to the player.
* `restartCallback` - Callback function invoked when the player has restarted to attempt to recover from an error. Includes the error.
  


## Eluvio Embed Player

For an even simpler experience, you can use the [Eluvio Embed application](https://embed.v3.contentfabric.io/) to generate embeddable and sharable links to content on the fabric.

- Go to https://embed.v3.contentfabric.io/
- Specify your content and player configuration
- Generate the embed URL
- Embed the provided frame code in your webpage or share the embed link

### Example

Embeddable Frame:

```html
<iframe 
  width=854 height=480 scrolling="no" marginheight="0" 
  marginwidth="0" frameborder="0" type="text/html" 
  src="https://embed.v3.contentfabric.io/?net=main&p&ct=h&vid=hq__CcdV4wnCNq9wv6jXpYeCQ2GE4FLQBFtVSSSt2XKfBJMrH89DFDGsfkpWWvBy16QBGGYeF5mLGo&mt=v"
  allowtransparency="true"
></iframe>
```

Link:

https://embed.v3.contentfabric.io/?net=main&p&ct=h&vid=hq__CcdV4wnCNq9wv6jXpYeCQ2GE4FLQBFtVSSSt2XKfBJMrH89DFDGsfkpWWvBy16QBGGYeF5mLGo&mt=v
