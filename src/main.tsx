import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CABINETS } from "./data/cabinets";
import { ISLAND, LAYOUT_PARAMS, RUNS, SLOT_PLACEMENT } from "./data/room";
import { setupAnalytics } from "./analytics";
import { DEBUG } from "./debug";
import { kitchenNow, openSharedLink, shareUrl } from "./store/openLink";
import "./index.css";

// The visit counter, on the live site only and before the link is read, so a
// page opened from a link counts its view and then the link (D24).
setupAnalytics();

// A page opened from a share link builds the link's kitchen before anything
// is drawn, so the first frame is that kitchen at the default view (D1, D23).
openSharedLink(window.location.search);

// Under ?debug=1, what the page is built from and the room it built, for the
// test that a link opens the same kitchen it was shared from (D23).
if (DEBUG) {
  Object.assign(window, {
    __kitchen: kitchenNow,
    __shareUrl: shareUrl,
    __room: () => ({ params: LAYOUT_PARAMS, runs: RUNS, slots: SLOT_PLACEMENT, island: ISLAND, cabinets: CABINETS }),
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
