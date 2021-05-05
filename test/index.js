import "./test.scss";

import {ElvClient} from "@eluvio/elv-client-js";
import {EluvioPlayer, EluvioPlayerParameters} from "../src";

const Initialize = async () => {
  const client = await ElvClient.FromConfigurationUrl({
    configUrl: "https://demov3.net955210.contentfabric.io/config"
  });

  /*
  const versionHash = "hq__CcdV4wnCNq9wv6jXpYeCQ2GE4FLQBFtVSSSt2XKfBJMrH89DFDGsfkpWWvBy16QBGGYeF5mLGo";


  const staticToken = btoa(JSON.stringify({qspace_id: client.contentSpaceId}));
  client.SetStaticToken({token: staticToken});


  const tenantId = "iten3HEEASRTo2rNLeeKw4cfq4sPuX6";

  await client.RedeemCode({
    tenantId,
    //code: "dVGZRUj"
    code: "wVFVYV8"
  });


  //const versionHash = await client.LatestVersionHash({versionHash: "hq__36gaCZiFBKL6QLUYAxuSfpRQy1qFFBF8XU3LysDbucxRZz6Dt7GfDYxYaTg1kDY677QNigirFS"});
  //const versionHash = await client.LatestVersionHash({versionHash: "hq__JBuEFojvV3EuEMEtq7wY589Bd1uw38WASYTXoJK4Lmt4nvsy3k9SyR86Z3hgJa8HyQVm4g9qjq"});
  //const versionHash = await client.LatestVersionHash({versionHash: "hq__KRZUjbZCpZFar4Jhg813sN2BGFPR1aSQnxDTVpB8iMAS7uG5acnmioXnoJac7xAA3PAFMGrThr"});
  const versionHash = await client.LatestVersionHash({versionHash: "hq__5SwAmykAc2LmaSmi5mTR28KSSZwHxYpxLXoPcFYagrj26tE3kowPRTWVVapUtwTtTs1ZFKDU32"});

  const availableOfferings = await client.AvailableOfferings({
    versionHash,
    linkPath: "public/asset_metadata/offerings",
    directLink: true
  });

  const offeringId = Object.keys(availableOfferings)[0];
  const offeringURI = availableOfferings[offeringId].uri;

  console.log(offeringURI);



  const offeringURI = "/q/hq__2PhXXyC8eKD1pz3kKJtymktgErJAXBJsqQVfhTM9xMnFdDcihXyaXRV4tNNR9Y3yarz6HTJZ7W/rep/channel/ga/options.json?link_depth=1&resolve_ignore_errors=false";

   */

  //https://embed.v3.contentfabric.io/?net=main&p&ct=d&ttl=RXhhbXBsZSBGYWJyaWMgQWNjZXNzIENvZGUtYmFzZWQgTkZU&oid=&ten=/&tk=Q2h4b2dOSw==&sbj=

  const tenantId = "iten3DGVgP9qhxHLUo4YVF6mm2uAjPij";
  const ntpId = "QOTPYRdu569UHSk";
  const objectId = "iq__DrHJFbT77taS4UqxqzPeRyjWkCJ";
  const ticketSubject = "0001";

  window.player = new EluvioPlayer(
    document.getElementById("player-target"),
    {
      clientOptions: {
        //client,
        network: EluvioPlayerParameters.networks.MAIN,
        tenantId,
        ntpId,
        ticketSubject,
        promptTicket: true
      },
      sourceOptions: {
        drms: ["clear"],
        playoutParameters: {
          objectId
        }
      },
      playerOptions: {
        muted: true,
        controls: EluvioPlayerParameters.controls.AUTO_HIDE
      }
    }
  );
};


Initialize();
