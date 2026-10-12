import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://agent-loadout.com",
  description: "Give AI agents email inboxes, a credential vault, cards, and machines.",
  auth: connect("agent-loadout.com/" + process.env.VERCEL_PROJECT_ID),
});
