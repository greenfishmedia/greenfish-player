import TicketFormStyles from "../static/stylesheets/ticket-form.module.scss";

import React, {useEffect, useState} from "react";
import {Spinner} from "./Components.jsx";

const TicketForm = ({parameters, dimensions, onComplete}) => {
  let { tenantId, ntpId, ticketCode, ticketSubject } = (parameters.clientOptions || {});

  // If tenant ID or NTP ID not specified, code cannot be redeemed
  const invalid = !tenantId || !ntpId;

  const [code, setCode] = useState(ticketCode || "");
  const [initialCodeSubmitting, setInitialCodeSubmitting] = useState(!!ticketCode);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(!invalid ? "" : "Error: Tenant ID or NTP ID not specified");
  const [client, setClient] = useState(undefined);

  const RedeemCode = async ({client, code}) => {
    if(!code || !client) { return; }

    setErrorMessage("");
    setSubmitting(true);

    try {
      let subject = ticketSubject;
      if(code.includes(":")) {
        subject = code.split(":")[0];
        code = code.split(":")[1];
      }

      await client.RedeemCode({
        tenantId,
        ntpId,
        code: code.trim(),
        email: subject
      });

      onComplete(client);
    } catch(error) {
      // eslint-disable-next-line no-console
      console.log(error);

      setErrorMessage("Invalid Code");
      setInitialCodeSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    // Ticket redemption always uses new client
    import("@eluvio/elv-client-js")
      .then(async ({ElvClient}) => {
        const client = await ElvClient.FromConfigurationUrl({
          configUrl: parameters.clientOptions.network
        });

        setClient(client);

        if(ticketCode) {
          RedeemCode({client, code: ticketCode});
        }
      });


  }, []);

  if(initialCodeSubmitting) {
    return (
      <div
        role="complementary"
        tabIndex={-1}
        style={{
          backgroundColor: parameters.playerOptions.backgroundColor || "transparent",
          "--portal-width": `${dimensions.width}px`,
          "--portal-height": `${dimensions.height}px`
        }}
        className={[TicketFormStyles["ticket-form-container"], TicketFormStyles[`size-${dimensions.size}`], TicketFormStyles[`orientation-${dimensions.orientation}`]].join(" ")}
      >
        <div className={TicketFormStyles["ticket-form-overlay"]}>
          <Spinner className={TicketFormStyles["spinner"]} />
        </div>
      </div>
    );
  }

  return (
    <div
      role="complementary"
      tabIndex={-1}
      style={{
        backgroundColor: parameters.playerOptions.backgroundColor || "transparent",
        "--portal-width": `${dimensions.width}px`,
        "--portal-height": `${dimensions.height}px`
      }}
      className={[TicketFormStyles["ticket-form-container"], TicketFormStyles[`size-${dimensions.size}`], TicketFormStyles[`orientation-${dimensions.orientation}`]].join(" ")}
    >
      <div className={TicketFormStyles["ticket-form-overlay"]}>
        <form
          onSubmit={event => {
            event.preventDefault();
            RedeemCode({client, code});
          }}
          className={TicketFormStyles["ticket-form"]}
        >
          <div className={TicketFormStyles["text"]}>
            <h2 className={TicketFormStyles["title"]}>
              { parameters.clientOptions.ticketTitle || "This content requires a code to view" }
            </h2>
            <p className={TicketFormStyles["description"]}>
              { parameters.clientOptions.ticketDescription || "Please enter your code below" }
            </p>
          </div>
          <div className={TicketFormStyles["inputs"]}>
            <input
              disabled={invalid}
              autoFocus
              type="text"
              placeholder="Ticket Code"
              value={code}
              aria-label="Ticket Code"
              aria-invalid={!!errorMessage && !invalid}
              aria-errormessage={errorMessage}
              onKeyDown={event => event.key === "Enter" && RedeemCode({client, code})}
              onChange={event => {
                setErrorMessage("");
                setCode(event.target.value);
              }}
              className={TicketFormStyles["input"]}
            />
            <button
              type="submit"
              aria-label="Submit Code"
              disabled={!code || !client || invalid}
              className={TicketFormStyles["submit"]}
            >
              { submitting ? <Spinner light /> : "Submit" }
            </button>
          </div>
          <div className={TicketFormStyles["error-message"]}>{ errorMessage } </div>
        </form>
      </div>
    </div>
  );
};

export default TicketForm;
